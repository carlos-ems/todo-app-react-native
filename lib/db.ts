import { SQLiteDatabase } from "expo-sqlite";

import * as crypto from "expo-crypto";
import { TodoItem } from "./types";

export async function migrateDB(db: SQLiteDatabase) {
  const DATABASE_VERSION = 1;

  const userVersionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  let currentDbVersion = userVersionRow?.user_version ?? 0;

  if (currentDbVersion === DATABASE_VERSION) return;

  if (currentDbVersion === 0) {
    console.log("Running initial database setup...");
    console.log(
      `Current DB version: ${currentDbVersion}, Target DB version: ${DATABASE_VERSION}`
    );
    initializeDB(db);
    currentDbVersion = 1;
  }

  //Outras atualizações de versão

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

async function initializeDB(db: SQLiteDatabase) {
  const todo1Id = crypto.randomUUID();
  const todo2Id = crypto.randomUUID();
  const todo3Id = crypto.randomUUID();

  db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS todos (id TEXT PRIMARY KEY, text TEXT NOT NULL, done INTEGER NOT NULL, createdAt TEXT NOT NULL);
        INSERT INTO todos (id, text, done, createdAt) VALUES ('${todo1Id}', 'Sample Todo from DB', 0, '2023-01-01T00:00:00Z');
        INSERT INTO todos (id, text, done, createdAt) VALUES ('${todo2Id}', 'Sample Todo 2 from DB', 1, '2023-01-02T00:00:00Z');
        INSERT INTO todos (id, text, done, createdAt) VALUES ('${todo3Id}', 'Sample Todo 3 from DB', 0, '2023-01-03T00:00:00Z');
    `);
}

export function getSQLiteVersion(db: SQLiteDatabase) {
  return db.getFirstAsync<{ "sqlite_version()": string }>(
    "SELECT sqlite_version()"
  );
}

export async function getDBVersion(db: SQLiteDatabase) {
  return await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
}

export async function getAllTodos(db: SQLiteDatabase): Promise<TodoItem[]> {
  const result = await db.getAllAsync<TodoItem>("SELECT * FROM todos;");
  return result;
}

export async function createTodo(
  db: SQLiteDatabase,
  text: string
): Promise<TodoItem> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const result = await db.getFirstAsync<TodoItem>(
    "INSERT INTO todos (id, text, done, createdAt) VALUES (?, ?, 0, ?) RETURNING id, text, done, createdAt;",
    [id, text, createdAt]
  );
  return result!;
}

export async function updateTodoStatus(
  db: SQLiteDatabase,
  id: string,
  done: boolean
): Promise<TodoItem | null> {
  const result = await db.getFirstAsync<TodoItem | null>(
    "UPDATE todos SET done = ? WHERE id = ? RETURNING id, text, done, createdAt;",
    [done ? 1 : 0, id]
  );

  return result;
}
