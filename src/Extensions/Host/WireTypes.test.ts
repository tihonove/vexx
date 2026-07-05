import { describe, expect, it } from "vitest";

import { EndOfLine } from "../../Editor/EndOfLine.ts";

import { createInProcessChannelPair } from "./InProcessChannelPair.ts";
import { RpcEndpoint } from "./RpcEndpoint.ts";
import type { WireTextEdit } from "./WireTypes.ts";
import { parseWireTextEdits, requestWillSaveEdits, wireToSaveEdits } from "./WireTypes.ts";

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
