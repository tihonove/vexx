import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { FileTreeController } from "./FileTreeController.ts";

describe("FileTreeController — revealPath", () => {
    let ws: ITempWorkspace;
    let controller: FileTreeController;
    let app: TestApp;

    beforeEach(async () => {
        ws = createTempWorkspace({
            prefix: "vexx-ctrl-reveal-",
            files: { "src/deep/target.ts": "", "README.md": "" },
        });

        controller = new FileTreeController();
        controller.setRootPath(ws.dir);
        controller.mount();
        app = TestApp.createWithContent(controller.view, new Size(40, 15));
        await controller.activate();
        app.render();
    });

    afterEach(() => {
        controller.dispose();
        ws.dispose();
    });

    it("expands ancestor directories and selects a nested file", async () => {
        // Collapsed initially — the nested file is not visible.
        expect(app.backend.screenToString()).not.toContain("target.ts");

        const targetPath = path.join(ws.dir, "src", "deep", "target.ts");
        const revealed = await controller.revealPath(targetPath);
        app.render();

        expect(revealed).toBe(true);
        const output = app.backend.screenToString();
        expect(output).toContain("deep");
        expect(output).toContain("target.ts");
        // The revealed file becomes the tree cursor/selection.
        expect(controller.getSelectedPaths()).toEqual([targetPath]);
    });

    it("reveals a top-level file without expanding subtrees", async () => {
        const targetPath = ws.path("README.md");
        const revealed = await controller.revealPath(targetPath);
        app.render();

        expect(revealed).toBe(true);
        expect(controller.getSelectedPaths()).toEqual([targetPath]);
        // No directory was expanded — the nested file stays hidden.
        expect(app.backend.screenToString()).not.toContain("target.ts");
    });

    it("returns false for a path outside the workspace root", async () => {
        const outside = path.join(os.tmpdir(), "vexx-elsewhere", "x.ts");
        expect(await controller.revealPath(outside)).toBe(false);
    });

    it("returns false when filePath equals the root", async () => {
        expect(await controller.revealPath(ws.dir)).toBe(false);
    });

    it("returns false before a root is assigned", async () => {
        const bare = new FileTreeController();
        expect(await bare.revealPath("/anything.ts")).toBe(false);
        bare.dispose();
    });
});
