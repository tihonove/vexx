import { describe, expect, it } from "vitest";

import { InMemoryClipboard } from "./InMemoryClipboard.ts";

describe("InMemoryClipboard", () => {
    it("readText returns empty string initially", () => {
        const clipboard = new InMemoryClipboard();
        expect(clipboard.readText()).toBe("");
    });

    it("readText returns the last written text", () => {
        const clipboard = new InMemoryClipboard();
        clipboard.writeText("hello");
        expect(clipboard.readText()).toBe("hello");
    });

    it("writeText overwrites previous value", () => {
        const clipboard = new InMemoryClipboard();
        clipboard.writeText("first");
        clipboard.writeText("second");
        expect(clipboard.readText()).toBe("second");
    });

    it("supports empty string write", () => {
        const clipboard = new InMemoryClipboard();
        clipboard.writeText("something");
        clipboard.writeText("");
        expect(clipboard.readText()).toBe("");
    });

    it("supports multi-line text", () => {
        const clipboard = new InMemoryClipboard();
        const text = "line one\nline two\nline three";
        clipboard.writeText(text);
        expect(clipboard.readText()).toBe(text);
    });
});
