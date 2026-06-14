import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      skipFull: true,
      reportOnFailure: true,
      provider: "v8",
      // Храповик: CI падает при регрессе покрытия, планка сама ползёт вверх,
      // когда покрытие растёт (autoUpdate перезаписывает числа ниже).
      // Цель — покрываем весь новый код; исключения см. ниже + docs/TESTING.md.
      thresholds: {
        autoUpdate: true,
        statements: 97.71,
        branches: 91.57,
        functions: 98.44,
        lines: 99.03,
      },
      reporter: ["text", "lcov", "json-summary", "text-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.stories.ts",
        "src/demos/**",
        "src/main.ts",
        "src/StoryRunner/**",
        "src/Extensions/Host/__fixtures__/**",

        // --- Чистые типы: нечего исполнять ---
        "src/**/*.d.ts", // vscode.d.ts
        "src/TUIDom/Styles/index.ts", // barrel re-export
        "src/Theme/index.ts", // barrel re-export
        "src/Backend/ITerminalBackend.ts",
        "src/Common/IClipboard.ts",
        "src/Common/Assets/IAssetAccess.ts",
        "src/Common/Logging/ILogService.ts",
        "src/Common/Logging/ILogger.ts",
        "src/Configuration/IConfigurationService.ts",
        "src/Controllers/IController.ts",
        "src/Editor/IDocumentContentChange.ts",
        "src/Editor/ITextDocument.ts",
        "src/Editor/IUndoElement.ts",
        "src/Editor/Tokenization/ITokenizationSupport.ts",
        "src/Extensions/IExtension.ts",
        "src/Extensions/IExtensionManifest.ts",
        "src/Extensions/IGrammarContribution.ts",
        "src/Extensions/ILanguageConfiguration.ts",
        "src/Extensions/ILanguageContribution.ts",
        "src/Extensions/Host/IEditorOptionsService.ts",
        "src/Extensions/Host/IExtensionEntry.ts",
        "src/Extensions/Host/IMessageChannel.ts",
        "src/Input/RawTerminalToken.ts",
        "src/TUIDom/Widgets/ITreeDataProvider.ts",
        "src/TUIDom/Widgets/IScrollable.ts", // только интерфейсы (type guards удалены как мёртвые)
        "src/Theme/IEditorTokenTheme.ts",
        "src/Theme/IThemeFile.ts",
        "src/Theme/IVSCodeThemeFile.ts",
        "src/Theme/IWorkbenchColors.ts",

        // --- Непокрываемо юнит-тестами (есть e2e) ---
        "src/Backend/NodeTerminalBackend.ts", // реальный tty/stdin/stdout
        "src/Common/IsSea.ts", // node:sea, только в SEA-бинаре
        "src/Common/Assets/createDefaultAssetAccess.ts", // SEA vs dev + fs-резолв
        "src/Extensions/Host/ExtensionHostSubprocess.ts", // точка входа subprocess + IPC
        "src/Extensions/Host/VscodeNamespace.ts", // RPC-проводка в subprocess
        "src/Controllers/Modules/**", // DI-проводка (integration/e2e)
        "src/Configuration/NullConfigurationService.ts", // null-object заглушка
      ],
    },
  },
});