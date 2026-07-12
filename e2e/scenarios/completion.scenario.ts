import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Suggest popup, VS Code-style: the editor keeps focus and the caret while the
// completion list opens automatically as you type (auto-suggest) and filters by
// the word prefix under the caret.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "completion.txt");

/** Number of times `needle` occurs in `haystack`. */
function count(haystack: string, needle: string): number {
    return haystack.split(needle).length - 1;
}

export default defineScenario({
    name: "completion",
    title: "Auto-suggest popup (editor keeps focus)",
    open: [repoRoot, sampleFile],
    cols: 100,
    rows: 24,
    async run(editor) {
        await editor.waitForText((t) => t.includes("insert_final_newline"));
        await editor.capture("editor");

        // Move to the empty last line and type a word prefix — the popup opens by
        // itself (auto-suggest) and filters to matching words from the document.
        await editor.sendKey("ArrowDown");
        await editor.sendKey("ArrowDown");
        await editor.sendKey("ArrowDown");
        await editor.sendKey("i");
        await editor.sendKey("n");
        await editor.sendKey("d");

        // The popup renders a second copy of "indent_style" (editor line 0 + the
        // suggestion row), so a count >= 2 means the list is open.
        await editor.waitForText((t) => count(t, "indent_style") >= 2, { timeoutMs: 2000 });
        await editor.capture("suggest");
    },
});
