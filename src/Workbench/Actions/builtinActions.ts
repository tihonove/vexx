import { showAboutDialogAction } from "./AppActions.ts";
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction } from "./ClipboardActions.ts";
import type { CommandAction } from "./CommandAction.ts";
import { showEditorContextMenuAction } from "./ContextMenuActions.ts";
import {
    cursorBottomAction,
    cursorBottomSelectAction,
    cursorDownAction,
    cursorDownSelectAction,
    cursorEndAction,
    cursorEndSelectAction,
    cursorHomeAction,
    cursorHomeSelectAction,
    cursorLeftAction,
    cursorLeftSelectAction,
    cursorPageDownAction,
    cursorPageDownSelectAction,
    cursorPageUpAction,
    cursorPageUpSelectAction,
    cursorRightAction,
    cursorRightSelectAction,
    cursorTopAction,
    cursorTopSelectAction,
    cursorUpAction,
    cursorUpSelectAction,
    cursorWordLeftAction,
    cursorWordLeftSelectAction,
    cursorWordRightAction,
    cursorWordRightSelectAction,
    scrollLineDownAction,
    scrollLineUpAction,
} from "./EditorActions.ts";
import {
    deleteLeftAction,
    deleteRightAction,
    deleteWordLeftAction,
    deleteWordRightAction,
    indentLinesAction,
    outdentLinesAction,
    redoAction,
    selectAllAction,
    undoAction,
} from "./EditorEditActions.ts";
import { changeEncodingAction } from "./EncodingActions.ts";
import { changeEolAction, convertToCrlfAction, convertToLfAction, toggleEolAction } from "./EolActions.ts";
import {
    fileOpenAction,
    fileOpenFolderAction,
    fileSaveAction,
    fileSaveAsAction,
    newUntitledFileAction,
} from "./FileActions.ts";
import {
    fileDeleteAction,
    fileRedoAction,
    fileRenameAction,
    fileUndoAction,
    refreshExplorerAction,
    showExplorerContextMenuAction,
} from "./FileTreeActions.ts";
import {
    fileCopyAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    fileCutAction,
    filePasteAction,
} from "./FileTreeClipboardActions.ts";
import { explorerNewFileAction, explorerNewFolderAction } from "./FileTreeCreateActions.ts";
import { closeFindWidgetAction, findAction, nextMatchAction, previousMatchAction } from "./FindActions.ts";
import {
    foldAction,
    foldAllAction,
    foldLevelActions,
    foldRecursivelyAction,
    gotoNextFoldAction,
    gotoPreviousFoldAction,
    toggleFoldAction,
    unfoldAction,
    unfoldAllAction,
    unfoldRecursivelyAction,
} from "./FoldingActions.ts";
import {
    inputCopyAction,
    inputCursorEndAction,
    inputCursorHomeAction,
    inputCursorLeftAction,
    inputCursorRightAction,
    inputCursorWordLeftAction,
    inputCursorWordRightAction,
    inputCutAction,
    inputDeleteLeftAction,
    inputDeleteRightAction,
    inputDeleteWordLeftAction,
    inputDeleteWordRightAction,
    inputPasteAction,
    inputRedoAction,
    inputSelectAllAction,
    inputSelectLeftAction,
    inputSelectRightAction,
    inputSelectToEndAction,
    inputSelectToHomeAction,
    inputSelectWordLeftAction,
    inputSelectWordRightAction,
    inputUndoAction,
} from "./InputActions.ts";
import {
    decreaseSidebarWidthAction,
    increaseSidebarWidthAction,
    resetSidebarWidthAction,
    revealActiveFileInExplorerAction,
    showExplorerAction,
    togglePanelAction,
    toggleProblemsAction,
    toggleSidebarAction,
} from "./LayoutActions.ts";
import {
    listFocusFirstAction,
    listFocusLastAction,
    listFocusPageDownAction,
    listFocusPageUpAction,
} from "./ListActions.ts";
import { openKeybindingsAction, openSettingsAction } from "./PreferencesActions.ts";
import { gotoLineAction, quickOpenAction, showCommandsAction } from "./QuickOpenActions.ts";
import {
    acceptSelectedSuggestionAction,
    hideSuggestWidgetAction,
    selectNextPageSuggestionAction,
    selectNextSuggestionAction,
    selectPrevPageSuggestionAction,
    selectPrevSuggestionAction,
    triggerSuggestAction,
} from "./SuggestActions.ts";
import { closeActiveEditorAction, nextEditorInGroupAction, previousEditorInGroupAction } from "./TabActions.ts";
import { newTerminalAction, toggleTerminalAction } from "./TerminalActions.ts";
import { selectThemeAction } from "./ThemeActions.ts";
import { insertFinalNewLineAction, trimTrailingWhitespaceAction } from "./WhitespaceActions.ts";

/**
 * Реестр встроенных экшенов Workbench'а. Регистрирует их владелец приложения
 * (сейчас `AppController`) единым циклом `registerAction`; ПОРЯДОК ВАЖЕН —
 * `KeybindingRegistry.resolveKey` берёт последний зарегистрированный биндинг с
 * проходящим `when` (см. комментарий у Find/Suggest-хвоста).
 */
