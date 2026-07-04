import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import type { IConfigurationService } from "../Configuration/IConfigurationService.ts";
import { IConfigurationServiceDIToken } from "../Configuration/IConfigurationServiceDIToken.ts";
import { NULL_CONFIGURATION_SERVICE } from "../Configuration/NullConfigurationService.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

let savedXdg: string | undefined;
let tmpDir: string;

// Дерево: dirs-first → row 0 = "target/", row 1 = "a.txt".
function createWorkspace(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-del-confirm-"));
    fs.mkdirSync(path.join(dir, "target"));
    fs.writeFileSync(path.join(dir, "a.txt"), "hello");
    // Изолированная корзина, чтобы не трогать ~/.local.
    process.env.XDG_DATA_HOME = path.join(dir, ".xdg");
    return dir;
}

/** Конфиг-стаб: заданные ключи возвращают свои значения, остальные — default. */
function stubConfig(values: Record<string, unknown>): IConfigurationService {
    return {
        ...NULL_CONFIGURATION_SERVICE,
        get<T>(key: string, defaultValue?: T): T | undefined {
            if (key in values) return values[key] as T;
            return defaultValue;
        },
    };
}

interface Ctx {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
}

function createApp(workspaceDir: string | null, config?: IConfigurationService): Ctx {
    const { container, bindApp } = createTestContainer();
    if (config) {
        container.bind(IConfigurationServiceDIToken, () => config);
    }
    const controller = container.get(AppControllerDIToken);
    if (workspaceDir !== null) controller.setWorkspaceFolder(workspaceDir);
    controller.mount();
    const testApp = TestApp.create(controller.view, new Size(80, 24));
    bindApp(testApp.app);
    return { testApp, controller, commands: container.get(CommandRegistryDIToken) };
}

beforeEach(() => {
    savedXdg = process.env.XDG_DATA_HOME;
    tmpDir = createWorkspace();
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = savedXdg;
});

