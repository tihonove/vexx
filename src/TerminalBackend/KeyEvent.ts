/**
 * Represents a parsed keyboard event.
 * 
 * `key` — human-readable name: 'a', 'Enter', 'ArrowUp', 'Ctrl+C', 'Escape', etc.
 * `raw` — original bytes/escape sequence as received from stdin.
 */
export interface KeyEvent {
    /** Human-readable key name, e.g. 'a', 'Enter', 'ArrowUp', 'Ctrl+C' */
    key: string;
    /** Original raw bytes from the terminal */
    raw: string;
}
