import React, { useEffect, useState } from "react";
import {Text, View, StyleSheet, TouchableOpacity, FlatList, Modal, TextInput, Alert } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TodoList } from "@/lib/types";
import { getAllLists, createList } from "@/lib/db";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/IconSymbol";

export default function ListsScreen() {
  const db = useSQLiteContext();
  const [lists, setLists] = useState<TodoList[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    loadLists();
  }, [db]);

  const loadLists = async () => {
    try {
      const result = await getAllLists(db);
      setLists(result);
    } catch (error) {
      console.error("Error loading lists:", error);
      Alert.alert("Erro", "Não foi possível carregar as listas");
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert("Erro", "Por favor, digite um nome para a lista");
      return;
    }

    try {
      const newList = await createList(db, newListName.trim());
      setLists([...lists, newList]);
      setNewListName("");
      setModalVisible(false);
      Alert.alert("Sucesso", "Lista criada com sucesso!");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível criar a lista");
    }
  };

  const handleListPress = (listId: string) => {
    router.push({
      pathname: "/(tabs)",
      params: { listId }
    });
  };

  const renderItem = ({ item }: { item: TodoList }) => (
    <TouchableOpacity 
      style={styles.listItem}
      onPress={() => handleListPress(item.id)}
    >
      <View style={styles.listContent}>
        <IconSymbol name="list.bullet" size={24} color="#0a7ea4" />
        <Text style={styles.listName}>{item.name}</Text>
      </View>
      <IconSymbol name="chevron.right" size={20} color="#687076" />
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.title}>Minhas Listas</Text>
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => setModalVisible(true)}
            >
                <IconSymbol name="plus" size={24} color="white" />
            </TouchableOpacity>
        </View>

        <FlatList
            data={lists}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Nenhuma lista criada</Text>
                <Text style={styles.emptySubtext}>Clique no botão + para criar uma nova lista</Text>
              </View>
            }
        />

        <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            onRequestClose={() => setModalVisible(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Nova Lista</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nome da lista"
                        value={newListName}
                        onChangeText={setNewListName}
                        autoFocus
                        onSubmitEditing={handleCreateList}
                        returnKeyType="done"
                    />
                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[styles.button, styles.cancelButton]}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.createButton]}
                            onPress={handleCreateList}
                        >
                            <Text style={styles.createButtonText}>Criar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    </GestureHandlerRootView>
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
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#11181C",
  },
  addButton: {
    backgroundColor: "#0a7ea4",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  listContainer: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  listContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listName: {
    fontSize: 18,
    color: "#11181C",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    width: "80%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
  },
  createButton: {
    backgroundColor: "#0a7ea4",
  },
  createButtonText: {
    color: "white",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#adb5bd",
    textAlign: "center",
  },
});