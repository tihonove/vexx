import { useState, useEffect } from "react";
import { render, Text, Box, useInput, useApp } from "ink";

function Counter() {
    const [count, setCount] = useState(0);
    const { exit } = useApp();

    useEffect(() => {
        const timer = setInterval(() => {
            setCount((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useInput((input, key) => {
        if (input === "q" || key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Box borderStyle="round" borderColor="cyan" paddingX={2}>
                <Text bold color="green">
                    🚀 vscode-tui Demo App
                </Text>
            </Box>
            <Box marginTop={1}>
                <Text>
                    Timer: <Text color="yellow" bold>{count}</Text> seconds
                </Text>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>Press 'q' or Esc to exit</Text>
            </Box>
        </Box>
    );
}

render(<Counter />);
