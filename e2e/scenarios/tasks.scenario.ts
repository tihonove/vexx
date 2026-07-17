import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineScenario } from "./framework.ts";

// Tasks + problem matcher: run a build task from `.vscode/tasks.json` in the dedicated
// TASK terminal tab, then watch its output get parsed by the `$tsc` matcher into the
// Problems panel. The task just `echo`s a canonical tsc error line — no real compiler —
// so the demo is deterministic and Unix-only (node-pty spawns a real PTY).
//
// The workspace is seeded in a temp dir at import time (its path must be known when the
// spec's `open` is read, before `run`). Commands are reached tier-independently through
// the View menu (Alt+V → Command Palette), the entry point that always works.

const workspace = mkdtempSync(join(tmpdir(), "vexx-tasks-"));
mkdirSync(join(workspace, ".vscode"), { recursive: true });
const tscErrorLine = "app.ts(3,5): error TS2322: Type 'number' is not assignable to type 'string'.";
writeFileSync(
    join(workspace, ".vscode", "tasks.json"),
    JSON.stringify(
        {
            version: "2.0.0",
            tasks: [
                {
                    label: "demo-build",
                    type: "shell",
                    command: `echo "${tscErrorLine}"`,
                    group: "build",
                    problemMatcher: "$tsc",
                },
            ],
        },
        null,
        2,
    ),
);
writeFileSync(join(workspace, "app.ts"), "const greeting: string =\n    // line 3 has the type error\n    42;\n");

export default defineScenario({
    name: "tasks",
    title: "Tasks + problem matcher: build output → Problems panel",
    open: [workspace],
    cols: 120,
    rows: 32,
    env: {
        SHELL: "/bin/bash",
        PS1: "vexx$ ",
        PROMPT_COMMAND: "",
    },
    // node-pty spawns a real PTY — Unix-only in the current packaging.
    skipOn: ["win32", "darwin"],
    async run(editor) {
        // Run the build task via the palette (Alt+V → Command Palette → "Run Build Task").
        await editor.sendKey("Alt+V");
        await editor.waitForText((t) => t.includes("Command Palette"));
        await editor.sendKey("Enter");
        await editor.waitForText((t) => t.includes("File: Save"));
        await editor.sendText("Run Build Task");
        await editor.waitForText((t) => t.includes("Run Build Task"));
        await editor.sendKey("Enter");

        // The dedicated TASK tab shows the command's live output (the echoed error line).
        await editor.waitForText((t) => t.includes("TASK"));
        await editor.waitForText((t) => t.includes("not assignable"));
        await editor.capture("tasks-terminal");

        // The matcher parsed that line into a diagnostic: open Problems and see it there.
        await editor.sendKey("Alt+V");
        await editor.waitForText((t) => t.includes("Command Palette"));
        await editor.sendKey("Enter");
        await editor.waitForText((t) => t.includes("File: Save"));
        await editor.sendText("Toggle Problems");
        await editor.waitForText((t) => t.includes("Toggle Problems"));
        await editor.sendKey("Enter");

        // Problems tree: `app.ts (1)` → `Type 'number' is not assignable ... [Ln 3, Col 5]`.
        await editor.waitForText((t) => t.includes("app.ts") && t.includes("not assignable"));
        await editor.capture("tasks-problems");
    },
});
