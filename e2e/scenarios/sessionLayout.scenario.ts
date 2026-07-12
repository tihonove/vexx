import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Session state (open files, sidebar width, bottom-panel visibility/height) is
// persisted per workspace and restored on the next launch — see docs/arch/State.md.
// A screenshot spans a single session, so it can't show the *restart*; the round-trip
// itself is covered by unit + integration tests (StateService.test.ts,
// WorkbenchStateController.test.ts, AppController.StatePersistence.test.ts). This
// scenario documents the visible workbench state that gets captured: multiple open
// tabs plus the bottom panel toggled on.

const fileA = resolve(repoRoot, "e2e", "fixtures", "sample.ts");
const fileB = resolve(repoRoot, "e2e", "fixtures", "folding.ts");

export default defineScenario({
    name: "session-layout",
    title: "Persisted session layout: open tabs + bottom panel",
    open: [repoRoot, fileA, fileB],
    cols: 120,
    rows: 32,
    async run(editor) {
        // Two files opened from the CLI → two tabs in the editor group.
        await editor.waitForText((t) => t.includes("sample.ts") && t.includes("folding.ts"));
        await editor.capture("tabs");

        // Toggle the bottom panel (Ctrl+J) — its visibility/height are part of the
        // persisted per-workspace state.
        await editor.sendKey("Ctrl+J");
        await editor.waitForText((t) => t.includes("PROBLEMS"));
        await editor.capture("panel-open");
    },
});
