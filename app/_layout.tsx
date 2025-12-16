import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDB } from "@/lib/db";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="todos.db" onInit={migrateDB}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{headerShown: false}} />
        <Stack.Screen name="task-details" options={{headerShown: false}} />
      </Stack>
    </SQLiteProvider>
  );
}