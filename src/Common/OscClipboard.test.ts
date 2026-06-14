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

    it("encodes an empty string to an empty base64 payload", async () => {
        const writeFn = vi.fn();
        const clipboard = new OscClipboard(writeFn);
        await clipboard.writeText("");
        expect(writeFn).toHaveBeenCalledWith("\x1b]52;c;\x07");
        expect(await clipboard.readText()).toBe("");
    });

    it("writeText resolves its promise", async () => {
        const clipboard = new OscClipboard(vi.fn());
        await expect(clipboard.writeText("x")).resolves.toBeUndefined();
    });

    it("readText does not send an OSC query when no subscribeFn is provided", async () => {
        const writeFn = vi.fn();
        const clipboard = new OscClipboard(writeFn);
        await clipboard.readText();
        expect(writeFn).not.toHaveBeenCalled();
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

        it("readText parses a response without the 'c;' selection prefix (base64 taken directly)", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });

            const promise = clipboard.readText();
            // No semicolon → whole payload is treated as base64.
            subscriber!(52, Buffer.from("direct", "utf8").toString("base64"));
            expect(await promise).toBe("direct");
        });

        it("ignores an unsolicited OSC 52 response when no read is pending", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });

            // Terminal pushes a selection update without us querying for it.
            subscriber!(52, "c;" + Buffer.from("unsolicited", "utf8").toString("base64"));

            // Buffer must stay empty: the response is dropped, not stored.
            const promise = clipboard.readText();
            subscriber!(52, "c;" + Buffer.from("real", "utf8").toString("base64"));
            expect(await promise).toBe("real");
        });

        it("stores the terminal response in the buffer for later reads", async () => {
            vi.useFakeTimers();
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });

            const first = clipboard.readText();
            subscriber!(52, "c;" + Buffer.from("from terminal", "utf8").toString("base64"));
            expect(await first).toBe("from terminal");

            // A second read that times out should fall back to the cached terminal value.
            const second = clipboard.readText();
            vi.advanceTimersByTime(5000);
            expect(await second).toBe("from terminal");
            vi.useRealTimers();
        });

        it("a terminal response overrides the previously written buffer", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });

            await clipboard.writeText("local");
            const promise = clipboard.readText();
            subscriber!(52, "c;" + Buffer.from("terminal", "utf8").toString("base64"));
            expect(await promise).toBe("terminal");
        });

        it("decodes an empty base64 payload from the terminal as an empty string", async () => {
            const writeFn = vi.fn();
            let subscriber: ((code: number, data: string) => void) | null = null;
            const clipboard = new OscClipboard(writeFn, (cb) => {
                subscriber = cb;
            });

            await clipboard.writeText("local");
            const promise = clipboard.readText();
            subscriber!(52, "c;");
            expect(await promise).toBe("");
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