export const builtinActions: readonly CommandAction[] = [
    // App
    fileSaveAction,
    fileSaveAsAction,
    newUntitledFileAction,
    fileOpenAction,
    fileOpenFolderAction,
    openSettingsAction,
    openKeybindingsAction,
    showAboutDialogAction,

    // Quick Open / пикеры (этап 8: run-обработчики живут в самих экшенах)
    quickOpenAction,
    showCommandsAction,
    gotoLineAction,
    selectThemeAction,
    changeEncodingAction,
    changeEolAction,

    // Cursor movement
    cursorLeftAction,
    cursorLeftSelectAction,
    cursorRightAction,
    cursorRightSelectAction,
    cursorUpAction,
    cursorUpSelectAction,
    cursorDownAction,
    cursorDownSelectAction,
    cursorHomeAction,
    cursorHomeSelectAction,
    cursorEndAction,
    cursorEndSelectAction,
    cursorTopAction,
    cursorTopSelectAction,
    cursorBottomAction,
    cursorBottomSelectAction,
    cursorWordLeftAction,
    cursorWordLeftSelectAction,
    cursorWordRightAction,
    cursorWordRightSelectAction,
    cursorPageDownAction,
    cursorPageDownSelectAction,
    cursorPageUpAction,
    cursorPageUpSelectAction,
    scrollLineUpAction,
    scrollLineDownAction,

    // Editing
    deleteLeftAction,
    deleteRightAction,
    deleteWordLeftAction,
    deleteWordRightAction,
    undoAction,
    redoAction,
    selectAllAction,
    indentLinesAction,
    outdentLinesAction,

    // End of line
    convertToLfAction,
    convertToCrlfAction,
    toggleEolAction,

    // Folding
    foldAction,
    unfoldAction,
    toggleFoldAction,
    foldAllAction,
    unfoldAllAction,
    foldRecursivelyAction,
    unfoldRecursivelyAction,
    ...foldLevelActions,
    gotoNextFoldAction,
    gotoPreviousFoldAction,

    // Whitespace
    trimTrailingWhitespaceAction,
    insertFinalNewLineAction,
    triggerSuggestAction,

    // Clipboard
    clipboardCopyAction,
    clipboardCutAction,
    clipboardPasteAction,

    // Context menu (Shift+F10)
    showEditorContextMenuAction,
    showExplorerContextMenuAction,

    // Explorer file operations (Workbench/Actions поверх Explorer/FileOperations-сервисов)
    fileDeleteAction,
    fileRenameAction,
    refreshExplorerAction,
    fileUndoAction,
    fileRedoAction,
    fileCopyAction,
    fileCutAction,
    filePasteAction,
    fileCopyPathAction,
    fileCopyRelativePathAction,
    explorerNewFileAction,
    explorerNewFolderAction,

    // List
    listFocusPageDownAction,
    listFocusPageUpAction,
    listFocusFirstAction,
    listFocusLastAction,

    // Tabs
    nextEditorInGroupAction,
    previousEditorInGroupAction,
    closeActiveEditorAction,

    // Input widget
    inputCursorLeftAction,
    inputCursorRightAction,
    inputCursorHomeAction,
    inputCursorEndAction,
    inputCursorWordLeftAction,
    inputCursorWordRightAction,
    inputDeleteLeftAction,
    inputDeleteRightAction,
    inputDeleteWordLeftAction,
    inputDeleteWordRightAction,
    inputSelectLeftAction,
    inputSelectRightAction,
    inputSelectToHomeAction,
    inputSelectToEndAction,
    inputSelectWordLeftAction,
    inputSelectWordRightAction,
    inputSelectAllAction,
    inputCopyAction,
    inputCutAction,
    inputPasteAction,
    inputUndoAction,
    inputRedoAction,

    // Find / Suggest (этап 10: run-обработчики живут в самих экшенах поверх
    // FindService/CompletionService). Регистрируются ПОСЛЕДНИМИ, чтобы биндинги
    // `findWidgetVisible`/`suggestWidgetVisible` победили editor-команды
    // (cursorDown/indentLines и т.п.) — KeybindingRegistry.resolveKey берёт
    // последний зарегистрированный с проходящим `when`.
    findAction,
    nextMatchAction,
    previousMatchAction,
    closeFindWidgetAction,
    selectNextSuggestionAction,
    selectPrevSuggestionAction,
    selectNextPageSuggestionAction,
    selectPrevPageSuggestionAction,
    acceptSelectedSuggestionAction,
    hideSuggestWidgetAction,

    // Layout / Panel / Terminal (этап 11: run-обработчики поверх LayoutService/
    // PanelService/TerminalService). Ключи не пересекаются с editor/find/suggest-
    // биндингами, поэтому позиция после Find/Suggest-хвоста безопасна.
    toggleSidebarAction,
    showExplorerAction,
    revealActiveFileInExplorerAction,
    increaseSidebarWidthAction,
    decreaseSidebarWidthAction,
    resetSidebarWidthAction,
    togglePanelAction,
    toggleProblemsAction,
    toggleTerminalAction,
    newTerminalAction,
];
