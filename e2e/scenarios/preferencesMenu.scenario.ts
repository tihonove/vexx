import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Preferences entry points: the File menu gains "Settings" and "Keyboard
// Shortcuts" (Ctrl+, / Ctrl+K Ctrl+S). Each opens the corresponding JSON file.
// An isolated --user-data-dir keeps the demo from touching the real ~/.vexx; the
// dir need not exist up front — the open-settings handler creates it on demand.

const userDataDir = join(tmpdir(), `vexx-prefs-demo-${process.pid}`);

export default defineScenario({
    name: "preferences-menu",
    title: "Open Settings / Keyboard Shortcuts from the File menu",
    open: ["--user-data-dir", userDataDir, repoRoot],
    cols: 120,
    rows: 32,
    async run(editor) {
        // File menu lists the two new commands with their shortcuts.
        await editor.sendKey("Alt+F");
        await editor.waitForText((t) => t.includes("Settings") && t.includes("Keyboard Shortcuts"));
        await editor.capture("menu");
        await editor.sendKey("Escape");

        // Ctrl+, seeds (on a fresh profile) and opens settings.json as an editor tab.
        await editor.sendKey("Ctrl+,");
        await editor.waitForText((t) => t.includes("settings.json"));
        await editor.capture("settings");
    },
});
