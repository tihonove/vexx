import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IConfigurationService } from "../../Configuration/IConfigurationService.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";

import { TrashService } from "./TrashService.ts";
import { UndoRedoService, WORKSPACE_UNDO_CONTEXT } from "./UndoRedoService.ts";
import { WorkspaceEditService } from "./WorkspaceEditService.ts";

let tmpDir: string;
let savedXdg: string | undefined;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-wes-"));
    savedXdg = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = path.join(tmpDir, "data");
});

afterEach(() => {
    if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = savedXdg;
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function configWith(enableTrash: boolean): IConfigurationService {
    return {
        ...NULL_CONFIGURATION_SERVICE,
        get<T>(key: string, def?: T): T | undefined {
            return key === "files.enableTrash" ? (enableTrash as unknown as T) : def;
        },
    };
}

function makeService(enableTrash = true): { service: WorkspaceEditService; undoRedo: UndoRedoService } {
    const undoRedo = new UndoRedoService();
    const service = new WorkspaceEditService(undoRedo, new TrashService(), configWith(enableTrash));
    return { service, undoRedo };
}

function write(rel: string, content = "x"): string {
    const full = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return full;
}

describe("WorkspaceEditService — move", () => {
    it("moves a file and undo/redo round-trips it", async () => {
        const { service } = makeService();
        const src = write("a.txt", "hi");
        const dstDir = path.join(tmpDir, "dst");
        fs.mkdirSync(dstDir);

        const element = service.applyFileEdits([{ kind: "move", from: src, to: dstDir }], "Move");
        expect(element).not.toBeNull();
        expect(fs.existsSync(src)).toBe(false);
        expect(fs.readFileSync(path.join(dstDir, "a.txt"), "utf8")).toBe("hi");

        await element!.undo();
        expect(fs.readFileSync(src, "utf8")).toBe("hi");
        expect(fs.existsSync(path.join(dstDir, "a.txt"))).toBe(false);

        await element!.redo();
        expect(fs.existsSync(src)).toBe(false);
        expect(fs.existsSync(path.join(dstDir, "a.txt"))).toBe(true);
    });
});

describe("WorkspaceEditService — copy", () => {
    it("copies a file; undo deletes the copy and is marked destructive", async () => {
        const { service } = makeService();
        const src = write("a.txt", "hi");
        const dstDir = path.join(tmpDir, "dst");
        fs.mkdirSync(dstDir);

        const element = service.applyFileEdits([{ kind: "copy", from: src, to: dstDir }], "Paste");
        expect(element!.confirmBeforeUndo).toBeDefined();
        const copy = path.join(dstDir, "a.txt");
        expect(fs.existsSync(copy)).toBe(true);
        expect(fs.existsSync(src)).toBe(true);

        await element!.undo();
        expect(fs.existsSync(copy)).toBe(false);
        expect(fs.existsSync(src)).toBe(true);

        await element!.redo();
        expect(fs.existsSync(copy)).toBe(true);
    });
});

describe("WorkspaceEditService — delete (permanent)", () => {
    it("deletes permanently and records nothing undoable when trash is disabled", () => {
        const { service, undoRedo } = makeService(false);
        const src = write("a.txt");

        const element = service.applyFileEdits([{ kind: "delete", from: src }], "Delete");
        expect(element).toBeNull();
        expect(fs.existsSync(src)).toBe(false);
        expect(undoRedo.canUndo(WORKSPACE_UNDO_CONTEXT)).toBe(false);
        expect(service.willMoveToTrash()).toBe(false);
    });
});

describe("WorkspaceEditService — edge cases", () => {
    it("ignores unsupported edit kinds (returns null, records nothing)", () => {
        const { service, undoRedo } = makeService();
        const dest = path.join(tmpDir, "x.txt");

        // "create" объявлен в модели, но сервисом пока не поддержан — запись молча пропускается.
        const element = service.applyFileEdits([{ kind: "create", to: dest }], "Create");

        expect(element).toBeNull();
        expect(fs.existsSync(dest)).toBe(false);
        expect(undoRedo.canUndo(WORKSPACE_UNDO_CONTEXT)).toBe(false);
    });

    it.skipIf(process.platform !== "linux")("treats a missing files.enableTrash setting as enabled", () => {
        const config: IConfigurationService = {
            ...NULL_CONFIGURATION_SERVICE,
            get: () => undefined, // настройка не задана вовсе
        };
        const service = new WorkspaceEditService(new UndoRedoService(), new TrashService(), config);
        expect(service.willMoveToTrash()).toBe(true);
    });
});

describe.skipIf(process.platform !== "linux")("WorkspaceEditService — delete (trash)", () => {
    it("moves to trash, pushes an undoable element, and restores on undo", async () => {
        const { service, undoRedo } = makeService(true);
        const src = write("secret.txt", "pw");
        expect(service.willMoveToTrash()).toBe(true);

        const element = service.applyFileEdits([{ kind: "delete", from: src }], "Delete");
        expect(element).not.toBeNull();
        expect(fs.existsSync(src)).toBe(false);
        expect(undoRedo.canUndo(WORKSPACE_UNDO_CONTEXT)).toBe(true);

        await element!.undo();
        expect(fs.readFileSync(src, "utf8")).toBe("pw");

        await element!.redo();
        expect(fs.existsSync(src)).toBe(false);
    });
});
