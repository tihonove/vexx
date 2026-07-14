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
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      reporter: ["text", "lcov", "json", "json-summary", "text-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",

        "src/**/*.bench.ts", // перф-бенчмарки, гоняются отдельным test:perf
        "src/TestUtils/perfFixtures.ts", // фикстуры только для бенчей
        "src/Extensions/Host/Vscode/testStubRpc.ts", // тестовый стаб RpcEndpoint для unit-тестов namespace'ов
        "src/**/*.stories.ts",
        "src/demos/**",
        "src/main.ts",
        "src/StoryRunner/**",
        "src/Extensions/Host/__fixtures__/**",

        // --- Чистые типы: нечего исполнять ---
        "src/**/*.d.ts", // vscode.d.ts
        "src/vs/base/tui/styles/index.ts", // barrel re-export
        "src/Theme/index.ts", // barrel re-export
        "src/vs/tui/backend/terminalBackend.ts",
        "src/vs/platform/clipboard/common/clipboardService.ts",
        "src/vs/base/common/assets/assets.ts",
        "src/vs/platform/log/common/log.ts",
        "src/vs/platform/log/common/logger.ts",
        "src/vs/platform/configuration/common/configuration.ts",
        "src/Controllers/IController.ts",
        "src/vs/editor/common/model/gutterChangeDecoration.ts",
        "src/vs/editor/common/model/documentContentChange.ts",
        "src/vs/editor/common/model.ts",
        "src/vs/editor/common/model/undoElement.ts",
        "src/vs/editor/common/languages/tokenizationSupport.ts",
        "src/vs/platform/extensions/common/extensions.ts",
        "src/vs/platform/extensions/common/extensionManifest.ts",
        "src/Extensions/IGrammarContribution.ts",
        "src/Extensions/ILanguageConfiguration.ts",
        "src/Extensions/ILanguageContribution.ts",
        "src/Extensions/Host/IEditorOptionsService.ts",
        "src/Extensions/Host/IEditorDecorationsService.ts",
        "src/Extensions/Host/IFileDecorationsService.ts",
        "src/Extensions/Host/IThemeColorResolver.ts",
        "src/Extensions/Host/IExtensionEntry.ts",
        "src/Extensions/Host/IMessageChannel.ts",
        "src/vs/tui/input/rawTerminalToken.ts",
        "src/vs/base/tui/ui/tree/tree.ts",
        "src/vs/base/common/scrollable.ts", // только интерфейсы (type guards удалены как мёртвые)
        "src/Theme/IEditorTokenTheme.ts",
        "src/Theme/IThemeFile.ts",
        "src/Theme/IVSCodeThemeFile.ts",
        "src/vs/platform/theme/common/colors.ts",

        // --- Непокрываемо юнит-тестами (есть e2e) ---
        "src/vs/tui/backend/nodeTerminalBackend.ts", // реальный tty/stdin/stdout
        "src/vs/platform/files/node/chokidarFileWatcher.ts", // реальный fs-watcher (chokidar), e2e
        "src/vs/base/node/isSea.ts", // node:sea, только в SEA-бинаре
        "src/vs/base/node/assets/createDefaultAssetAccess.ts", // SEA vs dev + fs-резолв
        "src/Extensions/Host/ExtensionHostSubprocess.ts", // точка входа subprocess + IPC
        "src/Extensions/builtin/git/main.ts", // extension entry (subprocess IO/glue); логика — в git/lib/* (юниты), e2e — интеграция
        "src/Extensions/Host/VscodeNamespace.ts", // RPC-проводка в subprocess
        "src/Controllers/Modules/**", // DI-проводка (integration/e2e)
        "src/vs/platform/configuration/common/nullConfigurationService.ts", // null-object заглушка
        "src/vs/platform/state/node/nullStateService.ts", // null-object заглушка
        "src/Inspector/InspectorDriver.ts", // только интерфейс write/capture-порта
        "src/Inspector/InspectorServer.ts", // рукописный ws-транспорт (смоук-тест)
        "src/Inspector/ws/**", // рукописный RFC6455 фрейминг
        "src/Inspector/attachInspector.ts", // поднимает реальный сервер (смоук-тест)
      ],
    },
  },
});