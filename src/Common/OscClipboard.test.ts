import { describe, expect, it, vi } from "vitest";

import { OscClipboard } from "./OscClipboard.ts";

describe("OscClipboard", () => {
    it("writeText calls writeFn with OSC 52 sequence", async () => {
        const writeFn = vi.fn();
        const clipboard = new OscClipboard(writeFn);
        await clipboard.writeText("hello");
        expect(writeFn).toHaveBeenCalledOnce();
        expect(writeFn).toHaveBeenCalledWith("\x1b]52;c;aGVsbG8=\x07");
    });

    it("readText returns the last written text", async () => {
        const clipboard = new OscClipboard(vi.fn());
        await clipboard.writeText("hello");
        expect(await clipboard.readText()).toBe("hello");
    });

    it("readText returns empty string initially", async () => {
        const clipboard = new OscClipboard(vi.fn());
        expect(await clipboard.readText()).toBe("");
    });

    it("writeText overwrites previous value in buffer", async () => {
        const clipboard = new OscClipboard(vi.fn());
        await clipboard.writeText("first");
        await clipboard.writeText("second");
        expect(await clipboard.readText()).toBe("second");
    });

    it("correctly base64-encodes unicode text", async () => {
        const writeFn = vi.fn();
        const clipboard = new OscClipboard(writeFn);
        const text = "Привет мир";
        await clipboard.writeText(text);
        const expected = Buffer.from(text, "utf8").toString("base64");
        expect(writeFn).toHaveBeenCalledWith(`\x1b]52;c;${expected}\x07`);
    });

    it("correctly encodes multi-line text", async () => {
        const writeFn = vi.fn();
        const clipboard = new OscClipboard(writeFn);
        const text = "line one\nline two\nline three";
        await clipboard.writeText(text);
        const expected = Buffer.from(text, "utf8").toString("base64");
        expect(writeFn).toHaveBeenCalledWith(`\x1b]52;c;${expected}\x07`);
        expect(await clipboard.readText()).toBe(text);
    });
});
