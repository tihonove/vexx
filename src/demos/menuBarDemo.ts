import { TuiApplication } from "../Application/TuiApplication.ts";
import { BoxElement } from "../Elements/BoxElement.ts";
import type { MenuBarItem } from "../Elements/MenuBarElement.ts";
import { MenuBarElement } from "../Elements/MenuBarElement.ts";
import { NodeTerminalBackend } from "../TerminalBackend/NodeTerminalBackend.ts";

const menuItems: MenuBarItem[] = [
    {
        label: "File",
        mnemonic: "f",
        entries: [
            { label: "New File", shortcut: "Ctrl+N" },
            { label: "Open File", shortcut: "Ctrl+O" },
            { type: "separator" },
            { label: "Save", shortcut: "Ctrl+S" },
            { label: "Save As...", shortcut: "Ctrl+Shift+S" },
            { type: "separator" },
            { label: "Exit", shortcut: "Ctrl+Q" },
        ],
    },
    {
        label: "Edit",
        mnemonic: "e",
        entries: [
            { label: "Undo", shortcut: "Ctrl+Z" },
            { label: "Redo", shortcut: "Ctrl+Shift+Z" },
            { type: "separator" },
            { label: "Cut", shortcut: "Ctrl+X" },
            { label: "Copy", shortcut: "Ctrl+C" },
            { label: "Paste", shortcut: "Ctrl+V" },
        ],
    },
    {
        label: "View",
        mnemonic: "v",
        entries: [
            { label: "Toggle Sidebar" },
            { label: "Toggle Terminal" },
            { type: "separator" },
            { label: "Zoom In", shortcut: "Ctrl+=" },
            { label: "Zoom Out", shortcut: "Ctrl+-" },
        ],
    },
    {
        label: "Help",
        mnemonic: "h",
        entries: [{ label: "About" }],
    },
];

const menuBar = new MenuBarElement(menuItems);
const content = new BoxElement();
menuBar.setContent(content);

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
app.root = menuBar;
app.run();

// Open "File" menu on start (simulate Alt+F)
process.stdin.push("\x1bf");
