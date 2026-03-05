import type { KeyEvent } from "./KeyEvent.ts";

/**
 * Parse raw terminal input into KeyEvent[].
 * 
 * Pure function, no side effects — easy to test and extend.
 * 
 * Currently handles:
 * - Printable ASCII characters
 * - Ctrl+letter (0x01–0x1a except 0x09/0x0d/0x1b)
 * - Enter (0x0d)
 * - Tab (0x09)
 * - Backspace (0x7f)
 * - Escape (0x1b when standalone)
 * 
 * TODO: Arrow keys, F-keys, CSI sequences, Kitty protocol
 */
export function parseInput(data: string): KeyEvent[] {
    const events: KeyEvent[] = [];
    let i = 0;

    while (i < data.length) {
        const code = data.charCodeAt(i);
        const char = data[i];

        if (code === 0x1b) {
            // Escape — for now treat as a standalone Escape key
            // TODO: parse CSI/SS3 sequences (\x1b[ ... , \x1bO ...)
            events.push({ key: "Escape", raw: char });
            i++;
        } else if (code === 0x0d) {
            events.push({ key: "Enter", raw: char });
            i++;
        } else if (code === 0x09) {
            events.push({ key: "Tab", raw: char });
            i++;
        } else if (code === 0x7f) {
            events.push({ key: "Backspace", raw: char });
            i++;
        } else if (code >= 0x01 && code <= 0x1a) {
            // Ctrl+A through Ctrl+Z
            const letter = String.fromCharCode(code + 0x60); // 0x01 -> 'a', 0x03 -> 'c', etc.
            events.push({ key: `Ctrl+${letter.toUpperCase()}`, raw: char });
            i++;
        } else if (code >= 0x20) {
            // Printable character (space and above)
            events.push({ key: char, raw: char });
            i++;
        } else {
            // Unknown control character — pass through as raw
            events.push({ key: `<0x${code.toString(16).padStart(2, "0")}>`, raw: char });
            i++;
        }
    }

    return events;
}
