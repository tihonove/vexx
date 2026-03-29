/**
 * Mouse tracking escape sequences for xterm-compatible terminals.
 *
 * Modes:
 * - 1000: Normal tracking — reports button press and release
 * - 1002: Button-event tracking — also reports motion while a button is held (drag)
 * - 1003: Any-event tracking — reports all motion events (even without button held)
 * - 1006: SGR extended mode — uses CSI < Cb;Cx;Cy M/m format (no coordinate limits)
 *
 * SGR mode (1006) should always be enabled alongside a tracking mode,
 * because the legacy X10 format limits coordinates to 223 and doesn't distinguish release buttons.
 *
 * Reference: https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h2-Mouse-Tracking
 */

/** Enable normal mouse tracking (press + release) with SGR extended coordinates */
export const MOUSE_TRACKING_ENABLE = "\x1b[?1000h\x1b[?1006h";

/** Enable button-event tracking (press + release + drag) with SGR extended coordinates */
export const MOUSE_TRACKING_DRAG_ENABLE = "\x1b[?1002h\x1b[?1006h";

/** Enable any-event tracking (press + release + all motion) with SGR extended coordinates */
export const MOUSE_TRACKING_ALL_ENABLE = "\x1b[?1003h\x1b[?1006h";

/** Disable all mouse tracking modes */
export const MOUSE_TRACKING_DISABLE = "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l";

/**
 * Get mouse tracking enable/disable escape sequences for the requested mode.
 */
export function mouseTrackingSequences(options?: {
    /** Track drag (motion while button held). Default: false */
    drag?: boolean;
    /** Track all motion (even without button). Implies drag. Default: false */
    allMotion?: boolean;
}): { enable: string; disable: string } {
    const allMotion = options?.allMotion ?? false;
    const drag = options?.drag ?? false;

    if (allMotion) {
        return { enable: MOUSE_TRACKING_ALL_ENABLE, disable: MOUSE_TRACKING_DISABLE };
    }
    if (drag) {
        return { enable: MOUSE_TRACKING_DRAG_ENABLE, disable: MOUSE_TRACKING_DISABLE };
    }
    return { enable: MOUSE_TRACKING_ENABLE, disable: MOUSE_TRACKING_DISABLE };
}
