import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Fold chevrons reveal on gutter hover (à la VS Code showFoldingControls:
// "mouseover"). The headless driver can't move the mouse, so the screenshots
// document the resting state — which is the visible change: the gutter is no
// longer filled with a column of "expanded" chevrons. Collapsed regions still
// show their chevron so hidden code stays discoverable.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "folding.ts");

export default defineScenario({
    name: "folding-chevrons",
    title: "Fold chevrons hidden at rest, collapsed one stays",
    open: [repoRoot, sampleFile],
    cols: 100,
    rows: 20,
    async run(editor) {
        // Every function body is foldable, yet at rest (mouse outside the gutter)
        // no expanded chevron is drawn — a clean gutter.
        await editor.waitForText((t) => t.includes("alpha"));
        await editor.capture("rest");

        // Move the cursor into alpha's body (line 0 is a comment, alpha's region is
        // lines 1..3) and toggle-fold it with the Ctrl+K Ctrl+L chord — both keys
        // are Ctrl+letter, so the headless key DSL can inject them (Ctrl+Shift+[
        // can't be serialized). alpha's header keeps a chevron + the ⋯ marker;
        // beta/gamma stay chevron-less at rest.
        await editor.sendKey("ArrowDown");
        await editor.sendKey("Ctrl+K");
        await editor.sendKey("Ctrl+L");
        // Fold applied once alpha's body is hidden (width-independent check; the
        // ⋯ marker's column depends on the pane width).
        await editor.waitForText((t) => !t.includes("const doubled"));
        await editor.capture("one-folded");
    },
});
