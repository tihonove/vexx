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
        editor: {
            tabSize: 4,
            insertSpaces: true,
            // detectIndentation: true — добавим, когда EditorController станет читать из конфига.
        },
        explorer: {
            // Спрашивать подтверждение перед удалением (безвозвратное удаление спрашивает всегда).
            confirmDelete: true,
            // Спрашивать подтверждение перед отменой деструктивной файловой операции.
            confirmUndo: true,
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
