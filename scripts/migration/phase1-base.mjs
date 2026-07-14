/**
 * Фаза 1: base — Common → vs/base/{common,node} (+ куски в platform по vscode-каноничным
 * местам), TUIDom → vs/base/tui, Widgets → vs/base/tui/ui/<виджет>/ и по фичевым местам
 * (find/suggest/quickinput/workbench parts) — см. docs/VSCODE_STRUCTURE_MIGRATION.md §5.
 *
 * Имена файлов, где есть 1:1 vscode-аналог, берутся каноничные (lifecycle.ts, types.ts,
 * log.ts, logService.ts, bufferLog.ts, argv.ts, userDataPath.ts, scrollable.ts,
 * scrollableElement.ts, tree.ts, instantiation.ts, clipboardService.ts, product.ts).
 */
export const moves = [
    // ── Common → vs/base/common ──────────────────────────────────────────────
    ["src/Common/Disposable.ts", "src/vs/base/common/lifecycle.ts"],
    ["src/Common/TypingUtils.ts", "src/vs/base/common/types.ts"],
    ["src/Common/GeometryPromitives.ts", "src/vs/base/common/geometry.ts"],
    ["src/Common/DisplayLine.ts", "src/vs/base/common/displayLine.ts"],
    ["src/Common/UnicodeWidth.ts", "src/vs/base/common/unicodeWidth.ts"],
    ["src/Common/TextTruncation.ts", "src/vs/base/common/textTruncation.ts"],
    ["src/Common/FuzzySearch.ts", "src/vs/base/common/fuzzySearch.ts"],
    // ── Common → vs/base/node (node-специфика: SEA, fs) ──────────────────────
    ["src/Common/IsSea.ts", "src/vs/base/node/isSea.ts"],
    // ── Assets ───────────────────────────────────────────────────────────────
    ["src/Common/Assets/IAssetAccess.ts", "src/vs/base/common/assets/assets.ts"],
    ["src/Common/Assets/AssetBundleFormat.ts", "src/vs/base/common/assets/assetBundleFormat.ts"],
    ["src/Common/Assets/BundleAssetAccess.ts", "src/vs/base/common/assets/bundleAssetAccess.ts"],
    ["src/Common/Assets/CompositeAssetAccess.ts", "src/vs/base/common/assets/compositeAssetAccess.ts"],
    ["src/Common/Assets/FsAssetAccess.ts", "src/vs/base/node/assets/fsAssetAccess.ts"],
    ["src/Common/Assets/createDefaultAssetAccess.ts", "src/vs/base/node/assets/createDefaultAssetAccess.ts"],
    // ── DI-примитивы → platform/instantiation (токенная модель, путь vscode) ─
    ["src/Common/DiContainer.ts", "src/vs/platform/instantiation/common/instantiation.ts"],
    // ── Logging → platform/log ───────────────────────────────────────────────
    ["src/Common/Logging/ILogService.ts", "src/vs/platform/log/common/log.ts"],
    ["src/Common/Logging/ILogger.ts", "src/vs/platform/log/common/logger.ts"],
    ["src/Common/Logging/LogLevel.ts", "src/vs/platform/log/common/logLevel.ts"],
    ["src/Common/Logging/LogService.ts", "src/vs/platform/log/common/logService.ts"],
    ["src/Common/Logging/NullLogService.ts", "src/vs/platform/log/common/nullLogService.ts"],
    ["src/Common/Logging/ILogServiceDIToken.ts", "src/vs/platform/log/common/logDIToken.ts"],
    ["src/Common/Logging/sinks/RingBufferSink.ts", "src/vs/platform/log/common/bufferLog.ts"],
    ["src/Common/Logging/sinks/FileSink.ts", "src/vs/platform/log/node/fileLog.ts"],
    // ── Clipboard → platform/clipboard ───────────────────────────────────────
    ["src/Common/IClipboard.ts", "src/vs/platform/clipboard/common/clipboardService.ts"],
    ["src/Common/InMemoryClipboard.ts", "src/vs/platform/clipboard/common/inMemoryClipboard.ts"],
    ["src/Common/IFileClipboard.ts", "src/vs/platform/clipboard/common/fileClipboard.ts"],
    ["src/Common/InMemoryFileClipboard.ts", "src/vs/platform/clipboard/common/inMemoryFileClipboard.ts"],
    ["src/Common/OscClipboard.ts", "src/vs/platform/clipboard/tui/oscClipboard.ts"],
    // ── Environment/Product → platform ───────────────────────────────────────
    ["src/Common/CliArgs.ts", "src/vs/platform/environment/node/argv.ts"],
    ["src/Common/UserDataPaths.ts", "src/vs/platform/environment/node/userDataPath.ts"],
    ["src/Common/TerminalEnv.ts", "src/vs/platform/environment/common/terminalEnv.ts"],
    ["src/Common/Version.ts", "src/vs/platform/product/common/product.ts"],
    // ── FileIcons: потребители — только workbench-уровень ────────────────────
    ["src/Common/FileIcons.ts", "src/vs/workbench/tui/fileIcons.ts"],

    // ── TUIDom-ядро → vs/base/tui ────────────────────────────────────────────
    ["src/TUIDom/TUIElement.ts", "src/vs/base/tui/tuiElement.ts"],
    ["src/TUIDom/CompositeElement.ts", "src/vs/base/tui/compositeElement.ts"],
    ["src/TUIDom/BorderStyle.ts", "src/vs/base/tui/borderStyle.ts"],
    ["src/TUIDom/TuiApplication.ts", "src/vs/base/tui/tuiApplication.ts"],
    ["src/TUIDom/TUISelector.ts", "src/vs/base/tui/tuiSelector.ts"],
    ["src/TUIDom/RenderContext.DrawBox.test.ts", "src/vs/base/tui/renderContext.drawBox.test.ts"],
    { dir: "src/TUIDom/Events", to: "src/vs/base/tui/events" },
    { dir: "src/TUIDom/Styles", to: "src/vs/base/tui/styles" },
    ["src/TUIDom/JSX/jsx-runtime.ts", "src/vs/base/tui/jsx/jsx-runtime.ts"],
    ["src/TUIDom/JSX/reconcile.ts", "src/vs/base/tui/jsx/reconcile.ts"],
    ["src/TUIDom/Widgets/BodyElement.ts", "src/vs/base/tui/bodyElement.ts"],

    // ── Widgets → vs/base/tui/ui/<виджет> ────────────────────────────────────
    ["src/TUIDom/Widgets/ScrollableElement.ts", "src/vs/base/tui/ui/scrollbar/scrollableElement.ts"],
    ["src/TUIDom/Widgets/ScrollBarRenderer.ts", "src/vs/base/tui/ui/scrollbar/scrollBarRenderer.ts"],
    ["src/TUIDom/Widgets/ScrollViewport.ts", "src/vs/base/tui/ui/scrollbar/scrollViewport.ts"],
    ["src/TUIDom/Widgets/ScrollContainerElement.ts", "src/vs/base/tui/ui/scrollbar/scrollContainerElement.ts"],
    ["src/TUIDom/Widgets/IScrollable.ts", "src/vs/base/common/scrollable.ts"],
    ["src/TUIDom/Widgets/TreeViewElement.ts", "src/vs/base/tui/ui/tree/treeViewElement.ts"],
    ["src/TUIDom/Widgets/ITreeDataProvider.ts", "src/vs/base/tui/ui/tree/tree.ts"],
    ["src/TUIDom/Widgets/InputElement.ts", "src/vs/base/tui/ui/inputbox/inputElement.ts"],
    ["src/TUIDom/Widgets/InputState.ts", "src/vs/base/tui/ui/inputbox/inputState.ts"],
    ["src/TUIDom/Widgets/ButtonElement.ts", "src/vs/base/tui/ui/button/buttonElement.ts"],
    ["src/TUIDom/Widgets/SashElement.ts", "src/vs/base/tui/ui/sash/sashElement.ts"],
    ["src/TUIDom/Widgets/MenuBarElement.ts", "src/vs/base/tui/ui/menu/menuBarElement.ts"],
    ["src/TUIDom/Widgets/MenuBarItemElement.tsx", "src/vs/base/tui/ui/menu/menuBarItemElement.tsx"],
    ["src/TUIDom/Widgets/PopupMenuElement.ts", "src/vs/base/tui/ui/menu/popupMenuElement.ts"],
    ["src/TUIDom/Widgets/PopupMenuItemElement.tsx", "src/vs/base/tui/ui/menu/popupMenuItemElement.tsx"],
    ["src/TUIDom/Widgets/AboutDialogElement.tsx", "src/vs/base/tui/ui/dialog/aboutDialogElement.tsx"],
    ["src/TUIDom/Widgets/ConfirmDialogElement.tsx", "src/vs/base/tui/ui/dialog/confirmDialogElement.tsx"],
    ["src/TUIDom/Widgets/ConfirmSaveDialogElement.tsx", "src/vs/base/tui/ui/dialog/confirmSaveDialogElement.tsx"],
    ["src/TUIDom/Widgets/OverlayLayer.ts", "src/vs/base/tui/ui/contextview/overlayLayer.ts"],
    ["src/TUIDom/Widgets/BoxElement.ts", "src/vs/base/tui/ui/box/boxElement.ts"],
    ["src/TUIDom/Widgets/BoxContainerElement.ts", "src/vs/base/tui/ui/box/boxContainerElement.ts"],
    ["src/TUIDom/Widgets/HFlexElement.ts", "src/vs/base/tui/ui/layout/hFlexElement.ts"],
    ["src/TUIDom/Widgets/VStackElement.ts", "src/vs/base/tui/ui/layout/vStackElement.ts"],
    ["src/TUIDom/Widgets/PaddingContainerElement.ts", "src/vs/base/tui/ui/layout/paddingContainerElement.ts"],
    ["src/TUIDom/Widgets/TextBlockElement.ts", "src/vs/base/tui/ui/text/textBlockElement.ts"],
    ["src/TUIDom/Widgets/TextLabelElement.ts", "src/vs/base/tui/ui/text/textLabelElement.ts"],
    ["src/TUIDom/Widgets/FocusDemo.stories.ts", "src/vs/base/tui/ui/focusDemo.stories.ts"],

    // ── Виджеты фич — сразу в каноничные vscode-места ────────────────────────
    ["src/TUIDom/Widgets/QuickPickElement.ts", "src/vs/platform/quickinput/tui/quickPickElement.ts"],
    ["src/TUIDom/Widgets/FindWidgetElement.ts", "src/vs/editor/contrib/find/tui/findWidgetElement.ts"],
    ["src/TUIDom/Widgets/CompletionListElement.ts", "src/vs/editor/contrib/suggest/tui/completionListElement.ts"],
    ["src/TUIDom/Widgets/CompletionItemKindIcon.ts", "src/vs/editor/contrib/suggest/tui/completionItemKindIcon.ts"],
    ["src/TUIDom/Widgets/EditorGroupElement.ts", "src/vs/workbench/tui/parts/editor/editorGroupElement.ts"],
    ["src/TUIDom/Widgets/EditorTabItemElement.ts", "src/vs/workbench/tui/parts/editor/editorTabItemElement.ts"],
    ["src/TUIDom/Widgets/EditorTabStripElement.ts", "src/vs/workbench/tui/parts/editor/editorTabStripElement.ts"],
    ["src/TUIDom/Widgets/StatusBarElement.ts", "src/vs/workbench/tui/parts/statusbar/statusBarElement.ts"],
    ["src/TUIDom/Widgets/PanelContainerElement.ts", "src/vs/workbench/tui/parts/panel/panelContainerElement.ts"],
    ["src/TUIDom/Widgets/TitledPanelElement.ts", "src/vs/workbench/tui/parts/panel/titledPanelElement.ts"],
    ["src/TUIDom/Widgets/WorkbenchLayoutElement.ts", "src/vs/workbench/tui/workbenchLayoutElement.ts"],
];

export const stringPrefixes = [
    ["src/Common/Logging/", "src/vs/platform/log/common/"],
    ["src/Common/Assets/", "src/vs/base/common/assets/"],
    ["src/TUIDom/Widgets/", "src/vs/base/tui/ui/"],
    ["src/TUIDom/", "src/vs/base/tui/"],
    ["src/Common/", "src/vs/base/common/"],
];
