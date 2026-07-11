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
- **`ConfigurationService`** — async `loadConfiguration(paths)`. `onDidChangeConfiguration` пока no-op (watcher не реализован — правки подхватываются рестартом). **`updateUserValue(key, value)`** — запись в settings.json активного профиля через `jsonc-parser` (сохраняет комментарии/форматирование) + синхронный апдейт in-memory слоя; первый потребитель — theme picker. Заглушка `NULL_CONFIGURATION_SERVICE` метод не реализует (вызов через optional chaining).

Применение к редактору: `EditorGroupController` при создании каждого `EditorController` дёргает `setIndentOptions({ tabSize, insertSpaces })` и `setCursorSurroundingLines(...)` из ключей `editor.*`. `setIndentOptions` принудительно выключает auto-detect indent.

Фикстура `test-fixtures/vexx-home/` повторяет реальную раскладку (`--user-data-dir ./test-fixtures/vexx-home`); профиль `compact` демонстрирует переопределение `editor.tabSize`.
