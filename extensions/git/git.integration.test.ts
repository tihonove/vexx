import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import type { IEditorDecorationsService } from "../../src/vs/workbench/api/common/editorDecorationsService.ts";
import type { IExtensionRegistration } from "../../src/vs/workbench/services/extensions/common/extensionEntry.ts";
import type { IFileDecorationsService } from "../../src/vs/workbench/api/common/fileDecorationsService.ts";
import type { IThemeColorResolver } from "../../src/vs/workbench/api/common/themeColorResolver.ts";
import type { IGutterChangeDecoration } from "../../src/vs/editor/common/model/gutterChangeDecoration.ts";
import { createExtensionTestHarness, type IExtensionHarness } from "../../src/TestUtils/ExtensionTestHarness.ts";
import { settle } from "../../src/TestUtils/timing.ts";

const GIT_MAIN = fileURLToPath(new URL("./main.ts", import.meta.url));

// Any resolvable colour ids the plugin references (git status → tree, diff → gutter).
const COLORS: Record<string, number> = {
    "editorGutter.addedBackground": 0x00ff00,
    "editorGutter.modifiedBackground": 0x0000ff,
    "editorGutter.deletedBackground": 0xff0000,
    "gitDecoration.modifiedResourceForeground": 0x11aabb,
    "gitDecoration.addedResourceForeground": 0x22cc33,
    "gitDecoration.deletedResourceForeground": 0xcc2211,
    "gitDecoration.untrackedResourceForeground": 0x33bb77,
};

function makeThemeResolver(): IThemeColorResolver {
    return { resolve: (id) => COLORS[id], onDidChange: () => ({ dispose: () => undefined }) };
}

function makeEditorSpy(): {
    service: IEditorDecorationsService;
    latestFor(suffix: string): readonly IGutterChangeDecoration[] | undefined;
} {
    const calls: { fileName: string; decorations: readonly IGutterChangeDecoration[] }[] = [];
    return {
        service: { setGutterChangeDecorations: (fileName, decorations) => calls.push({ fileName, decorations }) },
        latestFor: (suffix) => calls.filter((c) => c.fileName.endsWith(suffix)).at(-1)?.decorations,
    };
}

function makeFileSpy(): { service: IFileDecorationsService; latest(): { path: string; color?: number; badge?: string }[] | undefined } {
    const calls: { path: string; color?: number; badge?: string }[][] = [];
    return {
        service: { setFileDecorations: (entries) => calls.push([...entries]) },
        latest: () => calls.at(-1),
    };
}

function git(cwd: string, ...args: string[]): void {
    execFileSync("git", args, { cwd, stdio: "ignore" });
}

function makeRepo(dir: string): void {
    git(dir, "init", "-q");
    git(dir, "config", "user.email", "t@example.com");
    git(dir, "config", "user.name", "Test");
    git(dir, "config", "commit.gpgsign", "false");
    fs.writeFileSync(path.join(dir, "tracked.txt"), "a\nb\nc\n");
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "init");
    // Modify line 2 of the tracked file and add an untracked file.
    fs.writeFileSync(path.join(dir, "tracked.txt"), "a\nB\nc\n");
    fs.writeFileSync(path.join(dir, "untracked.txt"), "x\n");
}

function gitRegistration(): IExtensionRegistration {
    return {
        id: "vexx.git",
        manifest: { name: "git", publisher: "vexx", version: "0.1.0" },
        mainPath: GIT_MAIN,
        configDefaults: {
            "git.enabled": true,
            "git.decorations.enabled": true,
            "git.gutter.enabled": true,
            "git.refreshDebounce": 0,
        },
    };
}

/** Poll a condition across real-time settles (subprocess + real git are async). */
async function waitFor(predicate: () => boolean, timeoutMs = 4000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await settle(50);
    }
    return predicate();
}

describe("builtin git plugin (integration)", () => {
    let harness: IExtensionHarness | undefined;
    afterEach(async () => {
        await harness?.dispose();
        harness = undefined;
    });

    it("colours changed files in the tree and paints gutter bars for the active file", async () => {
        const editorSpy = makeEditorSpy();
        const fileSpy = makeFileSpy();
        harness = await createExtensionTestHarness({
            editorDecorations: editorSpy.service,
            fileDecorations: fileSpy.service,
            themeColorResolver: makeThemeResolver(),
        });
        makeRepo(harness.tmpDir);
        harness.group.openFile(path.join(harness.tmpDir, "tracked.txt"));

        await harness.host.registerExtension(gitRegistration());

        // Tree: both changed files decorated (M for modified, U for untracked).
        const gotFiles = await waitFor(() => {
            const entries = fileSpy.latest();
            return entries !== undefined && entries.some((e) => e.path.endsWith("tracked.txt") && e.badge === "M");
        });
        expect(gotFiles).toBe(true);
        const entries = fileSpy.latest()!;
        const tracked = entries.find((e) => e.path.endsWith("tracked.txt"));
        const untracked = entries.find((e) => e.path.endsWith("untracked.txt"));
        expect(tracked).toMatchObject({ badge: "M", color: COLORS["gitDecoration.modifiedResourceForeground"] });
        expect(untracked).toMatchObject({ badge: "U", color: COLORS["gitDecoration.untrackedResourceForeground"] });

        // Gutter: the modified line (2, i.e. 0-based line 1) gets a modified-colour bar.
        const gotGutter = await waitFor(() => {
            const decos = editorSpy.latestFor("tracked.txt");
            return decos !== undefined && decos.length > 0;
        });
        expect(gotGutter).toBe(true);
        const decos = editorSpy.latestFor("tracked.txt")!;
        expect(decos).toHaveLength(1);
        expect(decos[0].range.start.line).toBe(1);
        expect(decos[0].color).toBe(COLORS["editorGutter.modifiedBackground"]);
    });

    it("stays inert (no throw, no decorations) outside a git repository", async () => {
        const editorSpy = makeEditorSpy();
        const fileSpy = makeFileSpy();
        harness = await createExtensionTestHarness({
            initialFile: { name: "plain.txt", content: "hello\n" },
            editorDecorations: editorSpy.service,
            fileDecorations: fileSpy.service,
            themeColorResolver: makeThemeResolver(),
        });

        // tmpDir is NOT a git repo — activate must resolve without throwing or decorating.
        await harness.host.registerExtension(gitRegistration());
        await settle(300);
        expect(fileSpy.latest()).toBeUndefined();
        expect(editorSpy.latestFor("plain.txt")).toBeUndefined();
    });
});
