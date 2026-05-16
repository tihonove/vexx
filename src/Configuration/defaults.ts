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
    };
}
