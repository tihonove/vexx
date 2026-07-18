/**
 * Хардкод default-настроек приложения. Минимальный набор, отражающий то,
 * что реально применяется в редакторе. Расширяется по мере добавления
 * новых конфигурируемых параметров.
 *
 * Аналог `contributes.configuration` от extension manifests — он добавит
 * defaults поверх этих (Phase 6 в docs/TODO/Extensions.md).
 */
export function getDefaultConfiguration(): Readonly<Record<string, unknown>> {
    return {
        // Активная цветовая тема по имени (label из ThemeRegistry). Дефолт совпадает
        // с out-of-the-box VS Code (`workbench.colorTheme`). Держим строкой, чтобы не
        // тянуть слой Theme в Configuration; значение зеркалит `DEFAULT_COLOR_THEME`.
        workbench: {
            colorTheme: "Dark Modern",
        },
        editor: {
            tabSize: 4,
            insertSpaces: true,
            // Сколько строк держать между курсором и краем окна при прокрутке его в
            // видимую область (PgUp/PgDown, Ctrl+End и т.п.) — курсор «оттупает» от края.
            // В VS Code дефолт 0; здесь держим небольшой отступ (issue #89).
            cursorSurroundingLines: 3,
            // detectIndentation: true — добавим, когда редактор станет читать её из конфига.
        },
        explorer: {
            // Спрашивать подтверждение перед удалением (безвозвратное удаление спрашивает всегда).
            confirmDelete: true,
            // Спрашивать подтверждение перед отменой деструктивной файловой операции.
            confirmUndo: true,
            // Автоматически подсвечивать активный файл в дереве при переключении редактора.
            autoReveal: true,
        },
        files: {
            // true → удалять в системную корзину, если она доступна; false → всегда безвозвратно.
            enableTrash: true,
        },
        terminal: {
            // Tier override: "auto" (detect) | "legacy" | "csi-u" | "kitty".
            tier: "auto",
            // Capability force-overrides, e.g. { osc52: false }. Empty = use detection.
            capabilities: {},
            // Force modes on/off, e.g. { ssh: true }. Wins over auto-detection.
            modes: {},
            // Declare custom manual-only modes, e.g. { presentation: {} } — usable in `when`.
            customModes: {},
        },
    };
}
