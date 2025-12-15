export type uuid = string;

export type TodoItem = {
    id: uuid;
    text: string;
    done: boolean,
    createdAt: Date,

    listId: uuid,
    notes?: string,
    dueDate: Date
};

export type TodoList = {
    id: uuid,
    name: string
};