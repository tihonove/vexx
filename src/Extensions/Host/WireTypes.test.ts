import { describe, expect, it } from "vitest";

import { EndOfLine } from "../../Editor/EndOfLine.ts";

import { createInProcessChannelPair } from "./InProcessChannelPair.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";
import type { WireCompletionItem, WireTextEdit } from "./WireTypes.ts";
import {
    parseWireCompletionItems,
    parseWireTextEdits,
    requestCompletionItems,
    requestWillSaveEdits,
    wireToCoreCompletionItems,
    wireToSaveEdits,
} from "./WireTypes.ts";

const PARAMS = {
    fileName: "/tmp/file.txt",
    languageId: "plaintext",
    version: 1,
    isDirty: true,
    text: "hi\n",
    reason: 1,
};

describe("WireTypes — parseWireTextEdits", () => {
    it("парсит текстовую правку и setEndOfLine", () => {
        const raw = [
            { range: { startLine: 0, startCharacter: 1, endLine: 0, endCharacter: 3 }, text: "x" },
            { setEndOfLine: 2 },
        ];
        expect(parseWireTextEdits(raw)).toEqual(raw);
    });

    it("отбрасывает невалидные элементы (drop+skip), не роняя весь ответ", () => {
        const raw = [
            null,
            42,
            { text: "x" }, // range отсутствует
            { range: null, text: "x" }, // range === null
            { range: { startLine: 0 }, text: "x" }, // неполный range
            { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 0 }, text: 5 }, // text не строка
            { setEndOfLine: 3 }, // недопустимый eol
            { setEndOfLine: 1 }, // валидный
        ];
        expect(parseWireTextEdits(raw)).toEqual([{ setEndOfLine: 1 }]);
    });

    it("не-массив → пустой результат", () => {
        expect(parseWireTextEdits(undefined)).toEqual([]);
        expect(parseWireTextEdits({})).toEqual([]);
    });
});

describe("WireTypes — wireToSaveEdits", () => {
    it("текстовая правка → core ISaveEdit с 0-based диапазоном", () => {
        const wire: WireTextEdit[] = [
            { range: { startLine: 2, startCharacter: 4, endLine: 2, endCharacter: 9 }, text: "abc" },
        ];
        expect(wireToSaveEdits(wire)).toEqual([
            {
                kind: "text",
                range: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } },
                text: "abc",
            },
        ]);
    });

    it("setEndOfLine 2 → CRLF, 1 → LF", () => {
        expect(wireToSaveEdits([{ setEndOfLine: 2 }])).toEqual([{ kind: "eol", eol: EndOfLine.CRLF }]);
        expect(wireToSaveEdits([{ setEndOfLine: 1 }])).toEqual([{ kind: "eol", eol: EndOfLine.LF }]);
    });
});

describe("WireTypes — requestWillSaveEdits (InProcessChannelPair)", () => {
    function connectPair(): { host: RpcEndpoint; sub: RpcEndpoint; dispose: () => void } {
        const [a, b] = createInProcessChannelPair();
        const host = new RpcEndpoint(a);
        const sub = new RpcEndpoint(b);
        return { host, sub, dispose: () => { host.dispose(); sub.dispose(); } };
    }

    it("десериализует правки, вернувшиеся от subprocess'а", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("workspace.willSaveTextDocument", () => [
                { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 }, text: "" },
                { setEndOfLine: 2 },
            ]);
            const edits = await requestWillSaveEdits((m, p) => host.request(m, p), PARAMS, 1000);
            expect(edits).toEqual([
                { kind: "text", range: { start: { line: 0, character: 0 }, end: { line: 0, character: 2 } }, text: "" },
                { kind: "eol", eol: EndOfLine.CRLF },
            ]);
        } finally {
            dispose();
        }
    });

    it("возвращает [] по таймауту, если participant никогда не резолвится", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("workspace.willSaveTextDocument", () => new Promise(() => {}));
            const edits = await requestWillSaveEdits((m, p) => host.request(m, p), PARAMS, 30);
            expect(edits).toEqual([]);
        } finally {
            dispose();
        }
    });

    it("возвращает [] при ошибке RPC-хендлера", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("workspace.willSaveTextDocument", () => {
                throw new Error("boom");
            });
            const edits = await requestWillSaveEdits((m, p) => host.request(m, p), PARAMS, 1000);
            expect(edits).toEqual([]);
        } finally {
            dispose();
        }
    });
});

// ─── Completion ───────────────────────────────────────────────────────────────

