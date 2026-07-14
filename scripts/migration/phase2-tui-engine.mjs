/**
 * Фаза 2: tui-движок — Rendering/Input/Backend → src/vs/tui/*.
 * «Движок браузера» vexx: слой вне vscode-стека (см. docs/VSCODE_STRUCTURE_MIGRATION.md §5).
 */
export const moves = [
    { dir: "src/Rendering", to: "src/vs/tui/rendering" },
    { dir: "src/Input", to: "src/vs/tui/input" },
    // Backend: интерфейс переименовываем по vscode-конвенции (интерфейсный файл без I-префикса)
    ["src/Backend/ITerminalBackend.ts", "src/vs/tui/backend/terminalBackend.ts"],
    ["src/Backend/NodeTerminalBackend.ts", "src/vs/tui/backend/nodeTerminalBackend.ts"],
    ["src/Backend/MockTerminalBackend.ts", "src/vs/tui/backend/mockTerminalBackend.ts"],
    ["src/Backend/HeadlessCaptureBackend.ts", "src/vs/tui/backend/headlessCaptureBackend.ts"],
];

export const stringPrefixes = [
    ["src/Rendering/", "src/vs/tui/rendering/"],
    ["src/Input/", "src/vs/tui/input/"],
    ["src/Backend/", "src/vs/tui/backend/"],
];
