import { resolve } from "node:path";

import { packRgb } from "../../src/vs/base/common/color.ts";

import { defineScenario, repoRoot } from "./framework.ts";

// Git-status decorations in the file tree: a decorated file's name is tinted and
// gains a one-letter status badge at the right edge (M = modified, A = added,
// U = untracked). This chunk is the rendering primitive only — no git, no RPC —
// so the scenario pushes a sample decoration map straight at the controller via
// the inspector's setFileDecorations hook and screenshots the result.

// VS Code dark git-decoration foregrounds, pre-resolved to packed RGB (this
// primitive receives colours already resolved; theme wiring lives elsewhere).
const MODIFIED = packRgb(226, 192, 141); // gitDecoration.modifiedResourceForeground
const ADDED = packRgb(129, 184, 139); // gitDecoration.addedResourceForeground
const UNTRACKED = packRgb(115, 201, 145); // gitDecoration.untrackedResourceForeground

const rootPath = (rel: string): string => resolve(repoRoot, rel);

export default defineScenario({
    name: "file-tree-git",
    title: "Git status decorations in the file tree",
    open: [repoRoot],
    cols: 100,
    rows: 32,
    async run(editor) {
        // The explorer has loaded the workspace root.
        await editor.waitForText((t) => t.includes("AGENTS.md") && t.includes("src"));
        await editor.capture("plain");

        // Push a sample git-status map at root-level entries: coloured names + badges.
        await editor.setFileDecorations([
            { path: rootPath("src"), color: MODIFIED, badge: "M" },
            { path: rootPath("docs"), color: MODIFIED, badge: "M" },
            { path: rootPath("AGENTS.md"), color: MODIFIED, badge: "M" },
            { path: rootPath("package.json"), color: MODIFIED, badge: "M" },
            { path: rootPath("GOAL.md"), color: ADDED, badge: "A" },
            { path: rootPath("tsconfig.json"), color: ADDED, badge: "A" },
            { path: rootPath("CLAUDE.md"), color: UNTRACKED, badge: "U" },
            { path: rootPath("cliff.toml"), color: UNTRACKED, badge: "U" },
        ]);

        // The tree repaints with tinted names and right-edge badges.
        await editor.waitForText((t) => t.includes("AGENTS.md"));
        await editor.capture("decorated");
    },
});
