# Configuration/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Сервис пользовательских настроек (урезанный аналог `IConfigurationService` из VS Code). Источники слоями: хардкод-дефолты приложения → `User/settings.json` (default-профиль) → `profiles/<name>/settings.json`. Формат — JSONC; битый файл логируется и заменяется пустой моделью — bootstrap не падает.

Раскладка user data (VS Code-совместимая):
```
<root>/                          # default ~/.vexx ; CLI --user-data-dir <path>
  extensions/                    # внешние расширения
  user-data/User/
    settings.json                # default-профиль
    keybindings.json
    profiles/<name>/{settings,keybindings}.json
```

- **`resolveUserDataPaths(...)`** (`Common/UserDataPaths.ts`) — чистая функция, возвращает все пути; имя профиля валидируется `/^[A-Za-z0-9._-]+$/`.
- **`parseCliArgs(argv)`** (`Common/CliArgs.ts`) — флаги `--user-data-dir`, `--profile`, `--inspect-tui`, `--headless[=CxR]` (требует `--inspect-tui`), `-h`/`-v`, разделитель `--`, неизвестные → `CliArgsError`.
- **`ConfigurationModel`** — иммутабельная: нормализует dotted-keys (`"editor.tabSize"` → вложенный объект), deep-merge слоёв, `get`/`getValue`.
- **`ConfigurationService`** — async `loadConfiguration(paths, logger?, fileWatcher?)`. **Live-reload:** если передан `IFileWatcher` (из Common), сервис следит за `User/settings.json` (и файлом именованного профиля), на изменение перечитывает слой через `reload()`, пересобирает merged и эмитит `onDidChangeConfiguration` с диффом затронутых ключей (`diffConfigurationKeys` через `ConfigurationModel.collectKeys()`). `affectsConfiguration(q)` матчит точное совпадение, предка и потомка ключа. **`updateUserValue(key, value)`** — запись в settings.json активного профиля через `jsonc-parser` (сохраняет комментарии/форматирование) + синхронный апдейт in-memory слоя и то же событие изменения; первый потребитель — theme picker. Пустой дифф события не порождает (повторный reload после собственной записи молчит). Заглушка `NULL_CONFIGURATION_SERVICE` метод не реализует (вызов через optional chaining), `onDidChangeConfiguration` у неё остаётся no-op. Потребители live-apply: `EditorGroupController` (перепримeняет `editor.*` к открытым редакторам), `AppController` (перекрашивает по `workbench.colorTheme`); `explorer.*` читаются on-demand.

Пути обоих файлов прокинуты в DI (слой Controllers): `settingsFile` → `SettingsResourceDIToken` (валидатор settings.json), `keybindingsFile` → `KeybindingsResourceDIToken`. Оба использует `AppController` для команд `workbench.action.openSettings` (Ctrl+,) и `workbench.action.openGlobalKeybindings` (Ctrl+K Ctrl+S), которые просто открывают соответствующий JSON-файл в редакторе (UI-редактора настроек нет); на свежем профиле файл создаётся заготовкой. Бинд обоих токенов — в `markersModule`, значения — из `main.ts`.

Применение к редактору: `EditorGroupController` при создании каждого `EditorController` дёргает `setIndentOptions({ tabSize, insertSpaces })` и `setCursorSurroundingLines(...)` из ключей `editor.*`. `setIndentOptions` принудительно выключает auto-detect indent.

Фикстура `test-fixtures/vexx-home/` повторяет реальную раскладку (`--user-data-dir ./test-fixtures/vexx-home`); профиль `compact` демонстрирует переопределение `editor.tabSize`.

## StateService — машинное состояние (отдельно от настроек)
Рядом с `ConfigurationService` живёт **`StateService`** (`Configuration/StateService.ts`) — аналог `IStorageService`/`Memento`: персистентное **машинное** состояние UI/сессии (открытые файлы + активная вкладка, ширина/видимость сайдбара, видимость/высота нижней панели). Это **не** `settings.json`: формат — plain JSON (никто не редактирует руками), scope `global` (`<profileDir>/globalState.json`) / `workspace` (`<profileDir>/workspaceStorage/<sha256(folder)>/state.json`). Движок: write-through + debounced-запись + `flushSync` на `process.on("exit")`, tolerant-load, сохранение unknown-ключей. DI-токен и модуль — в Controllers (`Modules/StateModule.ts`); дескрипторы — `Controllers/StateKeys.ts`; координатор — `WorkbenchStateController`. Полное описание → [State.md](State.md).
