import { describe, expect, it } from "vitest";

import { WorkspaceConfigStore } from "./workspaceConfigStore.ts";

describe("WorkspaceConfigStore", () => {
    it("резолвит dotted-ключ из nested-снапшота пользователя", () => {
        const store = new WorkspaceConfigStore();
        store.setSnapshot({ editor: { tabSize: 2, insertSpaces: false } });
        expect(store.get("editor.tabSize")).toBe(2);
        expect(store.get("editor.insertSpaces")).toBe(false);
    });

    it("пользовательский слой перекрывает дефолты расширения", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults({ "editor.tabSize": 4, "editorconfig.generateAuto": true });
        store.setSnapshot({ editor: { tabSize: 8 } });
        // user перекрывает default
        expect(store.get("editor.tabSize")).toBe(8);
        // default, которого нет у пользователя, остаётся виден
        expect(store.get("editorconfig.generateAuto")).toBe(true);
    });

    it("get возвращает defaultValue для отсутствующего ключа", () => {
        const store = new WorkspaceConfigStore();
        expect(store.get("nope.missing", 42)).toBe(42);
        expect(store.get("nope.missing")).toBeUndefined();
    });

    it("has отражает наличие ключа в любом слое", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults({ "editorconfig.generateAuto": true });
        expect(store.has("editorconfig.generateAuto")).toBe(true);
        expect(store.has("editorconfig.unknown")).toBe(false);
    });

    it("inspect разделяет default и user слои", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults({ "editor.tabSize": 4 });
        store.setSnapshot({ editor: { tabSize: 8 } });
        const result = store.inspect("editor.tabSize");
        expect(result.defaultValue).toBe(4);
        expect(result.globalValue).toBe(8);
        expect(result.value).toBe(8);
    });

    it("inspect для чисто дефолтного ключа не имеет globalValue", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults({ "editorconfig.generateAuto": true });
        const result = store.inspect("editorconfig.generateAuto");
        expect(result.defaultValue).toBe(true);
        expect(result.globalValue).toBeUndefined();
        expect(result.value).toBe(true);
    });

    it("get возвращает объект-поддерево, если ключ указывает на него", () => {
        const store = new WorkspaceConfigStore();
        store.setSnapshot({ editor: { tabSize: 2 } });
        expect(store.get("editor")).toEqual({ tabSize: 2 });
    });

    it("sectionKeys перечисляет собственные ключи секции", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults({ "editorconfig.generateAuto": true });
        store.setSnapshot({ editor: { tabSize: 2, insertSpaces: true } });
        expect(store.sectionKeys("editor").sort()).toEqual(["insertSpaces", "tabSize"]);
        expect(store.sectionKeys("editorconfig")).toEqual(["generateAuto"]);
        expect(store.sectionKeys(undefined).sort()).toEqual(["editor", "editorconfig"]);
    });

    it("setSnapshot заменяет предыдущий пользовательский слой целиком", () => {
        const store = new WorkspaceConfigStore();
        store.setSnapshot({ editor: { tabSize: 2 } });
        store.setSnapshot({ editor: { insertSpaces: false } });
        expect(store.get("editor.tabSize")).toBeUndefined();
        expect(store.get("editor.insertSpaces")).toBe(false);
    });

    it("не мутирует переданный снапшот", () => {
        const store = new WorkspaceConfigStore();
        const snapshot = { editor: { tabSize: 2 } };
        store.setSnapshot(snapshot);
        store.applyDefaults({ "editor.insertSpaces": true });
        // слияние не должно протечь в исходный объект
        expect(snapshot).toEqual({ editor: { tabSize: 2 } });
    });

    it("нечисловой/непонятный снапшот трактуется как пустой", () => {
        const store = new WorkspaceConfigStore();
        store.setSnapshot(null);
        store.setSnapshot("garbage");
        expect(store.get("editor.tabSize")).toBeUndefined();
    });

    it("applyDefaults(undefined) — no-op", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults(undefined);
        expect(store.get("anything")).toBeUndefined();
    });

    it("сливает дефолты с общим префиксом в одно поддерево", () => {
        const store = new WorkspaceConfigStore();
        store.applyDefaults({ "a.b": 1, "a.c": 2 });
        expect(store.get("a.b")).toBe(1);
        expect(store.get("a.c")).toBe(2);
        expect(store.get("a")).toEqual({ b: 1, c: 2 });
    });

    it("get по пути, уходящему за скаляр, возвращает undefined", () => {
        const store = new WorkspaceConfigStore();
        store.setSnapshot({ editor: { tabSize: 2 } });
        expect(store.get("editor.tabSize.deeper")).toBeUndefined();
    });
});