const COMPLETION_PARAMS = {
    fileName: "/proj/.editorconfig",
    languageId: "editorconfig",
    text: "ind",
    line: 0,
    character: 3,
};

describe("WireTypes — parseWireCompletionItems", () => {
    it("парсит полный элемент и подставляет insertText из label", () => {
        const raw = [
            {
                label: "indent_style",
                kind: 9,
                detail: "EditorConfig",
                command: { command: "c._trigger", arguments: [1] },
                range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 3 },
            },
            { label: "root", insertText: "root = true" },
        ];
        const parsed = parseWireCompletionItems(raw);
        expect(parsed[0].insertText).toBe("indent_style"); // fallback на label
        expect(parsed[0].command).toEqual({ command: "c._trigger", arguments: [1] });
        expect(parsed[1].insertText).toBe("root = true");
    });

    it("отбрасывает невалидные элементы (нет label / битый range)", () => {
        const raw = [
            null,
            { insertText: "x" }, // нет label
            { label: "" }, // пустой label
            { label: "ok", range: { startLine: 0 } }, // битый range → range опущен, элемент валиден
        ];
        const parsed = parseWireCompletionItems(raw);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].label).toBe("ok");
        expect(parsed[0].range).toBeUndefined();
    });

    it("подхватывает documentation/sortText/filterText, пустую command отбрасывает", () => {
        const parsed = parseWireCompletionItems([
            {
                label: "x",
                documentation: "doc",
                sortText: "0",
                filterText: "xf",
                command: { command: "" }, // пустая команда → отбрасывается
            },
        ]);
        expect(parsed[0]).toEqual({
            label: "x",
            insertText: "x",
            documentation: "doc",
            sortText: "0",
            filterText: "xf",
        });
        expect(parsed[0].command).toBeUndefined();
    });

    it("не-массив → []", () => {
        expect(parseWireCompletionItems(undefined)).toEqual([]);
    });
});

describe("WireTypes — wireToCoreCompletionItems", () => {
    it("маппит range в core IRange и сохраняет command", () => {
        const wire: WireCompletionItem[] = [
            {
                label: "root",
                insertText: "root",
                kind: 9,
                range: { startLine: 1, startCharacter: 2, endLine: 1, endCharacter: 6 },
                command: { command: "c", arguments: [true] },
            },
        ];
        expect(wireToCoreCompletionItems(wire)).toEqual([
            {
                label: "root",
                insertText: "root",
                kind: 9,
                range: { start: { line: 1, character: 2 }, end: { line: 1, character: 6 } },
                command: { command: "c", arguments: [true] },
            },
        ]);
    });

    it("маппит documentation/sortText/filterText и элемент без kind/команды", () => {
        const wire: WireCompletionItem[] = [
            {
                label: "word",
                insertText: "word",
                documentation: "d",
                sortText: "s",
                filterText: "f",
                command: { command: "c" }, // без arguments
            },
        ];
        expect(wireToCoreCompletionItems(wire)).toEqual([
            {
                label: "word",
                insertText: "word",
                documentation: "d",
                sortText: "s",
                filterText: "f",
                command: { command: "c" },
            },
        ]);
    });
});

describe("WireTypes — requestCompletionItems (InProcessChannelPair)", () => {
    function connectPair(): { host: RpcEndpoint; sub: RpcEndpoint; dispose: () => void } {
        const [a, b] = createInProcessChannelPair();
        const host = new RpcEndpoint(a);
        const sub = new RpcEndpoint(b);
        return { host, sub, dispose: () => { host.dispose(); sub.dispose(); } };
    }

    it("десериализует элементы, вернувшиеся от subprocess'а", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("languages.provideCompletionItems", () => [
                { label: "indent_style", insertText: "indent_style", kind: 9 },
            ]);
            const items = await requestCompletionItems((m, p) => host.request(m, p), COMPLETION_PARAMS, 1000);
            expect(items).toEqual([{ label: "indent_style", insertText: "indent_style", kind: 9 }]);
        } finally {
            dispose();
        }
    });

    it("возвращает [] по таймауту", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("languages.provideCompletionItems", () => new Promise(() => {}));
            const items = await requestCompletionItems((m, p) => host.request(m, p), COMPLETION_PARAMS, 30);
            expect(items).toEqual([]);
        } finally {
            dispose();
        }
    });

    it("возвращает [] при ошибке RPC-хендлера", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("languages.provideCompletionItems", () => {
                throw new Error("boom");
            });
            const items = await requestCompletionItems((m, p) => host.request(m, p), COMPLETION_PARAMS, 1000);
            expect(items).toEqual([]);
        } finally {
            dispose();
        }
    });
});
