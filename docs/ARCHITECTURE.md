# Vexx — Архитектура

Этот файл — **концептуальная карта**: обзор слоёв, короткие описания каталогов
`src/` со ссылками на детальные документы и правила зависимостей. Детальный
per-layer справочник живёт в [arch/](arch/) — по одному файлу на слой.

## Обзор слоёв

Проект организован в виде стека слоёв. Каждый слой зависит только от нижележащих.

1. **App** (main.ts) — точка входа, bootstrap (CLI → user data paths → configuration → asset access → extensions → DI)
2. **Extensions** — VS Code-совместимые расширения: манифесты, грамматики, extension host (subprocess + RPC)
3. **Controllers** — контроллеры с lifecycle (constructor → mount → activate → dispose), оркестрация UI и бизнес-логики
4. **Configuration** — настройки пользователя (JSONC, профили, слои default/user/profile)
5. **Theme** — темизация (VS Code-совместимые theme files); на одном уровне с Controllers, подключается к Editor через интерфейсы
6. **Editor** — модель текстового редактора + мост к TUIDom
7. **TUIDom** — TUI-фреймворк (аналог браузерного DOM): дерево элементов, события, виджеты
8. **Input**, **Rendering**, **Backend** — платформенный слой: парсинг ввода, отрисовка, терминальный I/O
9. **Common** — общие примитивы и утилиты

