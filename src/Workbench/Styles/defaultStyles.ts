import type { IEditorStyles } from "../../Editor/EditorElement.ts";
import { unthemedEditorStyles } from "../../Editor/EditorElement.ts";
import type { IWorkbenchColors } from "../../Theme/IWorkbenchColors.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { IButtonStyles } from "../../TUIDom/Widgets/ButtonElement.ts";
import type { ITabStripStyles } from "../../TUIDom/Widgets/EditorTabStripElement.ts";
import type { IFindWidgetStyles } from "../../TUIDom/Widgets/FindWidgetElement.ts";
import type { IPanelContainerStyles } from "../../TUIDom/Widgets/PanelContainerElement.ts";
import type { IMenuStyles } from "../../TUIDom/Widgets/PopupMenuItemElement.tsx";
import { unthemedMenuStyles } from "../../TUIDom/Widgets/PopupMenuItemElement.tsx";
import type { IScrollBarStyles } from "../../TUIDom/Widgets/ScrollContainerElement.ts";
import type { ITerminalViewStyles } from "../../TUIDom/Widgets/Terminal/TerminalViewElement.ts";
import type { ITreeViewStyles } from "../../TUIDom/Widgets/TreeViewElement.ts";
import { unthemedTreeViewStyles } from "../../TUIDom/Widgets/TreeViewElement.ts";
import type { IDialogStyles } from "../Components/Dialogs/DialogComponent.ts";

/**
 * Мост тема → стили контролов TUIDom: единственное место, где ключи темы
 * (`button.*`, `menu.*`, …) резолвятся в packed-цвета styles-интерфейсов
 * виджетов. Сами виджеты про темы не знают — контроллеры зовут эти функции
 * и передают результат в `setStyles(...)`.
 */

/**
 * Кнопки диалогов/виджетов: фокусированная кнопка — «primary» (`button.*`),
 * нефокусированная — «secondary» (`button.secondary*`). `button.*` токены
 * гарантированы реестром дефолтов, инлайн-фоллбэки не нужны.
 */
export function getDialogButtonStyles(theme: WorkbenchTheme): IButtonStyles {
    return {
        fg: theme.getRequiredColor("button.secondaryForeground"),
        bg: theme.getRequiredColor("button.secondaryBackground"),
        hoverBg: theme.getRequiredColor("button.secondaryHoverBackground"),
        focusedFg: theme.getRequiredColor("button.foreground"),
        focusedBg: theme.getRequiredColor("button.background"),
        focusedHoverBg: theme.getRequiredColor("button.hoverBackground"),
    };
}

/**
 * Окна модальных диалогов (`DialogComponent` и наследники): фон/текст/рамка —
 * ключи VS Code `editorWidget.*` (диалоги рисуются как editor-widget), пояснения —
 * `descriptionForeground`, ссылки — `textLink.foreground`, предупреждения —
 * `editorWarning.foreground`. Все ключи гарантированы реестром дефолтов.
 */
export function getDialogStyles(theme: WorkbenchTheme): IDialogStyles {
    return {
        bg: theme.getRequiredColor("editorWidget.background"),
        fg: theme.getRequiredColor("editorWidget.foreground"),
        borderFg: theme.getRequiredColor("editorWidget.border"),
        descriptionFg: theme.getRequiredColor("descriptionForeground"),
        warningFg: theme.getRequiredColor("editorWarning.foreground"),
        linkFg: theme.getRequiredColor("textLink.foreground"),
        button: getDialogButtonStyles(theme),
    };
}

export function getFindWidgetStyles(theme: WorkbenchTheme): IFindWidgetStyles {
    return { button: getDialogButtonStyles(theme) };
}

/**
 * Цвета меню из ключей VS Code `menu.*`. Они гарантированы реестром дефолтов
 * (см. {@link defaultWorkbenchColors}), а `shortcutFg` не имеет темизируемого
 * ключа VS Code и берётся из {@link unthemedMenuStyles} (baseline меню без темы).
 */
export function getMenuStyles(theme: WorkbenchTheme): IMenuStyles {
    return {
        fg: theme.getRequiredColor("menu.foreground"),
        bg: theme.getRequiredColor("menu.background"),
        highlightFg: theme.getRequiredColor("menu.selectionForeground"),
        highlightBg: theme.getRequiredColor("menu.selectionBackground"),
        shortcutFg: unthemedMenuStyles.shortcutFg,
        borderFg: theme.getRequiredColor("menu.border"),
        separatorFg: theme.getRequiredColor("menu.separatorBackground"),
    };
}

/**
 * Специализированные цвета редактора. Основные fg/bg (`editor.foreground`/
 * `editor.background`) сюда не входят — они идут через `editor.style = { fg, bg }`
 * (наследование TUIStyle). Ключи с реестровым дефолтом читаются через
 * `getRequiredColor`; genuinely-optional ключи (`editorGutter.*`,
 * `editorIndentGuide.*` — без реестрового дефолта) — через `getColor` с
 * фоллбэком: гуттер падает на фон редактора (как в VS Code), остальные — на
 * unthemed-baseline. Контекстное меню редактора едет тем же каналом (`menu`).
 */
