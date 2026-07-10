import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { IUserDataPaths } from "../Common/UserDataPaths.ts";
import { resolveUserDataPaths } from "../Common/UserDataPaths.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "./CommandRegistry.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { UserDataPathsDIToken } from "./Modules/UserDataPathsModule.ts";

/**
 * Команды открытия настроек/биндов (аналог VS Code openSettingsJson /
 * openGlobalKeybindingsFile). Проверяем через публичное поведение: файл появляется
 * на диске с дефолтным содержимым и открывается активной вкладкой редактора.
 */
describe("AppController — open settings / keybindings commands", () => {
    let tmpDir: string;
    let userDataPaths: IUserDataPaths;
    let controller: AppController;
    let commands: CommandRegistry;
    let group: EditorGroupController;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-prefs-"));
        userDataPaths = resolveUserDataPaths({ userDataDir: tmpDir, homedir: tmpDir });

        const { container, bindApp } = createTestContainer();
        // Изолируем пути user data во временный каталог, чтобы не трогать ~/.vexx.
        container.bind(UserDataPathsDIToken, () => userDataPaths);
        controller = container.get(AppControllerDIToken);
        controller.mount();
        const testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        await controller.activate();

        commands = container.get(CommandRegistryDIToken);
        group = container.get(EditorGroupControllerDIToken);
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("registers the settings and keybindings commands in the palette", () => {
        const ids = commands.listCommands().map((c) => c.id);
        expect(ids).toContain("workbench.action.openSettingsJson");
        expect(ids).toContain("workbench.action.openGlobalKeybindingsFile");
    });

    it("opens settings.json, creating it with a seed if missing", () => {
        expect(fs.existsSync(userDataPaths.settingsFile)).toBe(false);

        commands.execute("workbench.action.openSettingsJson");

        expect(fs.existsSync(userDataPaths.settingsFile)).toBe(true);
        expect(fs.readFileSync(userDataPaths.settingsFile, "utf-8")).toContain("{");
        expect(group.getActiveEditor()?.absoluteFilePath).toBe(userDataPaths.settingsFile);
        expect(group.getActiveEditor()?.fileName).toBe("settings.json");
    });

    it("opens keybindings.json, seeding an empty rules array", () => {
        commands.execute("workbench.action.openGlobalKeybindingsFile");

        expect(fs.existsSync(userDataPaths.keybindingsFile)).toBe(true);
        const content = fs.readFileSync(userDataPaths.keybindingsFile, "utf-8");
        expect(content).toContain("[");
        expect(content).toContain("]");
        expect(group.getActiveEditor()?.fileName).toBe("keybindings.json");
    });

    it("does not overwrite an existing settings.json", () => {
        fs.mkdirSync(path.dirname(userDataPaths.settingsFile), { recursive: true });
        fs.writeFileSync(userDataPaths.settingsFile, '{ "editor.tabSize": 2 }\n', "utf-8");

        commands.execute("workbench.action.openSettingsJson");

        expect(fs.readFileSync(userDataPaths.settingsFile, "utf-8")).toBe('{ "editor.tabSize": 2 }\n');
        expect(group.getActiveEditor()?.getText()).toContain('"editor.tabSize": 2');
    });

    it("reuses the same tab when opening settings.json twice", () => {
        commands.execute("workbench.action.openSettingsJson");
        const first = group.getActiveEditor();
        commands.execute("workbench.action.openSettingsJson");

        expect(group.getActiveEditor()).toBe(first);
    });
});
