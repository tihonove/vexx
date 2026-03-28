import { TuiApplication } from "../Application/TuiApplication.ts";
import { BodyElement } from "../Elements/BodyElement.ts";
import type { MenuBarItem } from "../Elements/MenuBarElement.ts";
import { MenuBarElement } from "../Elements/MenuBarElement.ts";
import { VStackElement } from "../Elements/VStackElement.ts";
import { NodeTerminalBackend } from "../TerminalBackend/NodeTerminalBackend.ts";

import { FocusableBox } from "./FocusableBox.ts";

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

const body = new BodyElement();
const menuBar = new MenuBarElement(menuItems);
const stack = new VStackElement();

const labels = ["Inbox", "Drafts", "Sent", "Trash", "Settings"];
for (const label of labels) {
    stack.addChild(new FocusableBox(label), { width: "fill", height: 3 });
}

body.setMenuBar(menuBar);
body.setContent(stack);

const backend = new NodeTerminalBackend();
const app = new TuiApplication(backend);
app.root = body;
app.run();
