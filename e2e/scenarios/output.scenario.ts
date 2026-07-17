import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Output panel demo: open the bottom Panel's OUTPUT tab (channel log viewer over
// the in-memory RingBufferSink) via the Command Palette and screenshot it — the
// OUTPUT tab, the channel dropdown in the header, and the startup log lines.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

export default defineScenario({
    name: "output",
    title: "Output panel with channel selector",
    open: [repoRoot, sampleFile],
    cols: 120,
    rows: 32,
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        // Open the Output panel through the Command Palette (no dedicated binding yet).
        await editor.sendKey("Ctrl+Shift+P");
        await editor.sendText("Toggle Output");
        await editor.waitForText((t) => t.includes("Toggle Output"));
        await editor.sendKey("Enter");

        // The OUTPUT tab is active: channel dropdown in the header + startup log lines.
        await editor.waitForText((t) => t.includes("OUTPUT") && t.includes("vexx starting"));
        await editor.capture("panel");
    },
});
