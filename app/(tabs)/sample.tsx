import React, { useEffect } from "react";

import {
    Text,
    View
} from "react-native";
import { GestureHandlerRootView, RefreshControl, ScrollView } from "react-native-gesture-handler";

type TodoSample = {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
}

export default function Sample() {

    const [todos, setTodos] = React.useState<TodoSample[]>([]);
    const [refreshing, setRefreshing] = React.useState(false);
    const [placeholderText, setPlaceholderText] = React.useState("Nada aqui...");

    useEffect(() => {
        async function loadItems() {
            const result = await fetch('https://jsonplaceholder.typicode.com/todos')
                .then((response) => response.json());
            setTodos(result);
        }

        loadItems();
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
        }, 2000);
    }, []);

    const isCloseToBottom = ({layoutMeasurement, contentOffset, contentSize}) => {
        const paddingToBottom = 20;
        return layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom;
    };

    return (
        <GestureHandlerRootView style={{ flex: 1, paddingTop: 50 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Sample Todo Page</Text>
            <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>{placeholderText}</Text>
            
            <ScrollView style={{ flex: 1, padding: 20 }}
                onScroll={({nativeEvent}) => {
                if (isCloseToBottom(nativeEvent)) {
                    setPlaceholderText("This is the end, my friend...");
                }
                }}
                scrollEventThrottle={400}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                
            >
                {todos.map((todo) => (
                    <View key={todo.id} style={{ marginBottom: 10 }}>
                        <Text style={{ fontWeight: 'bold' }}>{todo.title}</Text>
                        <Text>{todo.completed ? 'Completed' : 'Pending'}</Text>
                    </View>
                ))}
            </ScrollView>

        </GestureHandlerRootView>
    );
}