/**
 * Typed context keys for when-clause evaluation.
 * Based on VS Code when-clause contexts reference:
 * https://code.visualstudio.com/api/references/when-clause-contexts
 *
 * Active keys are uncommented and used in the current codebase.
 * Commented-out keys are reserved for future use — uncomment as features are implemented.
 */

export interface ContextKeyTypes {
    // -- Editor contexts --
    // editorFocus: boolean;
    // editorTextFocus: boolean;
    textInputFocus: boolean;
    // inputFocus: boolean;
    // editorTabMovesFocus: boolean;
    // editorHasSelection: boolean;
    // editorHasMultipleSelections: boolean;
    // editorReadonly: boolean;
    // editorLangId: string;
    // isInDiffEditor: boolean;
    // isInEmbeddedEditor: boolean;

    // -- List contexts --
    listFocus: boolean;
    // listSupportsMultiselect: boolean;
    // listHasSelectionOrFocus: boolean;
    // listDoubleSelection: boolean;
    // listMultiSelection: boolean;

    // -- Mode contexts --
    // inSnippetMode: boolean;
    // inQuickOpen: boolean;

    // -- Resource contexts --
    // resourceScheme: string;
    // resourceFilename: string;
    // resourceExtname: string;
    // resourceDirname: string;
    // resourcePath: string;
    // resourceLangId: string;
    // isFileSystemResource: boolean;
    // resourceSet: boolean;
    // resource: string;

    // -- Explorer contexts --
    // explorerViewletVisible: boolean;
    // explorerViewletFocus: boolean;
    // filesExplorerFocus: boolean;
    // openEditorsFocus: boolean;
    // explorerResourceIsFolder: boolean;

    // -- Editor widget contexts --
    // findWidgetVisible: boolean;
    // suggestWidgetVisible: boolean;
    // suggestWidgetMultipleSuggestions: boolean;
    // renameInputVisible: boolean;
    // referenceSearchVisible: boolean;
    // inReferenceSearchEditor: boolean;
    // codeActionMenuVisible: boolean;
    // parameterHintsVisible: boolean;
    // parameterHintsMultipleSignatures: boolean;

    // -- Debugger contexts --
    // debuggersAvailable: boolean;
    // inDebugMode: boolean;
    // debugState: string;
    // debugType: string;
    // inDebugRepl: boolean;

    // -- Integrated terminal contexts --
    // terminalFocus: boolean;
    // terminalIsOpen: boolean;

    // -- Global UI contexts --
    // notificationFocus: boolean;
    // notificationCenterVisible: boolean;
    // notificationToastsVisible: boolean;
    // searchViewletVisible: boolean;
    // sideBarVisible: boolean;
    // sideBarFocus: boolean;
    // panelFocus: boolean;
    // auxiliaryBarFocus: boolean;
    // inZenMode: boolean;
    // isCenteredLayout: boolean;
    // isFullscreen: boolean;
    // focusedView: string;
    // canNavigateBack: boolean;
    // canNavigateForward: boolean;
    // canNavigateToLastEditLocation: boolean;

    // -- Global Editor UI contexts --
    // textCompareEditorVisible: boolean;
    // textCompareEditorActive: boolean;
    // editorIsOpen: boolean;
    // groupEditorsCount: number;
    // activeEditorGroupEmpty: boolean;
    // activeEditorGroupIndex: number;
    // activeEditorGroupLast: boolean;
    // multipleEditorGroups: boolean;
    // activeEditor: string;
    // activeEditorIsDirty: boolean;
    // activeEditorIsNotPreview: boolean;
    // activeEditorIsPinned: boolean;
    // inSearchEditor: boolean;

    // -- OS contexts --
    // isLinux: boolean;
    // isMac: boolean;
    // isWindows: boolean;
    // isWeb: boolean;

    // -- Workspace contexts --
    // workbenchState: string;
    // workspaceFolderCount: number;
    // replaceActive: boolean;

    // -- View contexts --
    // view: string;
    // viewItem: string;
    // activeViewlet: string;
    // activePanel: string;
    // activeAuxiliary: string;
}

export type ContextKey = keyof ContextKeyTypes;
export type ContextKeyValue = ContextKeyTypes[ContextKey];

export const allContextKeys: ContextKey[] = [
    // -- Editor contexts --
    // "editorFocus",
    // "editorTextFocus",
    "textInputFocus",
    // "inputFocus",
    // "editorTabMovesFocus",
    // "editorHasSelection",
    // "editorHasMultipleSelections",
    // "editorReadonly",
    // "editorLangId",
    // "isInDiffEditor",
    // "isInEmbeddedEditor",

    // -- List contexts --
    "listFocus",
    // "listSupportsMultiselect",
    // "listHasSelectionOrFocus",
    // "listDoubleSelection",
    // "listMultiSelection",

    // -- Mode contexts --
    // "inSnippetMode",
    // "inQuickOpen",

    // -- Resource contexts --
    // "resourceScheme",
    // "resourceFilename",
    // "resourceExtname",
    // "resourceDirname",
    // "resourcePath",
    // "resourceLangId",
    // "isFileSystemResource",
    // "resourceSet",
    // "resource",

    // -- Explorer contexts --
    // "explorerViewletVisible",
    // "explorerViewletFocus",
    // "filesExplorerFocus",
    // "openEditorsFocus",
    // "explorerResourceIsFolder",

    // -- Editor widget contexts --
    // "findWidgetVisible",
    // "suggestWidgetVisible",
    // "suggestWidgetMultipleSuggestions",
    // "renameInputVisible",
    // "referenceSearchVisible",
    // "inReferenceSearchEditor",
    // "codeActionMenuVisible",
    // "parameterHintsVisible",
    // "parameterHintsMultipleSignatures",

    // -- Debugger contexts --
    // "debuggersAvailable",
    // "inDebugMode",
    // "debugState",
    // "debugType",
    // "inDebugRepl",

    // -- Integrated terminal contexts --
    // "terminalFocus",
    // "terminalIsOpen",

    // -- Global UI contexts --
    // "notificationFocus",
    // "notificationCenterVisible",
    // "notificationToastsVisible",
    // "searchViewletVisible",
    // "sideBarVisible",
    // "sideBarFocus",
    // "panelFocus",
    // "auxiliaryBarFocus",
    // "inZenMode",
    // "isCenteredLayout",
    // "isFullscreen",
    // "focusedView",
    // "canNavigateBack",
    // "canNavigateForward",
    // "canNavigateToLastEditLocation",

    // -- Global Editor UI contexts --
    // "textCompareEditorVisible",
    // "textCompareEditorActive",
    // "editorIsOpen",
    // "groupEditorsCount",
    // "activeEditorGroupEmpty",
    // "activeEditorGroupIndex",
    // "activeEditorGroupLast",
    // "multipleEditorGroups",
    // "activeEditor",
    // "activeEditorIsDirty",
    // "activeEditorIsNotPreview",
    // "activeEditorIsPinned",
    // "inSearchEditor",

    // -- OS contexts --
    // "isLinux",
    // "isMac",
    // "isWindows",
    // "isWeb",

    // -- Workspace contexts --
    // "workbenchState",
    // "workspaceFolderCount",
    // "replaceActive",

    // -- View contexts --
    // "view",
    // "viewItem",
    // "activeViewlet",
    // "activePanel",
    // "activeAuxiliary",
];
