import { resolve } from "node:path";

import { defineScenario, repoRoot } from "./framework.ts";

// Gutter change-bars (the SCM/git dirty-diff primitive): a thin coloured bar in
// the fold margin (just left of the chevron) marks changed lines. This core
// chunk has no git wiring yet, so the scenario pushes decorations straight to
// the active editor with literal packed-RGB colours (VS Code's dirty-diff
// defaults) and captures the painted gutter: added lines green (solid bar),
// modified blue (dashed bar), a deleted-hunk boundary red on a single line.

const sampleFile = resolve(repoRoot, "e2e", "fixtures", "sample.ts");

// VS Code dark `editorGutter.{added,modified,deleted}Background` (packed RGB).
const ADDED = 0x487e02;
const MODIFIED = 0x1b81a8;
const DELETED = 0xf14c4c;

export default defineScenario({
    name: "git-gutter",
    title: "Gutter change-bars (added / modified / deleted)",
    open: [repoRoot, sampleFile],
    cols: 100,
    rows: 20,
    async run(editor) {
        await editor.waitForText((t) => t.includes("greeting"));

        // Logical lines are 0-based: line 1 modified, lines 3..4 added, line 5 a
        // deleted-hunk boundary (a single line).
        await editor.setGutterChangeDecorations([
            { startLine: 1, endLine: 1, color: MODIFIED, dashed: true },
            { startLine: 3, endLine: 4, color: ADDED },
            { startLine: 5, endLine: 5, color: DELETED },
        ]);

        await editor.capture("bars");
    },
});
