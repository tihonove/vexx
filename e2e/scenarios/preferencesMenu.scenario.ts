import { defineScenario, repoRoot } from "./framework.ts";

// Preferences entry points: the File menu gains "Settings" and "Keyboard
// Shortcuts", each showing its default shortcut (Ctrl+, / Ctrl+K Ctrl+S) and
// opening the corresponding JSON file. The screenshot captures the menu — the
// visible surface of the feature; the open/seed behaviour is covered by unit
// tests (Ctrl+, can't be encoded through the terminal-input DSL headless).

export default defineScenario({
    name: "preferences-menu",
    title: "Settings / Keyboard Shortcuts in the File menu",
    open: [repoRoot],
    cols: 120,
    rows: 32,
    async run(editor) {
        await editor.sendKey("Alt+F");
        await editor.waitForText((t) => t.includes("Settings") && t.includes("Keyboard Shortcuts"));
        await editor.capture("menu");
    },
});
