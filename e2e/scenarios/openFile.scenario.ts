import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Open File... / Open Folder...: the File menu gains two entries, and each opens
// a path-input prompt (QuickInput) that loads a file or swaps the workspace root.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

export default defineScenario({
    name: "open-file",
    title: "Open File / Open Folder via path input",
    open: [repoRoot, sampleFile],
    cols: 120,
    rows: 32,
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        // File menu now lists the two new commands with their shortcuts.
        await editor.sendKey("Alt+F");
        await editor.waitForText((t) => t.includes("Open File") && t.includes("Open Folder"));
        await editor.capture("menu");
        await editor.sendKey("Escape");

        // Ctrl+O pops the Open File path prompt.
        await editor.sendKey("Ctrl+O");
        await editor.waitForText((t) => t.includes("Open File") && t.includes("Enter a file path"));
        await editor.capture("prompt");
    },
});