export function getEditorStyles(theme: WorkbenchTheme): IEditorStyles {
    return {
        gutterBackground: theme.getColor("editorGutter.background") ?? theme.getRequiredColor("editor.background"),
        lineNumberForeground: theme.getRequiredColor("editorLineNumber.foreground"),
        lineNumberActiveForeground: theme.getRequiredColor("editorLineNumber.activeForeground"),
        occurrenceHighlightBackground: theme.getRequiredColor("editor.wordHighlightBackground"),
        foldingControlForeground:
            theme.getColor("editorGutter.foldingControlForeground") ?? unthemedEditorStyles.foldingControlForeground,
        indentGuideForeground:
            theme.getColor("editorIndentGuide.background1") ?? unthemedEditorStyles.indentGuideForeground,
        indentGuideActiveForeground:
            theme.getColor("editorIndentGuide.activeBackground1") ?? unthemedEditorStyles.indentGuideActiveForeground,
        errorForeground: theme.getRequiredColor("editorError.foreground"),
        warningForeground: theme.getRequiredColor("editorWarning.foreground"),
        infoForeground: theme.getRequiredColor("editorInfo.foreground"),
        hintForeground: theme.getRequiredColor("editorHint.foreground"),
        menu: getMenuStyles(theme),
    };
}

/** Общая для деревьев часть `list.*`: выделение/hover как в VS Code list. */
function getListSelectionStyles(theme: WorkbenchTheme) {
    return {
        activeSelectionBg: theme.getRequiredColor("list.activeSelectionBackground"),
        activeSelectionFg: theme.getRequiredColor("list.activeSelectionForeground"),
        inactiveSelectionBg: theme.getRequiredColor("list.inactiveSelectionBackground"),
        inactiveSelectionFg: theme.getRequiredColor("list.inactiveSelectionForeground"),
        hoverBg: theme.getRequiredColor("list.hoverBackground"),
        hoverFg: theme.getColor("list.hoverForeground"),
    };
}

/**
 * Дерево файлов (Explorer): помимо выделения темизирует приглушение
 * «вырезанных» строк и стрелку симлинка (`list.deemphasizedForeground`).
 */
export function getFileTreeStyles(theme: WorkbenchTheme): ITreeViewStyles {
    return {
        ...getListSelectionStyles(theme),
        cutFg: theme.getRequiredColor("list.deemphasizedForeground"),
        symlinkFg: theme.getRequiredColor("list.deemphasizedForeground"),
    };
}

/**
 * Дерево Problems: cut/symlink-декораций у него нет, эти цвета остаются
 * unthemed-дефолтами (исторически ProblemsController их не задавал).
 */
export function getProblemsTreeStyles(theme: WorkbenchTheme): ITreeViewStyles {
    return {
        ...getListSelectionStyles(theme),
        cutFg: unthemedTreeViewStyles.cutFg,
        symlinkFg: unthemedTreeViewStyles.symlinkFg,
    };
}

/**
 * Скроллбары поверх виджета-хозяина. `backgroundKey` — собственный фон хозяина
 * (`editor.background`, `panel.background`, …): скроллбар живёт на выделенной
 * строке/колонке, куда ребёнок не рисует, и обязан сам залить её фоном, иначе
 * просвечивает фон терминала.
 */
export function getScrollBarStyles(theme: WorkbenchTheme, backgroundKey: keyof IWorkbenchColors): IScrollBarStyles {
    return {
        thumb: theme.getRequiredColor("scrollbarSlider.background"),
        track: theme.getRequiredColor("scrollbar.background"),
        background: theme.getRequiredColor(backgroundKey),
    };
}

/** Полоса вкладок редакторной группы: `tab.*` + фон самой полосы. */
export function getTabStripStyles(theme: WorkbenchTheme): ITabStripStyles {
    return {
        activeFg: theme.getRequiredColor("tab.activeForeground"),
        activeBg: theme.getRequiredColor("tab.activeBackground"),
        inactiveFg: theme.getRequiredColor("tab.inactiveForeground"),
        inactiveBg: theme.getRequiredColor("tab.inactiveBackground"),
        stripBg: theme.getRequiredColor("editorGroupHeader.tabsBackground"),
    };
}

/**
 * Встроенный терминал: `terminal.*`, с фоллбэком на панель/редактор для тем
 * без терминальных цветов (маппинг 1:1 из бывшего TerminalController.applyThemeToWidget).
 */
export function getTerminalViewStyles(theme: WorkbenchTheme): ITerminalViewStyles {
    return {
        defaultBg: theme.getColor("terminal.background") ?? theme.getRequiredColor("panel.background"),
        defaultFg: theme.getColor("terminal.foreground") ?? theme.getRequiredColor("editor.foreground"),
    };
}

/** Нижняя панель (Problems/Terminal): фон, приглушённые заголовки вкладок, рамка. */
export function getPanelContainerStyles(theme: WorkbenchTheme): IPanelContainerStyles {
    return {
        background: theme.getRequiredColor("panel.background"),
        titleForeground: theme.getRequiredColor("panelTitle.inactiveForeground"),
        borderColor: theme.getRequiredColor("panel.border"),
    };
}
