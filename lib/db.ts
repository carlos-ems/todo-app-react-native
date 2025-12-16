import { SQLiteDatabase } from "expo-sqlite";
import * as crypto from "expo-crypto";
import { TodoItem, TodoList } from "./types";

export async function migrateDB(db: SQLiteDatabase) {
  const DATABASE_VERSION = 2;

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
    await initializeDB(db);
    currentDbVersion = 1;
  }

  if (currentDbVersion === 1) {
    console.log("Upgrading database to version 2...");
    await upgradeToVersion2(db);
    currentDbVersion = 2;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

async function initializeDB(db: SQLiteDatabase) {
  const todo1Id = crypto.randomUUID();
  const todo2Id = crypto.randomUUID();
  const todo3Id = crypto.randomUUID();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY, 
      text TEXT NOT NULL, 
      done INTEGER NOT NULL, 
      createdAt TEXT NOT NULL
    );
    INSERT INTO todos (id, text, done, createdAt) VALUES ('${todo1Id}', 'Sample Todo from DB', 0, '2023-01-01T00:00:00Z');
    INSERT INTO todos (id, text, done, createdAt) VALUES ('${todo2Id}', 'Sample Todo 2 from DB', 1, '2023-01-02T00:00:00Z');
    INSERT INTO todos (id, text, done, createdAt) VALUES ('${todo3Id}', 'Sample Todo 3 from DB', 0, '2023-01-03T00:00:00Z');
  `);
}

async function upgradeToVersion2(db: SQLiteDatabase) {
  console.log("Running database upgrade to version 2...");
  
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS todo_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);

  try {
    await db.execAsync(`ALTER TABLE todos ADD COLUMN listId TEXT;`);
  } catch (e) {
    console.log("Column listId may already exist");
  }

  try {
    await db.execAsync(`ALTER TABLE todos ADD COLUMN notes TEXT;`);
  } catch (e) {
    console.log("Column notes may already exist");
  }

  try {
    await db.execAsync(`ALTER TABLE todos ADD COLUMN dueDate TEXT;`);
  } catch (e) {
    console.log("Column dueDate may already exist");
  }

  const defaultListExists = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM todo_lists WHERE id = 'default-list'"
  );

  if (!defaultListExists || defaultListExists.count === 0) {
    await db.execAsync(
      "INSERT INTO todo_lists (id, name) VALUES ('default-list', 'Todas as Tarefas');"
    );
  }

  await db.execAsync(
    "UPDATE todos SET listId = 'default-list' WHERE listId IS NULL;"
  );
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
  return result.map(todo => ({
    ...todo,
    createdAt: new Date(todo.createdAt),
    dueDate: todo.dueDate ? new Date(todo.dueDate) : undefined as any,
  }));
}

export async function getTodosByList(db: SQLiteDatabase, listId?: string): Promise<TodoItem[]> {
  let result: TodoItem[];
  
  if (listId) {
    result = await db.getAllAsync<TodoItem>(
      "SELECT * FROM todos WHERE listId = ?;",
      [listId]
    );
  } else {
    result = await db.getAllAsync<TodoItem>("SELECT * FROM todos;");
  }
  
  return result.map(todo => ({
    ...todo,
    createdAt: new Date(todo.createdAt),
    dueDate: todo.dueDate ? new Date(todo.dueDate) : undefined as any,
  }));
}

export async function getAllLists(db: SQLiteDatabase): Promise<TodoList[]> {
  const result = await db.getAllAsync<TodoList>("SELECT * FROM todo_lists ORDER BY name;");
  return result;
}

export async function createList(db: SQLiteDatabase, name: string): Promise<TodoList> {
  const id = crypto.randomUUID();
  const result = await db.getFirstAsync<TodoList>(
    "INSERT INTO todo_lists (id, name) VALUES (?, ?) RETURNING id, name;",
    [id, name]
  );
  return result!;
}

export async function createTodo(
  db: SQLiteDatabase,
  text: string,
  listId: string = 'default-list',
  notes?: string,
  dueDate?: Date
): Promise<TodoItem> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const dueDateString = dueDate ? dueDate.toISOString() : null;
  
  const result = await db.getFirstAsync<TodoItem>(
    `INSERT INTO todos (id, text, done, createdAt, listId, notes, dueDate) 
     VALUES (?, ?, 0, ?, ?, ?, ?) 
     RETURNING id, text, done, createdAt, listId, notes, dueDate;`,
    [id, text, createdAt, listId, notes || null, dueDateString]
  );

  return {
    ...result!,
    createdAt: new Date(result!.createdAt),
    dueDate: result!.dueDate ? new Date(result!.dueDate) : undefined as any,
  };
}

export async function updateTodoStatus(
  db: SQLiteDatabase,
  id: string,
  done: boolean
): Promise<TodoItem | null> {
  const result = await db.getFirstAsync<TodoItem | null>(
    "UPDATE todos SET done = ? WHERE id = ? RETURNING id, text, done, createdAt, listId, notes, dueDate;",
    [done ? 1 : 0, id]
  );

  if (!result) return null;

  return {
    ...result,
    createdAt: new Date(result.createdAt),
    dueDate: result.dueDate ? new Date(result.dueDate) : undefined as any,
  };
}

export async function updateTodo(
  db: SQLiteDatabase,
  id: string,
  updates: { text?: string; notes?: string; dueDate?: Date; listId?: string }
): Promise<TodoItem | null> {
  const todo = await db.getFirstAsync<TodoItem>("SELECT * FROM todos WHERE id = ?", [id]);
  if (!todo) return null;

  const text = updates.text ?? todo.text;
  const notes = updates.notes ?? todo.notes;
  const dueDate = updates.dueDate ? updates.dueDate.toISOString() : 
                 (todo.dueDate ? (typeof todo.dueDate === 'string' ? todo.dueDate : new Date(todo.dueDate).toISOString()) : null);
  const listId = updates.listId ?? todo.listId;

  const result = await db.getFirstAsync<TodoItem | null>(
    `UPDATE todos 
     SET text = ?, notes = ?, dueDate = ?, listId = ? 
     WHERE id = ? 
     RETURNING id, text, done, createdAt, notes, dueDate, listId;`,
    [text, notes || null, dueDate, listId, id]
  );

  if (!result) return null;

  return {
    ...result,
    createdAt: new Date(result.createdAt),
    dueDate: result.dueDate ? new Date(result.dueDate) : undefined as any,
  };
}