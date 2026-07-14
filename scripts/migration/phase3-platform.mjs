/**
 * Фаза 3: platform — сервисы «ниже editor» из Configuration/Controllers/Editor/Theme.
 * Имена файлов vscode-каноничные, где есть 1:1 аналог: configuration.ts,
 * configurationModels.ts, configurationService.ts, state.ts, stateService.ts,
 * markers.ts, markerService.ts, undoRedo.ts, undoRedoService.ts, commands.ts,
 * contextkeys.ts, keybindingsRegistry.ts, quickInputController.ts, colorUtils.ts,
 * colorRegistry.ts, watcher.ts, extensions.ts.
 */
export const moves = [
    // ── Configuration → vs/platform/configuration ────────────────────────────
    ["src/Configuration/IConfigurationService.ts", "src/vs/platform/configuration/common/configuration.ts"],
    ["src/Configuration/IConfigurationServiceDIToken.ts", "src/vs/platform/configuration/common/configurationDIToken.ts"],
    ["src/Configuration/ConfigurationModel.ts", "src/vs/platform/configuration/common/configurationModels.ts"],
    ["src/Configuration/defaults.ts", "src/vs/platform/configuration/common/defaults.ts"],
    ["src/Configuration/NullConfigurationService.ts", "src/vs/platform/configuration/common/nullConfigurationService.ts"],
    ["src/Configuration/ConfigurationService.ts", "src/vs/platform/configuration/node/configurationService.ts"],
    // ── State → vs/platform/state (vscode: node-окружение) ──────────────────
    ["src/Configuration/IStateService.ts", "src/vs/platform/state/node/state.ts"],
    ["src/Configuration/StateService.ts", "src/vs/platform/state/node/stateService.ts"],
    ["src/Configuration/NullStateService.ts", "src/vs/platform/state/node/nullStateService.ts"],
    // ── Keybindings → vs/platform/keybinding ────────────────────────────────
    ["src/Controllers/KeybindingRegistry.ts", "src/vs/platform/keybinding/common/keybindingsRegistry.ts"],
    ["src/Configuration/KeybindingsService.ts", "src/vs/platform/keybinding/node/keybindingsService.ts"],
    ["src/Controllers/ModifierReleaseArmory.ts", "src/vs/platform/keybinding/common/modifierReleaseArmory.ts"],
    // ── Markers → vs/platform/markers ────────────────────────────────────────
    ["src/Editor/Markers/IMarker.ts", "src/vs/platform/markers/common/markers.ts"],
    ["src/Editor/Markers/MarkerService.ts", "src/vs/platform/markers/common/markerService.ts"],
    // ── UndoRedo → vs/platform/undoRedo ──────────────────────────────────────
    ["src/Controllers/Workspace/IUndoRedoElement.ts", "src/vs/platform/undoRedo/common/undoRedo.ts"],
    ["src/Controllers/Workspace/UndoRedoService.ts", "src/vs/platform/undoRedo/common/undoRedoService.ts"],
    // ── Commands → vs/platform/commands ──────────────────────────────────────
    ["src/Controllers/CommandRegistry.ts", "src/vs/platform/commands/common/commands.ts"],
    ["src/Controllers/CommandAction.ts", "src/vs/platform/commands/common/commandAction.ts"],
    // ── Context keys → vs/platform/contextkey ────────────────────────────────
    ["src/Controllers/ContextKeyService.ts", "src/vs/platform/contextkey/common/contextKeyService.ts"],
    ["src/Controllers/ContextKeys.ts", "src/vs/platform/contextkey/common/contextkeys.ts"],
    // ── QuickInput → vs/platform/quickinput ──────────────────────────────────
    ["src/Controllers/QuickInputController.ts", "src/vs/platform/quickinput/tui/quickInputController.ts"],
    // ── Theme color registry → vs/platform/theme ─────────────────────────────
    ["src/Theme/ColorUtils.ts", "src/vs/platform/theme/common/colorUtils.ts"],
    ["src/Theme/IWorkbenchColors.ts", "src/vs/platform/theme/common/colors.ts"],
    ["src/Theme/defaultColors.ts", "src/vs/platform/theme/common/colorRegistry.ts"],
    // ── Files → vs/platform/files ────────────────────────────────────────────
    ["src/Controllers/IFileWatcher.ts", "src/vs/platform/files/common/watcher.ts"],
    ["src/Controllers/ChokidarFileWatcher.ts", "src/vs/platform/files/node/chokidarFileWatcher.ts"],
    ["src/Controllers/Workspace/TrashService.ts", "src/vs/platform/files/node/trashService.ts"],
    ["src/Controllers/Actions/fileClipboardFs.ts", "src/vs/platform/files/node/fileClipboardFs.ts"],
    // ── Extensions (скан/установка) → vs/platform/extensions* ────────────────
    ["src/Extensions/IExtension.ts", "src/vs/platform/extensions/common/extensions.ts"],
    ["src/Extensions/IExtensionManifest.ts", "src/vs/platform/extensions/common/extensionManifest.ts"],
    ["src/Extensions/ExtensionScanner.ts", "src/vs/platform/extensions/common/extensionScanner.ts"],
    ["src/Extensions/ExtensionInstaller.ts", "src/vs/platform/extensionManagement/node/extensionInstaller.ts"],
];

export const stringPrefixes = [
    ["src/Configuration/", "src/vs/platform/configuration/"],
    ["src/Editor/Markers/", "src/vs/platform/markers/common/"],
];
