/**
 * Фаза 6a: исправление размещений, найденных чекером слоёв:
 * чистые утилиты — в base/common, типы манифеста расширений — в platform/extensions,
 * тема как объект (WorkbenchTheme ≈ IColorTheme) — в platform/theme,
 * IController/StateKeys зависят от tui/node — из workbench/common в workbench/tui.
 */
export const moves = [
    ["src/vs/tui/rendering/colorUtils.ts", "src/vs/base/common/color.ts"],
    ["src/vs/platform/environment/common/terminalEnv.ts", "src/vs/base/common/terminalEnv.ts"],
    ["src/vs/workbench/common/controller.ts", "src/vs/workbench/tui/controller.ts"],
    ["src/vs/workbench/common/stateKeys.ts", "src/vs/workbench/tui/stateKeys.ts"],
    ["src/vs/workbench/services/textMate/common/grammarContribution.ts", "src/vs/platform/extensions/common/grammarContribution.ts"],
    ["src/vs/workbench/services/language/common/languageContribution.ts", "src/vs/platform/extensions/common/languageContribution.ts"],
    ["src/vs/workbench/services/themes/common/themeFile.ts", "src/vs/platform/theme/common/themeFile.ts"],
    ["src/vs/workbench/services/themes/common/editorTokenTheme.ts", "src/vs/platform/theme/common/editorTokenTheme.ts"],
    ["src/vs/workbench/services/themes/common/workbenchTheme.ts", "src/vs/platform/theme/common/workbenchTheme.ts"],
];
export const stringPrefixes = [];
