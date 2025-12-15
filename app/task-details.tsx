import React, { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { getAllLists, updateTodo } from "@/lib/db";
import { TodoItem } from "@/lib/types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

export default function TaskDetailScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams();
  const taskId = params.id as string;
  
  const [task, setTask] = useState<TodoItem | null>(null);
  const [lists, setLists] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadTask();
    loadLists();
  }, [db, taskId]);

  const loadTask = async () => {
    const result = await db.getFirstAsync<TodoItem>(
      "SELECT * FROM todos WHERE id = ?",
      [taskId]
    );
    if (result) {
      setTask({
        ...result,
        createdAt: new Date(result.createdAt),
        dueDate: result.dueDate ? new Date(result.dueDate) : undefined,
      });
    }
  };

  const loadLists = async () => {
    const result = await getAllLists(db);
    setLists(result);
  };

  const handleUpdate = async () => {
    if (!task) return;

    try {
      const updated = await updateTodo(db, task.id, {
        text: task.text,
        notes: task.notes,
        dueDate: task.dueDate,
        listId: task.listId,
      });

      if (updated) {
        setTask(updated);
        setEditing(false);
        Alert.alert("Sucesso", "Tarefa atualizada!");
      }
    } catch (error) {
      Alert.alert("Erro", "Não foi possível atualizar a tarefa");
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate && task) {
      setTask({ ...task, dueDate: selectedDate });
    }
  };

  const removeDueDate = () => {
    if (task) {
      setTask({ ...task, dueDate: undefined });
    }
  };

  if (!task) {
    return (
      <View style={styles.container}>
        <Text>Carregando...</Text>
      </View>
    );
  }

  const currentList = lists.find(list => list.id === task.listId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color="#0a7ea4" />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditing(!editing)} style={styles.editButton}>
          <Text style={styles.editButtonText}>
            {editing ? "Cancelar" : "Editar"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.screenTitle}>Detalhes da Tarefa</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Título</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={task.text}
              onChangeText={(text) => setTask({ ...task, text })}
            />
          ) : (
            <Text style={styles.text}>{task.text}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Lista</Text>
          {editing ? (
            <View style={styles.listOptions}>
              {lists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={[
                    styles.listOption,
                    task.listId === list.id && styles.selectedListOption,
                  ]}
                  onPress={() => setTask({ ...task, listId: list.id })}
                >
                  <Text
                    style={[
                      styles.listOptionText,
                      task.listId === list.id && styles.selectedListOptionText,
                    ]}
                  >
                    {list.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.text}>{currentList?.name || "Sem lista"}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Data de Vencimento</Text>
          {editing ? (
            <>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateButtonText}>
                  {task.dueDate
                    ? task.dueDate.toLocaleDateString("pt-BR")
                    : "Definir data"}
                </Text>
              </TouchableOpacity>
              {task.dueDate && (
                <TouchableOpacity
                  style={styles.removeDateButton}
                  onPress={removeDueDate}
                >
                  <Text style={styles.removeDateText}>Remover data</Text>
                </TouchableOpacity>
              )}
              {showDatePicker && (
                <DateTimePicker
                  value={task.dueDate || new Date()}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                />
              )}
            </>
          ) : (
            <Text style={[styles.text, !task.dueDate && styles.placeholder]}>
              {task.dueDate
                ? task.dueDate.toLocaleDateString("pt-BR")
                : "Sem data definida"}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notas</Text>
          {editing ? (
            <TextInput
              style={[styles.input, styles.textArea]}
              value={task.notes || ""}
              onChangeText={(notes) => setTask({ ...task, notes })}
              multiline
              numberOfLines={6}
              placeholder="Adicione notas..."
            />
          ) : (
            <Text style={[styles.text, !task.notes && styles.placeholder]}>
              {task.notes || "Nenhuma nota adicionada"}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <Text style={[styles.text, task.done && styles.completed]}>
            {task.done ? "Concluída" : "Pendente"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Criada em</Text>
          <Text style={styles.text}>
            {task.createdAt.toLocaleString("pt-BR")}
          </Text>
        </View>

        {editing && (
          <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
            <Text style={styles.saveButtonText}>Salvar Alterações</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    color: "#0a7ea4",
    marginLeft: 5,
    fontSize: 16,
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    color: "#0a7ea4",
    fontWeight: "600",
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#11181C",
    marginBottom: 30,
    textAlign: "center",
  },
  section: {
    marginBottom: 25,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#687076",
    marginBottom: 8,
  },
  text: {
    fontSize: 16,
    color: "#11181C",
    lineHeight: 24,
  },
  placeholder: {
    color: "#999",
    fontStyle: "italic",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
  },
  listOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  listOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  selectedListOption: {
    backgroundColor: "#0a7ea4",
  },
  listOptionText: {
    fontSize: 14,
    color: "#666",
  },
  selectedListOptionText: {
    color: "white",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#11181C",
  },
  removeDateButton: {
    marginTop: 8,
  },
  removeDateText: {
    color: "#ff6b6b",
    fontSize: 14,
  },
  completed: {
    color: "green",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});