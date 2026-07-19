import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "extensions/**/*.test.ts"],
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
      include: ["src/**/*.ts", "extensions/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",

        "src/**/*.bench.ts", // перф-бенчмарки, гоняются отдельным test:perf
        "src/TestUtils/perfFixtures.ts", // фикстуры только для бенчей
        "src/vs/workbench/api/common/testStubRpc.ts", // тестовый стаб RpcEndpoint для unit-тестов namespace'ов
        "src/**/*.stories.ts",
        "src/demos/**",
        "src/vs/vexx/main.ts",
        "src/StoryRunner/**",
        "src/vs/workbench/services/extensions/node/__fixtures__/**",

        // --- Чистые типы: нечего исполнять ---
        "src/**/*.d.ts", // vscode.d.ts
        "src/vs/base/browser/styles/index.ts", // barrel re-export
        "src/vs/workbench/services/themes/common/index.ts", // barrel re-export
        "src/vs/tui/backend/iTerminalBackend.ts",
        "src/vs/platform/clipboard/common/iClipboard.ts",
        "src/vs/base/common/assets/iAssetAccess.ts",
        "src/vs/platform/log/common/iLogService.ts",
        "src/vs/platform/log/common/iLogger.ts",
        "src/vs/platform/configuration/common/iConfigurationService.ts",
        "src/vs/editor/common/model/iGutterChangeDecoration.ts",
        "src/vs/editor/common/model/iDocumentContentChange.ts",
        "src/vs/editor/common/model/iTextDocument.ts",
        "src/vs/editor/common/model/iUndoElement.ts",
        "src/vs/editor/common/languages/iTokenizationSupport.ts",
        "src/vs/platform/extensions/common/iExtension.ts",
        "src/vs/platform/extensions/common/iExtensionManifest.ts",
        "src/vs/platform/extensions/common/iGrammarContribution.ts",
        "src/vs/platform/extensions/common/iLanguageConfiguration.ts",
        "src/vs/platform/extensions/common/iLanguageContribution.ts",
        "src/vs/workbench/api/common/iEditorOptionsService.ts",
        "src/vs/workbench/api/common/iEditorDecorationsService.ts",
        "src/vs/workbench/api/common/iFileDecorationsService.ts",
        "src/vs/workbench/api/common/iThemeColorResolver.ts",
        "src/vs/workbench/services/extensions/node/iExtensionEntry.ts",
        "src/vs/workbench/api/common/iMessageChannel.ts",
        "src/vs/tui/input/rawTerminalToken.ts",
        "src/vs/base/browser/ui/tree/iTreeDataProvider.ts",
        "src/vs/base/browser/ui/scrollbar/iScrollable.ts", // только интерфейсы (type guards удалены как мёртвые)
        "src/vs/platform/theme/common/iEditorTokenTheme.ts",
        "src/vs/platform/theme/common/iThemeFile.ts",
        "src/vs/platform/theme/common/ivsCodeThemeFile.ts",
        "src/Theme/IWorkbenchColors.ts",

        // --- Непокрываемо юнит-тестами (есть e2e) ---
        "src/vs/tui/backend/nodeTerminalBackend.ts", // реальный tty/stdin/stdout
        "src/vs/platform/files/node/chokidarFileWatcher.ts", // реальный fs-watcher (chokidar), e2e
        "src/vs/base/node/isSea.ts", // node:sea, только в SEA-бинаре
        "src/vs/base/node/assets/createDefaultAssetAccess.ts", // SEA vs dev + fs-резолв
        "src/vs/base/node/assets/packagedRuntime.ts", // node:sea + резолв import.meta.url; I/O-часть — в BundleFile.ts (юниты)
        "src/vs/workbench/contrib/terminal/node/loadNodePty.ts", // SEA-путь загрузки нативного node-pty: node:sea + распаковка .node в tmp + dlopen; e2e — terminal.scenario.ts на реальном SEA-бинаре
        "src/vs/workbench/services/extensions/node/extensionHostSubprocess.ts", // точка входа subprocess + IPC
        "extensions/git/main.ts", // extension entry (subprocess IO/glue); логика — в git/lib/* (юниты), e2e — интеграция
        "extensions/vexx-settings/main.ts", // extension entry (грузится в subprocess); поведение — в ExtensionHost.SettingsCompletion.test.ts + e2e
        "src/**/*.generated.ts", // сгенерированные data-файлы (напр. settings-schema.generated.ts), исполняются в subprocess
        "src/vs/workbench/api/common/vscodeNamespace.ts", // RPC-проводка в subprocess
        "src/Workbench/Modules/**", // DI-проводка (integration/e2e)
        "src/vs/platform/configuration/common/nullConfigurationService.ts", // null-object заглушка
        "src/vs/platform/state/common/nullStateService.ts", // null-object заглушка
        "src/Inspector/InspectorDriver.ts", // только интерфейс write/capture-порта
        "src/Inspector/InspectorServer.ts", // рукописный ws-транспорт (смоук-тест)
        "src/Inspector/ws/**", // рукописный RFC6455 фрейминг
        "src/Inspector/attachInspector.ts", // поднимает реальный сервер (смоук-тест)
      ],
    },
  },
});