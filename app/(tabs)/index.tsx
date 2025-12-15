import React, { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View, Alert } from "react-native";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";

import { createTodo, getAllTodos, getDBVersion, getSQLiteVersion, migrateDB, updateTodoStatus, getAllLists, getTodosByList } from "@/lib/db";
import { TodoItem, uuid } from "@/lib/types";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, Link, router } from "expo-router";

import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { FadeIn, FadeOut, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";
import { IconSymbol } from "@/components/ui/IconSymbol";

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
    toggleTodo(id);
  };

  return (
    <Link href={{ pathname: "/task-detail", params: { id: todoItem.id } }} asChild>
      <TouchableOpacity>
        <Reanimated.View exiting={FadeOut} entering={FadeIn}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <ReanimatedSwipeable
              ref={swipeableRef}
              containerStyle={styles.itemContainer}
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
              <View style={{ flex: 1 }}>
                <Text style={todoItem.done ? styles.itemTextDone : styles.itemText}>
                  {todoItem.text}
                </Text>
                
                {/* Informações da lista */}
                <Text style={styles.listInfo}>
                  📋 Lista: {todoItem.listId === 'default-list' ? 'Geral' : todoItem.listId}
                </Text>
                
                {/* Data de vencimento */}
                {todoItem.dueDate && (
                  <Text style={[
                    styles.dueDate,
                    new Date(todoItem.dueDate) < new Date() && !todoItem.done && styles.overdue
                  ]}>
                    📅 Vence: {new Date(todoItem.dueDate).toLocaleDateString("pt-BR")}
                    {new Date(todoItem.dueDate) < new Date() && !todoItem.done && ' ⚠️ Atrasada'}
                  </Text>
                )}
                
                {/* Notas resumidas */}
                {todoItem.notes && (
                  <Text style={styles.notes} numberOfLines={2}>
                    📝 {todoItem.notes}
                  </Text>
                )}
              </View>
            </ReanimatedSwipeable>
          </View>
        </Reanimated.View>
      </TouchableOpacity>
    </Link>
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

function AddTodoForm({ addTodoHandler, lists, selectedListId }: { 
  addTodoHandler: (text: string, listId: string, notes?: string, dueDate?: Date) => void;
  lists: { id: string; name: string }[];
  selectedListId?: string;
}) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedList, setSelectedList] = useState<string>(selectedListId || 'default-list');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handlePress = () => {
    if (text.trim().length === 0) {
      Alert.alert("Atenção", "Por favor, digite uma descrição para a tarefa");
      return;
    }

    addTodoHandler(text, selectedList, notes.trim() || undefined, dueDate);
    setText("");
    setNotes("");
    setDueDate(undefined);
    setShowAdvanced(false);
    Keyboard.dismiss();
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setDueDate(date);
    }
  };

  return (
    <View style={{ width: "100%", marginTop: 10, paddingHorizontal: 20, alignItems: "center" }}>
      <TextInput
        value={text}
        onChangeText={setText}
        style={styles.textInput}
        placeholder="O que você precisa fazer?"
        placeholderTextColor="#666"
        onSubmitEditing={handlePress}
        returnKeyType="done"
      />

      <TouchableOpacity 
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(!showAdvanced)}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? "▲ Ocultar opções" : "▼ Mais opções"}
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={styles.advancedOptions}>
          {/* Lista */}
          <Text style={styles.optionLabel}>Lista:</Text>
          <View style={styles.listOptions}>
            {lists.map((list) => (
              <TouchableOpacity
                key={list.id}
                style={[
                  styles.listOption,
                  selectedList === list.id && styles.listOptionSelected
                ]}
                onPress={() => setSelectedList(list.id)}
              >
                <Text style={[
                  styles.listOptionText,
                  selectedList === list.id && styles.listOptionTextSelected
                ]}>
                  {list.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Data */}
          <Text style={styles.optionLabel}>Data de vencimento:</Text>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {dueDate ? dueDate.toLocaleDateString("pt-BR") : "Selecionar data"}
            </Text>
          </TouchableOpacity>
          {dueDate && (
            <TouchableOpacity 
              style={styles.clearDateButton}
              onPress={() => setDueDate(undefined)}
            >
              <Text style={styles.clearDateText}>Remover data</Text>
            </TouchableOpacity>
          )}

          {/* Notas */}
          <Text style={styles.optionLabel}>Notas:</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={styles.notesInput}
            placeholder="Adicione detalhes..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
        </View>
      )}
      
      {showDatePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      <TouchableOpacity 
        style={styles.addButton}
        onPress={handlePress}
      >
        <Text style={styles.addButtonText}>Adicionar Tarefa</Text>
      </TouchableOpacity>
    </View>
  );
}

