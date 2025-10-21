import React, { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";

import { createTodo, getAllTodos, getDBVersion, getSQLiteVersion, migrateDB, updateTodoStatus } from "@/lib/db";
import { TodoItem, uuid } from "@/lib/types";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { FadeIn, FadeOut, SharedValue, useAnimatedStyle } from "react-native-reanimated";

// No componente RightAction, os parâmetros prog e drag são valores compartilhados (SharedValue) fornecidos pelo ReanimatedSwipeable:

// prog (progress): representa o progresso do swipe, normalmente variando de 0 (sem swipe) até 1 (swipe completo). Pode ser usado para animar elementos conforme o usuário desliza.
// drag: representa o deslocamento horizontal do swipe, ou seja, quantos pixels o item foi arrastado para o lado. Usado para animar a posição ou outros estilos do botão de ação.
// Esses valores permitem criar animações reativas e dinâmicas no botão de ação, tornando a experiência de swipe mais fluida e visualmente agradável.
function RightAction({ prog, drag, isDone, onPress }: {
  prog: SharedValue<number>;
  drag: SharedValue<number>;
  isDone?: boolean;
  onPress: () => void;
}) {
  const styleAnimation = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + 200 }],
  }));

  return (
    <Reanimated.View style={[styleAnimation, { width: 200, height: "100%" }]}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: isDone ? "orange" : "green",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            borderRadius: 0,
          }}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>
            {isDone ? "Marcar como pendente" : "Marcar como concluído"}
          </Text>
        </TouchableOpacity>
    </Reanimated.View>
  );
}

function ListItem({ todoItem, toggleTodo }: { todoItem: TodoItem; toggleTodo: (id: uuid) => void }) {

  const swipeableRef = useRef<SwipeableMethods>(null);

  const handlePress = (id: uuid) => {
    swipeableRef.current?.close();
    toggleTodo(id); // remove do estado imediatamente, animação de saída será aplicada
  };

  return (
    <Reanimated.View exiting={FadeOut} entering={FadeIn}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <ReanimatedSwipeable
          ref={swipeableRef}
          containerStyle={styles.item}
          friction={1}
          enableTrackpadTwoFingerGesture
          rightThreshold={200}
          renderRightActions={(prog, drag) => (
            <RightAction
              prog={prog}
              drag={drag}
              isDone={todoItem.done}
              onPress={() => handlePress(todoItem.id)}
            />
          )}
        >
          <Text style={todoItem.done ? styles.itemdone : styles.item}>{todoItem.text}</Text>
        </ReanimatedSwipeable>
      </View>
    </Reanimated.View>
  );
}

enum FilterOptions {
  All = "all",
  Pending = "pending",
  Done = "done"
}

function TodosFilter({ selectedValue, setFilter }: { selectedValue: FilterOptions, setFilter: (value: FilterOptions) => void }) {
  return (
    <View style={filterStyles.filterMenu}>
      <TouchableOpacity
        style={[filterStyles.button, filterStyles.buttonAll, selectedValue === FilterOptions.All && filterStyles.buttonAllSelected]}
        onPress={() => setFilter(FilterOptions.All)}
      >
        <Text style={[filterStyles.label, filterStyles.buttonAllLabel, selectedValue === FilterOptions.All && filterStyles.buttonAllSelectedLabel]}>Todos</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[filterStyles.button, filterStyles.buttonPending, selectedValue === FilterOptions.Pending && filterStyles.buttonPendingSelected]}
        onPress={() => setFilter(FilterOptions.Pending)}
      >
        <Text style={[filterStyles.label, filterStyles.buttonPendingLabel, selectedValue === FilterOptions.Pending && filterStyles.buttonPendingSelectedLabel]}>Pendentes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[filterStyles.button, filterStyles.buttonDone, selectedValue === FilterOptions.Done && filterStyles.buttonDoneSelected]}
        onPress={() => setFilter(FilterOptions.Done)}
      >
        <Text style={[filterStyles.label, filterStyles.buttonDoneLabel, selectedValue === FilterOptions.Done && filterStyles.buttonDoneSelectedLabel]}>Concluídos</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddTodoForm({ addTodoHandler }: { addTodoHandler: (text: string) => void }) {
  const [text, setText] = React.useState("");

  const handlePress = () => {
    if (text.trim().length === 0) return;

    addTodoHandler(text);
    setText("");
    Keyboard.dismiss();
  };

  return (
    <View style={{ width: "100%", marginTop: 10, paddingHorizontal: 20, alignItems: "center" }}>
      <TextInput
        value={text}
        onChangeText={setText}
        style={styles.textInput}
        placeholder="O que você precisa fazer?"
        placeholderTextColor="#000"
        onSubmitEditing={handlePress}
        returnKeyType="done"
      />
    </View>
  );
}

