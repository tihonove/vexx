/**
 * Иконки для `CompletionItemKind` (числовые значения enum VS Code 0…26) —
 * codicon-глифы (Private Use Area), как в nvim-cmp / lspkind preset "codicons".
 * Требует nerd-font (со встроенными codicon'ами) в терминале.
 *
 * TUIDom-локальный, без зависимостей от Editor/Extensions — принимает сырое
 * число `kind`.
 */
const KIND_ICONS: Readonly<Record<number, string>> = {
    0: "", // Text
    1: "", // Method
    2: "", // Function
    3: "", // Constructor
    4: "", // Field
    5: "", // Variable
    6: "", // Class
    7: "", // Interface
    8: "", // Module
    9: "", // Property
    10: "", // Unit
    11: "", // Value
    12: "", // Enum
    13: "", // Keyword
    14: "", // Snippet
    15: "", // Color
    16: "", // File
    17: "", // Reference
    18: "", // Folder
    19: "", // EnumMember
    20: "", // Constant
    21: "", // Struct
    22: "", // Event
    23: "", // Operator
    24: "", // TypeParameter
};

/** Иконка по умолчанию для неизвестного/отсутствующего kind. */
const DEFAULT_ICON = ""; // Text

/** Возвращает codicon-глиф для `CompletionItemKind` (fallback — дефолтный). */
export function kindIcon(kind: number | undefined): string {
    if (kind === undefined) return DEFAULT_ICON;
    return KIND_ICONS[kind] ?? DEFAULT_ICON;
}
