import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Close Editor lives in the File menu (as in VS Code), not in Go. The screenshot
// captures the File menu with an editor open — the entry sits in its own group
// right above Exit; the closing behaviour itself is covered by unit tests.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

export default defineScenario({
    name: "close-editor-menu",
    title: "Close Editor in the File menu",
    open: [repoRoot, sampleFile],
    cols: 120,
    rows: 32,
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        await editor.sendKey("Alt+F");
        await editor.waitForText((t) => t.includes("Close Editor") && t.includes("Exit"));
        await editor.capture("menu");
    },
});