function Footer() {
  const db = useSQLiteContext();

  const [sqliteVersion, setSqliteVersion] = useState<string>("");
  const [dbVersion, setDBVersion] = useState<string>();

  useEffect(() => {
    async function setup() {
      const sqliteVersionResult = await getSQLiteVersion(db);
      if (sqliteVersionResult) {
        setSqliteVersion(sqliteVersionResult['sqlite_version()']);
      }
      else {
        setSqliteVersion('unknown');
      }

      const dbVersionResult = await getDBVersion(db);

      if (dbVersionResult) {
        setDBVersion(dbVersionResult['user_version'].toString());
      }
      else {
        setDBVersion('unknown');
      }
    }

    setup();
  }, [db]);

  return (
    <View>
      <Text style={{ padding: 20 }}>SQLite version: {sqliteVersion} / DBVersion: {dbVersion}</Text>
    </View>
  );
}

function TodoList() {

  const [todos, setTodos] = React.useState<TodoItem[]>([]);

  const db = useSQLiteContext();

  useEffect(() => {
    async function load() {
      const result = await getAllTodos(db);
      setTodos(result);
    }

    load();

  }, [db])

  const [filter, setFilter] = React.useState<FilterOptions>(FilterOptions.All);

  const addTodo = async (text: string) => {
    const newTodo = await createTodo(db, text);
    setTodos([...todos, newTodo]);
  };

  const toggleTodo = async (id: uuid) => {
    const updatedTodo = await updateTodoStatus(db, id, !todos.find(todo => todo.id === id)?.done);

    if (updatedTodo) {
      setTodos(todos.map(todo => todo.id === updatedTodo.id ? updatedTodo : todo));
    } else {
      console.warn(`Todo with id ${id} not found`);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={{ fontSize: 32, fontWeight: "bold", marginTop: 20 }}>
        TODO List
      </Text>
      <AddTodoForm addTodoHandler={addTodo} />
      <TodosFilter selectedValue={filter} setFilter={setFilter} />
      <FlatList
        style={styles.list}
        data={todos.filter(todo => {
          switch (filter) {
            case FilterOptions.All:
              return true;
            case FilterOptions.Pending:
              return !todo.done;
            case FilterOptions.Done:
              return todo.done;
            default:
              return true;
          }
        }).sort((a, b) => {
          const aDate = a.createdAt ?? new Date(0);
          const bDate = b.createdAt ?? new Date(0);
          return aDate === bDate ? 0 : aDate < bDate ? 1 : -1;
        }).sort((a, b) => {
           return (a.done === b.done) ? 0 : a.done ? 1 : -1;
         })}
        renderItem={({ item }) => (
          <ListItem todoItem={item} toggleTodo={toggleTodo} />
        )}
      />
    </GestureHandlerRootView>
  );
}


export default function Index() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
        <SQLiteProvider databaseName="todos.db" onInit={migrateDB}>
          <TodoList />
          <Footer />
        </SQLiteProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignContent: "center",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  textInput: {
    width: "100%",
    borderColor: "black",
    borderWidth: 1,
    margin: 10,
    padding: 10,
    borderRadius: 50,
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
    width: "100%"
  },
  itemdone: {
    padding: 10,
    fontSize: 18,
    height: 44,
    textDecorationLine: "line-through",
    width: "100%"
  },
  list: {
    width: "100%",
    backgroundColor: "white",
    padding: 10,
    marginTop: 20,
  },
});

const filterStyles = StyleSheet.create({
  filterMenu: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 20,
    marginTop: 10
  },

  button: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 50,
    alignSelf: 'flex-start',
    marginHorizontal: '1%',
    marginBottom: 6,
    minWidth: '28%',
    textAlign: 'center',
  },

  label: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  buttonAll: {
    backgroundColor: 'lightgreen',
  },
  buttonAllSelected: {
    backgroundColor: 'darkgreen',
  },

  buttonAllLabel: {
    color: 'darkgreen',
  },

  buttonAllSelectedLabel: {
    color: 'lightgreen',
  },

  buttonPending: {
    backgroundColor: 'oldlace',
  },
  buttonPendingSelected: {
    backgroundColor: 'coral',
  },

  buttonPendingLabel: {
    color: 'coral',
  },
  buttonPendingSelectedLabel: {
    color: 'oldlace',
  },

  buttonDone: {
    backgroundColor: 'lightblue',
  },
  buttonDoneSelected: {
    backgroundColor: 'royalblue',
  },
  buttonDoneLabel: {
    color: 'royalblue',
  },
  buttonDoneSelectedLabel: {
    color: 'lightblue',
  },

  selectedLabel: {
    color: 'white',
  },
});

