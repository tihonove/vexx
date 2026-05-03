import { describe, expect, it } from "vitest";

import { InMemoryClipboard } from "./InMemoryClipboard.ts";

describe("InMemoryClipboard", () => {
    it("readText returns empty string initially", async () => {
        const clipboard = new InMemoryClipboard();
        expect(await clipboard.readText()).toBe("");
    });

    it("readText returns the last written text", async () => {
        const clipboard = new InMemoryClipboard();
        await clipboard.writeText("hello");
        expect(await clipboard.readText()).toBe("hello");
    });

    it("writeText overwrites previous value", async () => {
        const clipboard = new InMemoryClipboard();
        await clipboard.writeText("first");
        await clipboard.writeText("second");
        expect(await clipboard.readText()).toBe("second");
    });

    it("supports empty string write", async () => {
        const clipboard = new InMemoryClipboard();
        await clipboard.writeText("something");
        await clipboard.writeText("");
        expect(await clipboard.readText()).toBe("");
    });

    it("supports multi-line text", async () => {
        const clipboard = new InMemoryClipboard();
        const text = "line one\nline two\nline three";
        await clipboard.writeText(text);
        expect(await clipboard.readText()).toBe(text);
    });
});
