import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../../../Common/GeometryPromitives.ts";
import { InMemoryFileClipboard } from "../../../Common/InMemoryFileClipboard.ts";
import { NULL_LOG_SERVICE } from "../../../Common/Logging/NullLogService.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../../Configuration/NullConfigurationService.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../../TestUtils/TempWorkspace.ts";
import { TestApp } from "../../../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../../Theme/WorkbenchTheme.ts";
import { CommandRegistry } from "../../Services/CommandRegistry.ts";
import { ExplorerService } from "../../Services/ExplorerService.ts";

import { ExplorerComponent } from "./ExplorerComponent.ts";

describe("ExplorerService — revealPath (через дерево ExplorerComponent)", () => {
    let ws: ITempWorkspace;
    let service: ExplorerService;
    let component: ExplorerComponent;
    let app: TestApp;

    beforeEach(async () => {
        ws = createTempWorkspace({
            prefix: "vexx-explorer-reveal-",
            files: { "src/deep/target.ts": "", "README.md": "" },
        });

        const clipboard = new InMemoryFileClipboard();
        service = new ExplorerService(clipboard, NULL_CONFIGURATION_SERVICE, NULL_LOG_SERVICE);
        component = new ExplorerComponent(
            service,
            new CommandRegistry(),
            clipboard,
            new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
        );
        service.setRootPath(ws.dir);
        app = TestApp.createWithContent(component.view, new Size(40, 15));
        await service.refresh();
        app.render();
    });

    afterEach(() => {
        component.dispose();
        service.dispose();
        ws.dispose();
    });

    it("expands ancestor directories and selects a nested file", async () => {
        // Collapsed initially — the nested file is not visible.
        expect(app.backend.screenToString()).not.toContain("target.ts");

        const targetPath = path.join(ws.dir, "src", "deep", "target.ts");
        const revealed = await service.revealPath(targetPath);
        app.render();

        expect(revealed).toBe(true);
        const output = app.backend.screenToString();
        expect(output).toContain("deep");
        expect(output).toContain("target.ts");
        // The revealed file becomes the tree cursor/selection.
        expect(service.getSelectedPaths()).toEqual([targetPath]);
    });

    it("reveals a top-level file without expanding subtrees", async () => {
        const targetPath = ws.path("README.md");
        const revealed = await service.revealPath(targetPath);
        app.render();

        expect(revealed).toBe(true);
        expect(service.getSelectedPaths()).toEqual([targetPath]);
        // No directory was expanded — the nested file stays hidden.
        expect(app.backend.screenToString()).not.toContain("target.ts");
    });

    it("returns false for a path outside the workspace root", async () => {
        const outside = path.join(os.tmpdir(), "vexx-elsewhere", "x.ts");
        expect(await service.revealPath(outside)).toBe(false);
    });

    it("returns false when filePath equals the root", async () => {
        expect(await service.revealPath(ws.dir)).toBe(false);
    });

    it("returns false before a root is assigned (no view)", async () => {
        const bare = new ExplorerService(new InMemoryFileClipboard(), NULL_CONFIGURATION_SERVICE, NULL_LOG_SERVICE);
        expect(await bare.revealPath("/anything.ts")).toBe(false);
        bare.dispose();
    });
});