function TodoList() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const db = useSQLiteContext();
  const params = useLocalSearchParams();
  const selectedListId = params.listId as string | undefined;
  const [filter, setFilter] = useState<FilterOptions>(FilterOptions.All);
  const [listName, setListName] = useState<string>("Todas as Tarefas");

  useEffect(() => {
    loadData();
  }, [db, selectedListId]);

  const loadData = async () => {
    try {
      // Carregar listas
      const listsResult = await getAllLists(db);
      setLists(listsResult);
      
      // Encontrar nome da lista
      if (selectedListId) {
        const selectedList = listsResult.find(list => list.id === selectedListId);
        setListName(selectedList?.name || "Lista");
      }

      // Carregar tarefas
      let todosResult;
      if (selectedListId) {
        todosResult = await getTodosByList(db, selectedListId);
      } else {
        todosResult = await getAllTodos(db);
      }
      setTodos(todosResult);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const addTodo = async (text: string, listId: string, notes?: string, dueDate?: Date) => {
    try {
      const newTodo = await createTodo(db, text, listId, notes, dueDate);
      setTodos([...todos, newTodo]);
    } catch (error) {
      console.error("Error adding todo:", error);
      Alert.alert("Erro", "Não foi possível adicionar a tarefa");
    }
  };

  const toggleTodo = async (id: uuid) => {
    try {
      const todo = todos.find(t => t.id === id);
      if (!todo) return;

      const updatedTodo = await updateTodoStatus(db, id, !todo.done);
      if (updatedTodo) {
        setTodos(todos.map(t => t.id === updatedTodo.id ? updatedTodo : t));
      }
    } catch (error) {
      console.error("Error toggling todo:", error);
    }
  };

  // Ordenação: data de vencimento -> data de criação
  const filteredAndSortedTodos = todos
    .filter(todo => {
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
    })
    .sort((a, b) => {
      // Tarefas concluídas no final
      if (a.done && !b.done) return 1;
      if (!a.done && b.done) return -1;
      
      // Ordenar por data de vencimento (mais próxima primeiro)
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      
      // Se sem data, ordena por criação (mais recente primeiro)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{listName}</Text>
        <TouchableOpacity
          style={styles.listsButton}
          onPress={() => router.push("/lists")}
        >
          <IconSymbol name="list.bullet" size={24} color="#0a7ea4" />
        </TouchableOpacity>
      </View>
      
      <AddTodoForm 
        addTodoHandler={addTodo} 
        lists={lists}
        selectedListId={selectedListId}
      />
      
      <TodosFilter selectedValue={filter} setFilter={setFilter} />
      
      <FlatList
        style={styles.list}
        data={filteredAndSortedTodos}
        renderItem={({ item }) => (
          <ListItem todoItem={item} toggleTodo={toggleTodo} />
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhuma tarefa {selectedListId ? "nesta lista" : ""}
            </Text>
          </View>
        }
      />
    </GestureHandlerRootView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
  },
  listsButton: {
    padding: 8,
  },
  textInput: {
    width: "100%",
    borderColor: "black",
    borderWidth: 1,
    margin: 10,
    padding: 10,
    borderRadius: 50,
  },
  advancedToggle: {
    marginBottom: 10,
  },
  advancedToggleText: {
    color: "#0a7ea4",
    fontSize: 14,
  },
  advancedOptions: {
    width: "100%",
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#495057",
    marginTop: 10,
    marginBottom: 5,
  },
  listOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  listOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#e9ecef",
  },
  listOptionSelected: {
    backgroundColor: "#0a7ea4",
  },
  listOptionText: {
    fontSize: 14,
    color: "#495057",
  },
  listOptionTextSelected: {
    color: "white",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "white",
  },
  dateButtonText: {
    fontSize: 14,
    color: "#495057",
  },
  clearDateButton: {
    marginTop: 5,
    alignSelf: "flex-start",
  },
  clearDateText: {
    color: "#dc3545",
    fontSize: 12,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 60,
  },
  addButton: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 10,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  itemContainer: {
    padding: 15,
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemText: {
    fontSize: 16,
    color: "#11181C",
    marginBottom: 4,
  },
  itemTextDone: {
    fontSize: 16,
    color: "#6c757d",
    textDecorationLine: "line-through",
    marginBottom: 4,
  },
  listInfo: {
    fontSize: 12,
    color: "#6c757d",
    marginBottom: 4,
  },
  dueDate: {
    fontSize: 13,
    color: "#495057",
    marginBottom: 4,
  },
  overdue: {
    color: "#dc3545",
    fontWeight: "600",
  },
  notes: {
    fontSize: 13,
    color: "#6c757d",
    fontStyle: "italic",
  },
  list: {
    width: "100%",
    backgroundColor: "white",
    padding: 10,
    marginTop: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
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