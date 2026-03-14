/**
 * Bit-mask flags for terminal text styles.
 *
 * Combine with bitwise OR:   `StyleFlags.Bold | StyleFlags.Italic`
 * Test with bitwise AND:     `(style & StyleFlags.Bold) !== 0`
 */
export const StyleFlags = {
    None: 0,
    Bold: 1 << 0, // 1
    Italic: 1 << 1, // 2
    Underline: 1 << 2, // 4
    Undercurl: 1 << 3, // 8
    Inverse: 1 << 4, // 16
    Strikethrough: 1 << 5, // 32
    Dim: 1 << 6, // 64
} as const;
