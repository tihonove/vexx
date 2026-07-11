import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { SettingsResourceDIToken } from "./CoreTokens.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { ProblemsController, ProblemsControllerDIToken } from "./ProblemsController.ts";

const UNKNOWN_SETTINGS = ['{', '    "editor.tabSize": 2,', '    "editor.fontSize": 12', "}"].join("\n");

const flush = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0));
};

describe("AppController — Problems view end-to-end", () => {
    let tmpDir: string;
    let controller: AppController;
    let commands: CommandRegistry;
    let testApp: TestApp;
    let problems: ProblemsController;
    let panelBg: number;
    let settingsPath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-problems-e2e-"));
        settingsPath = path.join(tmpDir, "settings.json");
        fs.writeFileSync(settingsPath, UNKNOWN_SETTINGS, "utf-8");

        const { container, bindApp } = createTestContainer();
        container.bind(SettingsResourceDIToken, () => settingsPath);
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(90, 22));
        bindApp(testApp.app);
        commands = container.get(CommandRegistryDIToken);
        problems = container.get(ProblemsControllerDIToken);
        panelBg = container.get(ThemeServiceDIToken).theme.getRequiredColor("panel.background");
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("paints, focuses and keyboard-navigates the Problems tree (regression: 3 bugs)", async () => {
        commands.execute("workbench.openFile", settingsPath); // produces a marker via the settings validator
        await flush();
        testApp.render();
        commands.execute("workbench.actions.view.problems");
        await flush();
        testApp.render();

        const screen = testApp.backend.screenToString();
        expect(screen).toContain("settings.json  (1)");
        expect(screen).toContain("Unknown Configuration Setting: editor.fontSize");

        // Bug 1 — the panel subtree's style is resolved (tree bg = panel bg, not the
        // unresolved default), so the tree area is actually painted.
        expect(problems.tree.resolvedStyle.bg).toBe(panelBg);

        // Bug 2 — the tree captured focus (both as active element and visually).
        expect(controller.view.focusManager?.activeElement).toBeInstanceOf(TreeViewElement);
        expect(problems.tree.isFocused).toBe(true);

        // Bug 3 — keyboard navigation works: ArrowDown moves the selection.
        const before = problems.tree.getSelectedNode();
        testApp.sendKey("ArrowDown");
        await flush();
        testApp.render();
        expect(problems.tree.getSelectedNode()).not.toEqual(before);
    });

    it("shows the empty-state placeholder when there are no problems", () => {
        commands.execute("workbench.actions.view.problems");
        testApp.render();
        expect(testApp.backend.screenToString()).toContain("No problems have been detected in the workspace.");
    });
});
