/**
 * Фаза 5a: workbench — механический перенос Controllers/Extensions/Theme в
 * vs/workbench/{tui,services,contrib,api}, DI-профили в vs/vexx, extension host
 * RPC в services/extensions. Распил AppController — отдельным шагом (5d), здесь
 * он переезжает как есть в workbench.ts.
 *
 * Канон vscode, где 1:1: workbench.ts, editorActions.ts, coreCommands.ts,
 * extHost*.ts, extHost.api.impl.ts, extHostTypes.ts, extensionHostProcess.ts,
 * mainThread*.ts, rpcProtocol.ts, saveParticipant/textfile, languageConfiguration.ts.
 */
export const moves = [
    // ── AppController как есть → workbench.ts (распил — шаг 5d) ──────────────
    ["src/Controllers/AppController.ts", "src/vs/workbench/tui/workbench.ts"],
    ["src/Controllers/UserKeybindings.test.ts", "src/vs/workbench/tui/userKeybindings.test.ts"],
    ["src/Controllers/WorkbenchStateController.ts", "src/vs/workbench/tui/workbenchStateController.ts"],
    ["src/Controllers/CoreTokens.ts", "src/vs/workbench/tui/coreTokens.ts"],
    ["src/Controllers/IController.ts", "src/vs/workbench/common/controller.ts"],
    ["src/Controllers/StateKeys.ts", "src/vs/workbench/common/stateKeys.ts"],
    // ── parts/editor ─────────────────────────────────────────────────────────
    ["src/Controllers/EditorGroupController.ts", "src/vs/workbench/tui/parts/editor/editorGroupController.ts"],
    ["src/Controllers/EditorController.ts", "src/vs/workbench/tui/parts/editor/editorController.ts"],
    ["src/Controllers/Actions/TabActions.ts", "src/vs/workbench/tui/parts/editor/tabActions.ts"],
    ["src/Controllers/Actions/EditorEditActions.ts", "src/vs/workbench/tui/parts/editor/editorEditActions.ts"],
    ["src/Controllers/Actions/EolActions.ts", "src/vs/workbench/tui/parts/editor/eolActions.ts"],
    ["src/Controllers/Actions/WhitespaceActions.ts", "src/vs/workbench/tui/parts/editor/whitespaceActions.ts"],
    ["src/Controllers/Actions/ClipboardActions.ts", "src/vs/workbench/tui/parts/editor/clipboardActions.ts"],
    // cursor*-команды ≈ vscode editor/browser/coreCommands.ts
    ["src/Controllers/Actions/EditorActions.ts", "src/vs/editor/tui/coreCommands.ts"],
    // ── parts/statusbar, parts/panel ─────────────────────────────────────────
    ["src/Controllers/StatusBarController.ts", "src/vs/workbench/tui/parts/statusbar/statusBarController.ts"],
    ["src/Controllers/PanelController.ts", "src/vs/workbench/tui/parts/panel/panelController.ts"],
    // ── глобальные экшены ────────────────────────────────────────────────────
    ["src/Controllers/Actions/AppActions.ts", "src/vs/workbench/tui/actions/appActions.ts"],
    ["src/Controllers/Actions/ListActions.ts", "src/vs/workbench/tui/actions/listActions.ts"],
    ["src/Controllers/Actions/InputActions.ts", "src/vs/workbench/tui/actions/inputActions.ts"],
    // ── contrib/files ────────────────────────────────────────────────────────
    ["src/Controllers/FileTreeController.ts", "src/vs/workbench/contrib/files/tui/fileTreeController.ts"],
    ["src/Controllers/FileTreeDataProvider.ts", "src/vs/workbench/contrib/files/tui/fileTreeDataProvider.ts"],
    ["src/Controllers/InputWidgetController.ts", "src/vs/workbench/contrib/files/tui/inputWidgetController.ts"],
    ["src/Controllers/Actions/FileActions.ts", "src/vs/workbench/contrib/files/tui/fileActions.ts"],
    ["src/Controllers/Actions/FileTreeActions.ts", "src/vs/workbench/contrib/files/tui/fileTreeActions.ts"],
    ["src/Controllers/Actions/FileTreeClipboardActions.ts", "src/vs/workbench/contrib/files/tui/fileTreeClipboardActions.ts"],
    ["src/Controllers/Actions/FileTreeCreateActions.ts", "src/vs/workbench/contrib/files/tui/fileTreeCreateActions.ts"],
    // ── contrib/markers (Problems) ───────────────────────────────────────────
    ["src/Controllers/ProblemsController.ts", "src/vs/workbench/contrib/markers/tui/problemsController.ts"],
    ["src/Controllers/DiagnosticsController.ts", "src/vs/workbench/contrib/markers/tui/diagnosticsController.ts"],
    ["src/Controllers/Diagnostics/ProblemsTreeDataProvider.ts", "src/vs/workbench/contrib/markers/tui/problemsTreeDataProvider.ts"],
    // ── contrib/preferences ──────────────────────────────────────────────────
    ["src/Controllers/Diagnostics/SettingsDiagnostics.ts", "src/vs/workbench/contrib/preferences/common/settingsDiagnostics.ts"],
    ["src/Controllers/Actions/PreferencesActions.ts", "src/vs/workbench/contrib/preferences/tui/preferencesActions.ts"],
    // ── contrib/quickaccess ──────────────────────────────────────────────────
    ["src/Controllers/QuickOpenController.ts", "src/vs/workbench/contrib/quickaccess/tui/quickOpenController.ts"],
    ["src/Controllers/QuickOpenParsing.ts", "src/vs/workbench/contrib/quickaccess/common/quickOpenParsing.ts"],
    ["src/Controllers/Actions/QuickOpenActions.ts", "src/vs/workbench/contrib/quickaccess/tui/quickOpenActions.ts"],
    // ── contrib/themes ───────────────────────────────────────────────────────
    ["src/Controllers/Actions/ThemeActions.ts", "src/vs/workbench/contrib/themes/tui/themeActions.ts"],
    // ── contrib/bulkEdit ─────────────────────────────────────────────────────
    ["src/Controllers/Workspace/WorkspaceEdit.ts", "src/vs/workbench/contrib/bulkEdit/common/workspaceEdit.ts"],
    ["src/Controllers/Workspace/WorkspaceEditService.ts", "src/vs/workbench/contrib/bulkEdit/node/workspaceEditService.ts"],
    // ── services/search ──────────────────────────────────────────────────────
    ["src/Controllers/FileSearchService.ts", "src/vs/workbench/services/search/node/fileSearchService.ts"],
    // ── services/textfile ────────────────────────────────────────────────────
    ["src/Editor/ISaveParticipant.ts", "src/vs/workbench/services/textfile/common/saveParticipant.ts"],
    // ── services/textMate ────────────────────────────────────────────────────
    { dir: "src/Editor/Tokenization/textmate", to: "src/vs/workbench/services/textMate/common" },
    ["src/Extensions/ExtensionTokenizationContributor.ts", "src/vs/workbench/services/textMate/common/extensionTokenizationContributor.ts"],
    ["src/Extensions/IGrammarContribution.ts", "src/vs/workbench/services/textMate/common/grammarContribution.ts"],
    // ── services/language ────────────────────────────────────────────────────
    ["src/Extensions/LanguageRegistry.ts", "src/vs/workbench/services/language/common/languageRegistry.ts"],
    ["src/Extensions/ILanguageContribution.ts", "src/vs/workbench/services/language/common/languageContribution.ts"],
    ["src/Extensions/BuiltinLanguagePacks.test.ts", "src/vs/workbench/services/language/common/builtinLanguagePacks.test.ts"],
    ["src/Extensions/ILanguageConfiguration.ts", "src/vs/editor/common/languages/languageConfiguration.ts"],
    ["src/Extensions/mergeExtensions.ts", "src/vs/platform/extensions/common/mergeExtensions.ts"],
    // ── services/themes ──────────────────────────────────────────────────────
    ["src/Theme/ThemeService.ts", "src/vs/workbench/services/themes/common/themeService.ts"],
    ["src/Theme/ThemeRegistry.ts", "src/vs/workbench/services/themes/common/themeRegistry.ts"],
    ["src/Theme/WorkbenchTheme.ts", "src/vs/workbench/services/themes/common/workbenchTheme.ts"],
    ["src/Theme/ThemeTokens.ts", "src/vs/workbench/services/themes/common/themeTokens.ts"],
    ["src/Theme/IThemeFile.ts", "src/vs/workbench/services/themes/common/themeFile.ts"],
    ["src/Theme/IVSCodeThemeFile.ts", "src/vs/workbench/services/themes/common/vscodeThemeFile.ts"],
    ["src/Theme/IEditorTokenTheme.ts", "src/vs/workbench/services/themes/common/editorTokenTheme.ts"],
    ["src/Theme/index.ts", "src/vs/workbench/services/themes/common/index.ts"],
    ["src/Theme/Tokenization/TokenThemeResolver.ts", "src/vs/workbench/services/themes/common/tokenThemeResolver.ts"],
    { dir: "src/Theme/themes", to: "src/vs/workbench/services/themes/common/themes" },
    // ── services/extensions (RPC + host manager) ─────────────────────────────
    ["src/Extensions/Host/RpcEndpoint.ts", "src/vs/workbench/services/extensions/common/rpcProtocol.ts"],
    ["src/Extensions/Host/IMessageChannel.ts", "src/vs/workbench/services/extensions/common/messageChannel.ts"],
    ["src/Extensions/Host/InProcessChannelPair.ts", "src/vs/workbench/services/extensions/common/inProcessChannelPair.ts"],
    ["src/Extensions/Host/IpcMessageChannel.ts", "src/vs/workbench/services/extensions/node/ipcMessageChannel.ts"],
    ["src/Extensions/Host/ExtensionHost.ts", "src/vs/workbench/services/extensions/node/extensionHost.ts"],
    ["src/Extensions/Host/IExtensionEntry.ts", "src/vs/workbench/services/extensions/common/extensionEntry.ts"],
    { dir: "src/Extensions/Host/__fixtures__", to: "src/vs/workbench/services/extensions/node/__fixtures__", rename: "keep" },
    // ── api/common (extHost-сторона) ─────────────────────────────────────────
    ["src/Extensions/Host/VscodeNamespace.ts", "src/vs/workbench/api/common/extHost.api.impl.ts"],
    ["src/Extensions/Host/WireTypes.ts", "src/vs/workbench/api/common/extHost.protocol.ts"],
    ["src/Extensions/Host/Vscode/CommandsNamespace.ts", "src/vs/workbench/api/common/extHostCommands.ts"],
    ["src/Extensions/Host/Vscode/DocumentSelector.ts", "src/vs/workbench/api/common/documentSelector.ts"],
    ["src/Extensions/Host/Vscode/ExtHostDocuments.ts", "src/vs/workbench/api/common/extHostDocuments.ts"],
    ["src/Extensions/Host/Vscode/FileSystemNamespace.ts", "src/vs/workbench/api/common/extHostFileSystem.ts"],
    ["src/Extensions/Host/Vscode/LanguagesNamespace.ts", "src/vs/workbench/api/common/extHostLanguages.ts"],
    ["src/Extensions/Host/Vscode/WindowNamespace.ts", "src/vs/workbench/api/common/extHostWindow.ts"],
    ["src/Extensions/Host/Vscode/WorkspaceNamespace.ts", "src/vs/workbench/api/common/extHostWorkspace.ts"],
    ["src/Extensions/Host/Vscode/WorkspaceConfigStore.ts", "src/vs/workbench/api/common/extHostConfiguration.ts"],
    ["src/Extensions/Host/Vscode/VscodeTypes.ts", "src/vs/workbench/api/common/extHostTypes.ts"],
    ["src/Extensions/Host/Vscode/VscodeHostContext.ts", "src/vs/workbench/api/common/extHostContext.ts"],
    ["src/Extensions/Host/Vscode/testStubRpc.ts", "src/vs/workbench/api/common/testStubRpc.ts"],
    // ── api/node ─────────────────────────────────────────────────────────────
    ["src/Extensions/Host/ExtensionHostSubprocess.ts", "src/vs/workbench/api/node/extensionHostProcess.ts"],
    // ── api/tui (mainThread-адаптеры) ────────────────────────────────────────
    ["src/Extensions/Host/CommandServiceAdapter.ts", "src/vs/workbench/api/tui/mainThreadCommands.ts"],
    ["src/Extensions/Host/EditorDecorationsServiceAdapter.ts", "src/vs/workbench/api/tui/mainThreadEditorDecorations.ts"],
    ["src/Extensions/Host/EditorOptionsServiceAdapter.ts", "src/vs/workbench/api/tui/mainThreadEditorOptions.ts"],
    ["src/Extensions/Host/FileDecorationsServiceAdapter.ts", "src/vs/workbench/api/tui/mainThreadDecorations.ts"],
    ["src/Extensions/Host/ThemeColorResolverAdapter.ts", "src/vs/workbench/api/tui/mainThreadThemeColors.ts"],
    ["src/Extensions/Host/DecorationsServiceAdapters.test.ts", "src/vs/workbench/api/tui/mainThreadDecorations.adapters.test.ts"],
    // ── порты host-сервисов (интерфейсы) ─────────────────────────────────────
    ["src/Extensions/Host/ICommandService.ts", "src/vs/workbench/api/common/commandService.ts"],
    ["src/Extensions/Host/IEditorDecorationsService.ts", "src/vs/workbench/api/common/editorDecorationsService.ts"],
    ["src/Extensions/Host/IEditorOptionsService.ts", "src/vs/workbench/api/common/editorOptionsService.ts"],
    ["src/Extensions/Host/IFileDecorationsService.ts", "src/vs/workbench/api/common/fileDecorationsService.ts"],
    ["src/Extensions/Host/IThemeColorResolver.ts", "src/vs/workbench/api/common/themeColorResolver.ts"],
    // ── vscode.d.ts → как у upstream ─────────────────────────────────────────
    ["src/Extensions/Api/vscode.d.ts", "src/vscode-dts/vscode.d.ts"],
    // ── точка входа и DI-профили → vs/vexx ───────────────────────────────────
    ["src/main.ts", "src/vs/vexx/main.ts"],
    { dir: "src/Controllers/Modules", to: "src/vs/vexx/modules" },
    // ── терминальное окружение (vexx-специфика) ──────────────────────────────
    { dir: "src/Controllers/TerminalEnvironment", to: "src/vs/workbench/terminalEnvironment" },
];

export const stringPrefixes = [
    ["src/Extensions/Host/__fixtures__/", "src/vs/workbench/services/extensions/node/__fixtures__/"],
    ["src/Controllers/Modules/", "src/vs/vexx/modules/"],
];