async function activate(ctx: Ctx): Promise<void> {
    await ctx.controller.activate();
    ctx.testApp.render();
    ctx.testApp.querySelector("TreeViewElement")!.focus();
    ctx.testApp.render();
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe.skipIf(process.platform !== "linux")("Delete confirmations — explorer.confirmDelete", () => {
    it("deletes to trash immediately when explorer.confirmDelete=false", async () => {
        const ctx = createApp(tmpDir, stubConfig({ "explorer.confirmDelete": false }));
        await activate(ctx);
        const alpha = path.join(tmpDir, "a.txt");

        ctx.commands.execute("fileOperations.deleteFile", alpha);
        ctx.testApp.render();

        expect(ctx.testApp.querySelector("ConfirmDialogElement")).toBeNull();
        expect(fs.existsSync(alpha)).toBe(false);
        ctx.controller.dispose();
    });

    it("treats a missing confirmDelete setting as true and asks", async () => {
        // Конфиг возвращает undefined для всех ключей — сервис должен подставить true сам.
        const ctx = createApp(tmpDir, { ...NULL_CONFIGURATION_SERVICE, get: () => undefined });
        await activate(ctx);
        const alpha = path.join(tmpDir, "a.txt");

        ctx.commands.execute("fileOperations.deleteFile", alpha);
        ctx.testApp.render();

        expect(ctx.testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        expect(fs.existsSync(alpha)).toBe(true);
        ctx.controller.dispose();
    });

    it("cancelling the dialog keeps the file", async () => {
        const ctx = createApp(tmpDir);
        await activate(ctx);
        const alpha = path.join(tmpDir, "a.txt");

        ctx.commands.execute("fileOperations.deleteFile", alpha);
        ctx.testApp.render();
        expect(ctx.testApp.querySelector("ConfirmDialogElement")).not.toBeNull();

        ctx.testApp.sendKey("Escape");
        ctx.testApp.render();

        expect(ctx.testApp.querySelector("ConfirmDialogElement")).toBeNull();
        expect(fs.existsSync(alpha)).toBe(true);
        ctx.controller.dispose();
    });

    it("deleteFile without an argument deletes the tree selection", async () => {
        const ctx = createApp(tmpDir);
        await activate(ctx);
        const alpha = path.join(tmpDir, "a.txt");

        ctx.testApp.sendKey("ArrowDown"); // курсор на a.txt
        ctx.commands.execute("fileOperations.deleteFile");
        ctx.testApp.render();
        ctx.testApp.sendKey("Enter"); // дефолтная кнопка — "Move to Trash"
        ctx.testApp.render();

        expect(fs.existsSync(alpha)).toBe(false);
        ctx.controller.dispose();
    });
});

describe("Delete confirmations — permanent delete (no trash)", () => {
    it("warns about permanent deletion and defaults to Cancel", async () => {
        const ctx = createApp(tmpDir, stubConfig({ "files.enableTrash": false }));
        await activate(ctx);
        const alpha = path.join(tmpDir, "a.txt");

        ctx.commands.execute("fileOperations.deleteFile", alpha);
        ctx.testApp.render();

        expect(ctx.testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        expect(ctx.testApp.backend.screenToString()).toContain("Delete Permanently");

        // Дефолтная кнопка — Cancel: Enter закрывает диалог, файл остаётся.
        ctx.testApp.sendKey("Enter");
        ctx.testApp.render();
        expect(ctx.testApp.querySelector("ConfirmDialogElement")).toBeNull();
        expect(fs.existsSync(alpha)).toBe(true);
        ctx.controller.dispose();
    });

    it("confirming deletes permanently and records nothing to undo", async () => {
        const ctx = createApp(tmpDir, stubConfig({ "files.enableTrash": false }));
        await activate(ctx);
        const alpha = path.join(tmpDir, "a.txt");

        ctx.commands.execute("fileOperations.deleteFile", alpha);
        ctx.testApp.render();
        ctx.testApp.sendKey("ArrowLeft"); // фокус на "Delete Permanently"
        ctx.testApp.sendKey("Enter");
        ctx.testApp.render();

        expect(fs.existsSync(alpha)).toBe(false);

        // Безвозвратное удаление не отменяемо — undo ничего не возвращает.
        ctx.commands.execute("fileOperations.undo");
        await flush();
        expect(fs.existsSync(alpha)).toBe(false);
        ctx.controller.dispose();
    });
});

describe.skipIf(process.platform !== "linux")("Workspace undo — confirmation edge cases", () => {
    it("undo with an empty history is a no-op", async () => {
        const ctx = createApp(tmpDir);
        await activate(ctx);

        expect(() => ctx.commands.execute("fileOperations.undo")).not.toThrow();
        ctx.testApp.render();
        expect(ctx.testApp.querySelector("ConfirmDialogElement")).toBeNull();
        ctx.controller.dispose();
    });

    it("treats a missing confirmUndo setting as true and asks before a destructive undo", async () => {
        const ctx = createApp(tmpDir, { ...NULL_CONFIGURATION_SERVICE, get: () => undefined });
        await activate(ctx);

        // Копируем и вставляем a.txt в target/ — undo такой операции деструктивен.
        ctx.testApp.sendKey("ArrowDown"); // a.txt
        ctx.commands.execute("fileOperations.copy");
        ctx.testApp.sendKey("ArrowUp"); // target/
        ctx.commands.execute("fileOperations.paste");
        expect(fs.existsSync(path.join(tmpDir, "target", "a.txt"))).toBe(true);

        ctx.commands.execute("fileOperations.undo");
        ctx.testApp.render();

        expect(ctx.testApp.querySelector("ConfirmDialogElement")).not.toBeNull();
        ctx.controller.dispose();
    });
});

describe("File operations without a workspace root (empty selection)", () => {
    it("paste is a no-op (no target directory)", () => {
        const ctx = createApp(null);
        expect(() => ctx.commands.execute("fileOperations.paste")).not.toThrow();
        ctx.controller.dispose();
    });

    it("copy and cut do nothing without a selection", () => {
        const ctx = createApp(null);
        ctx.commands.execute("fileOperations.copy");
        ctx.commands.execute("fileOperations.cut");

        // Буфер пуст → правый клик по несуществующему дереву невозможен; проверяем
        // косвенно: paste после copy/cut без selection всё ещё no-op.
        expect(() => ctx.commands.execute("fileOperations.paste")).not.toThrow();
        ctx.controller.dispose();
    });

    it("deleteFile without an argument and without a selection is a no-op", () => {
        const ctx = createApp(null);
        ctx.commands.execute("fileOperations.deleteFile");
        ctx.testApp.render();

        expect(ctx.testApp.querySelector("ConfirmDialogElement")).toBeNull();
        ctx.controller.dispose();
    });
});

describe.skipIf(process.platform !== "linux")("Workspace redo — empty history", () => {
    it("redo with an empty history is a no-op", async () => {
        const ctx = createApp(tmpDir);
        await activate(ctx);

        expect(() => ctx.commands.execute("fileOperations.redo")).not.toThrow();
        await flush();
        // Файлы на месте, ничего не «повторилось».
        expect(fs.existsSync(path.join(tmpDir, "a.txt"))).toBe(true);
        ctx.controller.dispose();
    });
});
