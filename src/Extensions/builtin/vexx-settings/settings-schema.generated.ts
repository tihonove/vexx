// GENERATED FILE — не редактировать вручную.
// Регенерируется `npm run build:extensions` (scripts/generate-settings-schema.mjs).
// Каталог известных ключей настроек: app-дефолты (Configuration/defaults.ts) +
// contributes.configuration всех builtin-расширений. Вшивается в vexx-settings
// на этапе сборки и служит источником автодополнения в settings.json.

export interface ISettingSchemaEntry {
    readonly key: string;
    readonly type?: string;
    readonly default?: unknown;
    readonly description?: string;
    readonly enum?: readonly unknown[];
}

export const SETTINGS_SCHEMA: readonly ISettingSchemaEntry[] = [
    { key: "editor.cursorSurroundingLines", type: "number", default: 3 },
    { key: "editor.insertSpaces", type: "boolean", default: true },
    { key: "editor.tabSize", type: "number", default: 4 },
    { key: "explorer.autoReveal", type: "boolean", default: true },
    { key: "explorer.confirmDelete", type: "boolean", default: true },
    { key: "explorer.confirmUndo", type: "boolean", default: true },
    { key: "files.enableTrash", type: "boolean", default: true },
    {
        key: "git.decorations.enabled",
        type: "boolean",
        default: true,
        description: "Colour and badge changed files in the explorer tree.",
    },
    {
        key: "git.enabled",
        type: "boolean",
        default: true,
        description: "Master switch for the built-in Git integration.",
    },
    {
        key: "git.gutter.enabled",
        type: "boolean",
        default: true,
        description: "Show dirty-diff change bars in the editor gutter.",
    },
    {
        key: "git.path",
        type: "string",
        default: "",
        description: "Path to a git binary to prefer (its directory is prepended to PATH). Empty uses git from PATH.",
    },
    {
        key: "git.refreshDebounce",
        type: "number",
        default: 200,
        description: "Debounce, in milliseconds, before recomputing git status and diff after a change.",
    },
    { key: "terminal.capabilities", type: "object", default: {} },
    { key: "terminal.customModes", type: "object", default: {} },
    { key: "terminal.modes", type: "object", default: {} },
    { key: "terminal.tier", type: "string", default: "auto", enum: ["auto", "legacy", "csi-u", "kitty"] },
    {
        key: "workbench.colorTheme",
        type: "string",
        default: "Dark Modern",
        enum: ["Dark 2026", "Dark Modern", "Dark+", "Monokai", "Light Modern", "Light+"],
    },
];
