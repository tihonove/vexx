import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Find-in-file widget (Ctrl+F): a bordered dock at the top-right of the editor
// group with a query input, a match counter and ↑ ↓ ✕ buttons. Since the
// FindWidgetElement dissolve, the widget is a Workbench component composed from
// primitives (SizedBox → BoxContainer → HFlex + Input/Button) and coloured from
// the active theme (`editorWidget.*`), so this shot verifies the themed look.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

async function typeText(editor: { sendKey(name: string): Promise<void> }, text: string): Promise<void> {
    for (const ch of text) {
        await editor.sendKey(ch);
    }
}

export default defineScenario({
    name: "find",
    title: "Find-in-file (Ctrl+F) with match counter and «No results»",
    open: [repoRoot, sampleFile],
    cols: 100,
    rows: 24,
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));
        await editor.capture("editor");

        // Open Find and type a query that matches twice ("greeting" on the
        // declaration and the return) — the counter reads "1 of 2".
        await editor.sendKey("Ctrl+F");
        await typeText(editor, "greeting");
        await editor.waitForText((t) => t.includes("of 2"));
        await editor.capture("find-matches");

        // Replace the query with something absent → the counter turns to
        // "No results" in the theme's error colour.
        for (let i = 0; i < "greeting".length; i++) {
            await editor.sendKey("Backspace");
        }
        await typeText(editor, "zzz");
        await editor.waitForText((t) => t.includes("No results"));
        await editor.capture("find-no-results");
    },
});
