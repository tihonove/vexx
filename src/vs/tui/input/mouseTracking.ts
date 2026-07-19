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

/** Enable any-event tracking (press + release + all motion) with SGR extended coordinates */
export const MOUSE_TRACKING_ALL_ENABLE = "\x1b[?1003h\x1b[?1006h";

/** Disable all mouse tracking modes */
export const MOUSE_TRACKING_DISABLE = "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l";
