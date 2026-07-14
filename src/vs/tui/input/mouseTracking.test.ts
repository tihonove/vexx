import { describe, expect, it } from "vitest";

import { MOUSE_TRACKING_ALL_ENABLE, MOUSE_TRACKING_DISABLE } from "./mouseTracking.ts";

/**
 * These constants are written verbatim to the terminal, so a typo in the
 * DECSET/DECRST codes would silently break mouse input. The tests pin the
 * exact xterm control sequences documented in the module.
 */
describe("mouse tracking control sequences", () => {
    it("enables any-event tracking (1003) together with SGR extended coordinates (1006)", () => {
        // CSI ? 1003 h  +  CSI ? 1006 h
        expect(MOUSE_TRACKING_ALL_ENABLE).toBe("\x1b[?1003h\x1b[?1006h");
    });

    it("disables every tracking mode it may have enabled (1000/1002/1003) plus SGR (1006)", () => {
        // SGR (1006) must always accompany a tracking mode, so disabling resets all of them.
        expect(MOUSE_TRACKING_DISABLE).toBe("\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l");
    });

    it("disable string turns off the same SGR mode the enable string turned on", () => {
        expect(MOUSE_TRACKING_ALL_ENABLE).toContain("?1006h");
        expect(MOUSE_TRACKING_DISABLE).toContain("?1006l");
    });
});
