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

    describe("with subscribeFn (OSC 52 read)", () => {
        it("readText sends OSC 52 query", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const subscribeFn = (cb: (code: number, data: string) => void) => {
                subscriber = cb;
            };
            const clipboard = new OscClipboard(writeFn, subscribeFn);

            const promise = clipboard.readText();
            // Immediately deliver the OSC 52 response
            subscriber!(52, "c;" + Buffer.from("hello", "utf8").toString("base64"));
            const result = await promise;

            expect(writeFn).toHaveBeenCalledWith("\x1b]52;c;?\x07");
            expect(result).toBe("hello");
        });

        it("readText decodes unicode text from OSC 52 response", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });

            const text = "Привет мир";
            const promise = clipboard.readText();
            subscriber!(52, "c;" + Buffer.from(text, "utf8").toString("base64"));
            expect(await promise).toBe(text);
        });

        it("readText falls back to buffer on timeout", async () => {
            vi.useFakeTimers();
            const writeFn = vi.fn();
            const clipboard = new OscClipboard(writeFn, () => {
                /* never responds */
            });
            await clipboard.writeText("buffered");

            const promise = clipboard.readText();
            vi.advanceTimersByTime(5000);
            expect(await promise).toBe("buffered");
            vi.useRealTimers();
        });

        it("readText ignores OSC response with code other than 52", async () => {
            vi.useFakeTimers();
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });
            await clipboard.writeText("buffered");

            const promise = clipboard.readText();
            subscriber!(7, "irrelevant");
            vi.advanceTimersByTime(5000);
            expect(await promise).toBe("buffered");
            vi.useRealTimers();
        });

        it("readText ignores query echo '?' in OSC 52 response", async () => {
            vi.useFakeTimers();
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });
            await clipboard.writeText("buffered");

            const promise = clipboard.readText();
            subscriber!(52, "c;?");
            vi.advanceTimersByTime(5000);
            expect(await promise).toBe("buffered");
            vi.useRealTimers();
        });

        it("second readText cancels the first", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });
            await clipboard.writeText("initial");

            const first = clipboard.readText();
            const second = clipboard.readText();

            // First resolves with the buffer (cancelled)
            expect(await first).toBe("initial");

            // Deliver response for the second
            subscriber!(52, "c;" + Buffer.from("from terminal", "utf8").toString("base64"));
            expect(await second).toBe("from terminal");
        });
    });
});