Точная схема зависимостей (включая исключения) — в разделе [Правила зависимостей](#правила-зависимостей).

## Каталоги src/

Ниже — по одному абзацу на каталог. Детали каждого слоя — по ссылке в конце абзаца.

### Common/
Базовые типы и утилиты, не зависящие ни от чего: геометрия (`Point`, `Size`, `Rect`, `BoxConstraints`), `IDisposable`/`Disposable`, DI-примитивы (`Token`, `Container`), Unicode-утилиты (`UnicodeWidth`, `DisplayLine`). Подкаталоги `Common/Assets/` (унифицированный доступ к статическим ассетам через `IAssetAccess`) и `Common/Logging/` (VS Code-подобное логирование: `ILogService`/`ILogger`/sinks). Детали → [arch/Common.md](arch/Common.md).

### Input/
Пайплайн парсинга терминального ввода: сырые байты stdin → токены → `KeyPressEvent` (browser-like keydown/keypress/keyup), отслеживание мыши, обратная сериализация для тестов. Детали → [arch/Input.md](arch/Input.md).

### Rendering/
Вывод на экран: двойная буферизация, diff, минимальные ANSI-последовательности; модель ячейки, 2D-матрица, API рисования. Плюс `GridSnapshot` (plain-data кадр) и `gridToSvg` (кадр → SVG для скриншотов). Детали → [arch/Rendering.md](arch/Rendering.md).

### Backend/
Абстракция терминального I/O (интерфейс + три реализации: `NodeTerminalBackend`, `MockTerminalBackend`, `HeadlessCaptureBackend` для `--headless`). Детали → [arch/Backend.md](arch/Backend.md).

### TUIDom/
TUI-фреймворк — дерево элементов с layout, событиями, фокусом (аналог браузерного DOM). `RenderContext`, система событий (capture/bubble, default actions), стилей (наследование fg/bg), виджеты и `OverlayLayer` (session API с обязательным `pointerPolicy`). Layout описан в [LAYOUT.md](LAYOUT.md). Детали → [arch/TUIDom.md](arch/TUIDom.md).

### Editor/
Модель текстового редактора и виджет-мост к TUIDom: хранение текста, view-state (scroll/selections/folding/cursor), undo/redo, слежение за файлом на диске, folding, подсистема токенизации (`Editor/Tokenization/`), реестр диагностик (`Editor/Markers/`) и view-проекции декораций (`Editor/Decorations/`). Editor НЕ зависит от Theme/Extensions напрямую — только через интерфейсы `ITokenStyleResolver`/`ILanguageService`. Детали → [arch/Editor.md](arch/Editor.md).

### Extensions/
Загрузка VS Code-совместимых расширений (`contributes.languages`/`grammars`, builtin + user), `LanguageRegistry`, установка `.vsix`. Подмодуль `Extensions/Host/` — extension host: реальный subprocess + RPC поверх Node IPC, субпроцессная поверхность `vscode`. Детали → [arch/Extensions.md](arch/Extensions.md).

### Configuration/
Сервис пользовательских настроек (аналог `IConfigurationService`): JSONC, профили, слои default/user/profile, раскладка user data, CLI-парсер. Детали → [arch/Configuration.md](arch/Configuration.md). Рядом — `StateService` (аналог `IStorageService`/`Memento`): **машинное** состояние UI/сессии (открытые файлы, ширина/видимость панелей) в plain-JSON со scope `global`/`workspace` — отдельная система от человекочитаемых настроек. Дескрипторы состояния объявляются на уровне Controllers (`StateKeys.ts`), не в элементах TUIDom. Детали → [arch/State.md](arch/State.md).

### Theme/
Система темизации, совместимая с VS Code theme files: `WorkbenchTheme`, реестр дефолтов `defaultColors`, `ThemeService`/`ThemeRegistry`, встроенные темы. Все цвета UI берутся только из активной темы. Детали → [arch/Theme.md](arch/Theme.md).

### Controllers/
Контроллеры с чётким lifecycle (constructor → mount → activate → dispose), система команд (VS Code-style ID, when-контексты), `IFileWatcherDIToken`/`ChokidarFileWatcher` (интерфейс `IFileWatcher` — в Common), диагностики (`DiagnosticsController` + нижняя Panel/Problems), подкаталоги `Workspace/` (единая система отмены), `TerminalEnvironment/` (детект tier/capabilities/modes) и `Modules/` (модули и профили DI). Детали → [arch/Controllers.md](arch/Controllers.md).

### demos/ · StoryRunner/ · TestUtils/
Инструменты разработки: демо-приложения хостинга (`demos/`), CLI-раннер stories (`StoryRunner/`), утилиты для тестов (`TestUtils/`, включая `ExtensionTestHarness`). Детали → [arch/DevTooling.md](arch/DevTooling.md).

### Inspector/
Инспектор TUIDom («браузерный дебаг-порт»): сериализация дерева и протокол поверх рукописного WebSocket; write/capture-порт `InspectorDriver` для `--headless`. Детали → [arch/Inspector.md](arch/Inspector.md).

## Правила зависимостей

```
App → Extensions → Controllers → Editor → TUIDom → { Input, Rendering, Backend } → Common
          ↑           ↑              ↑
        Theme ────────┘──────────────┘ (через ITokenStyleResolver/ILanguageService;
                                         Editor НЕ импортирует Theme/Extensions)
        Theme → { Rendering, Common }
```

- **Common** не импортирует ничего из проекта
- **Input**, **Rendering** зависят только от Common
- **Backend** зависит от Input, Rendering, Common
- **TUIDom** зависит от Rendering, Common (через TerminalScreen)
- **TUIDom/Events** используют тип TUIElement — это внутренняя зависимость TUIDom
- **Editor** зависит от TUIDom, Rendering (ColorUtils), Common. **Не зависит** от Theme и Extensions — связь через интерфейсы (`ITokenStyleResolver`, `ILanguageService`)
- **Theme/Tokenization** реализует `ITokenStyleResolver` из `Editor/Tokenization`
- **Extensions** реализует `ILanguageService` из `Editor/Tokenization`, использует `TextMateGrammarLoader`/`TokenizationRegistry` для регистрации грамматик. Подмодуль **`Extensions/Host`** дополнительно зависит от `Controllers` (адаптеры над `EditorGroupController`/`FileTreeController`) и `Theme` (адаптер над `ThemeService` — резолв `ThemeColor` для декораций) — единственное место, где Extensions поднимается выше Controllers. Ядро про источник декораций (git/SCM) не знает: адаптеры отдают уже резолвнутые цвета.
- **Controllers** зависит от Editor, TUIDom, Theme, Configuration, Common и от интерфейса `Backend` (`ITerminalBackend` через `TerminalBackendDIToken` — `TerminalEnvironmentService` пробит терминал; Backend ниже по стеку)
- **App** (main.ts) зависит от всех слоёв и оркеструет загрузку builtin-расширений до bootstrap DI
- **Inspector** зависит от TUIDom (чтение дерева/типов) и Common; плюс тип-only зависимость на `GridSnapshot` из Rendering (тип результата `captureFrame`). Транспорт — встроенный `node:http` (рукописный WebSocket, без сторонних зависимостей). Не зависит от Controllers/Editor/Backend (write/capture-порт `InspectorDriver` — интерфейс; адаптер над бэкендом даёт App-слой)

### DI-контейнер: границы использования

Примитивы DI (`Token`, `Container`, `token()`) реализованы в `Common/DiContainer.ts`, но **объявлять конкретные DI-токены и импортировать `Container`** можно **только на уровнях Controllers и App**. Слои ниже (Editor, TUIDom, Input, Rendering, Backend) не должны зависеть от DI-контейнера.

Все DI-токены именуются по конвенции `*DIToken` (например `EditorControllerDIToken`, `TuiApplicationDIToken`). Подробности — [DI.md](DI.md).
