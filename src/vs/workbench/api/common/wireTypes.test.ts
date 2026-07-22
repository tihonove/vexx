import { describe, expect, it } from "vitest";

import { Uri } from "../../../base/common/uri.ts";
import { EndOfLine } from "../../../editor/common/core/endOfLine.ts";

import { createInProcessChannelPair } from "./inProcessChannelPair.ts";
import { RpcEndpoint } from "./rpcEndpoint.ts";
import type { WireCompletionItem, WireTextEdit } from "./wireTypes.ts";
import {
    parseWireCompletionItems,
    parseWireEditorEdits,
    parseWireFoldingRanges,
    parseWireSelections,
    parseWireTextEdits,
    requestCompletionItems,
    requestFoldingRanges,
    requestWillSaveEdits,
    wireToCoreCompletionItems,
    wireToCoreFoldingRegions,
    wireToSaveEdits,
} from "./wireTypes.ts";

const PARAMS = {
    uri: Uri.file("/tmp/file.txt").toString(),
    languageId: "plaintext",
    version: 1,
    isDirty: true,
    text: "hi\n",
    reason: 1,
    eol: 1,
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
        return {
            host,
            sub,
            dispose: () => {
                host.dispose();
                sub.dispose();
            },
        };
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
    uri: Uri.file("/proj/.editorconfig").toString(),
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
        return {
            host,
            sub,
            dispose: () => {
                host.dispose();
                sub.dispose();
            },
        };
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

describe("WireTypes — parseWireFoldingRanges", () => {
    it("оставляет валидные, отбрасывает битые (drop+skip)", () => {
        const raw = [
            { start: 0, end: 3, kind: 3 },
            { start: 5, end: 9 }, // без kind — ок
            { start: "x", end: 2 }, // битый start
            { end: 4 }, // нет start
            null,
            42,
        ];
        expect(parseWireFoldingRanges(raw)).toEqual([
            { start: 0, end: 3, kind: 3 },
            { start: 5, end: 9 },
        ]);
    });

    it("не-массив → []", () => {
        expect(parseWireFoldingRanges(null)).toEqual([]);
        expect(parseWireFoldingRanges({ start: 0, end: 1 })).toEqual([]);
    });
});

describe("WireTypes — wireToCoreFoldingRegions", () => {
    it("маппит в IFoldingRegion (несвёрнутые), kind отбрасывается", () => {
        expect(wireToCoreFoldingRegions([{ start: 0, end: 3, kind: 3 }])).toEqual([
            { startLine: 0, endLine: 3, isCollapsed: false },
        ]);
    });

    it("отбрасывает вырожденные (end <= start) и клампит start к нулю", () => {
        expect(
            wireToCoreFoldingRegions([
                { start: 2, end: 2 }, // прятать нечего
                { start: 4, end: 1 }, // end < start
                { start: -3, end: 2 }, // start клампится к 0
            ]),
        ).toEqual([{ startLine: 0, endLine: 2, isCollapsed: false }]);
    });
});

describe("WireTypes — requestFoldingRanges (InProcessChannelPair)", () => {
    function connectPair(): { host: RpcEndpoint; sub: RpcEndpoint; dispose: () => void } {
        const [a, b] = createInProcessChannelPair();
        const host = new RpcEndpoint(a);
        const sub = new RpcEndpoint(b);
        return {
            host,
            sub,
            dispose: () => {
                host.dispose();
                sub.dispose();
            },
        };
    }

    it("возвращает core-регионы ответа провайдера", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("languages.provideFoldingRanges", () => [
                { start: 1, end: 4, kind: 3 },
                { start: 6, end: 6 }, // вырожденный — отсеется
            ]);
            const regions = await requestFoldingRanges(
                (m, p) => host.request(m, p),
                { uri: Uri.file("/x.cs").toString(), languageId: "csharp", text: "" },
                1000,
            );
            expect(regions).toEqual([{ startLine: 1, endLine: 4, isCollapsed: false }]);
        } finally {
            dispose();
        }
    });

    it("таймаут → []", async () => {
        const { host, sub, dispose } = connectPair();
        try {
            sub.handleRequest("languages.provideFoldingRanges", () => new Promise(() => {})); // никогда не резолвится
            const regions = await requestFoldingRanges(
                (m, p) => host.request(m, p),
                { uri: Uri.file("/x.cs").toString(), languageId: "csharp", text: "" },
                20,
            );
            expect(regions).toEqual([]);
        } finally {
            dispose();
        }
    });
});

describe("WireTypes — parseWireSelections", () => {
    it("оставляет валидные, отбрасывает битые", () => {
        const raw = [
            { anchorLine: 0, anchorCharacter: 1, activeLine: 2, activeCharacter: 3 },
            { anchorLine: 0, anchorCharacter: 1, activeLine: 2 }, // неполный
            null,
        ];
        expect(parseWireSelections(raw)).toEqual([
            { anchorLine: 0, anchorCharacter: 1, activeLine: 2, activeCharacter: 3 },
        ]);
    });

    it("не-массив → []", () => {
        expect(parseWireSelections(undefined)).toEqual([]);
    });
});

describe("WireTypes — parseWireEditorEdits", () => {
    it("парсит правку с range+text; отбрасывает без range или без text", () => {
        const raw = [
            { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 }, text: "hi" },
            { text: "no range" },
            { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 } }, // нет text
            { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 }, text: 5 }, // text не строка
        ];
        expect(parseWireEditorEdits(raw)).toEqual([
            { range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 }, text: "hi" },
        ]);
    });

    it("пустой text (delete) валиден", () => {
        const raw = [{ range: { startLine: 1, startCharacter: 0, endLine: 2, endCharacter: 0 }, text: "" }];
        expect(parseWireEditorEdits(raw)).toHaveLength(1);
    });

    it("не-массив → []", () => {
        expect(parseWireEditorEdits(null)).toEqual([]);
    });
});
