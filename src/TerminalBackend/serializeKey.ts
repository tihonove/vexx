/**
 * Convert a human-readable key name to the raw terminal escape sequence.
 * Inverse of parseInput — used in tests for the DSL:
 *   sendKey('a')      → 'a'
 *   sendKey('Ctrl+C') → '\x03'
 *   sendKey('Enter')  → '\r'
 * 
 * TODO: extend with arrow keys, F-keys, CSI sequences, Kitty protocol
 */

const specialKeys: Record<string, string> = {
    Enter: "\x0d",
    Tab: "\x09",
    Backspace: "\x7f",
    Escape: "\x1b",
    Space: " ",
};

export function serializeKey(name: string): string {
    // Check special keys first
    if (name in specialKeys) {
        return specialKeys[name];
    }

    // Ctrl+<Letter> pattern
    const ctrlMatch = name.match(/^Ctrl\+([A-Z])$/i);
    if (ctrlMatch) {
        const letter = ctrlMatch[1].toUpperCase();
        const code = letter.charCodeAt(0) - 0x40; // 'A' -> 0x01, 'C' -> 0x03
        return String.fromCharCode(code);
    }

    // Single printable character
    if (name.length === 1) {
        return name;
    }

    throw new Error(`serializeKey: unknown key name "${name}". Add it to the mapping.`);
}
