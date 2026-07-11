# Problems / диагностики

Панель Problems и подсветка диагностик в стиле VS Code. Ключевая идея: **диагностики
отвязаны от их источников**. Центральный провайдер-агностичный реестр — маркер-сервис
(аналог `IMarkerService` из VS Code, `vs/platform/markers`). LSP, problem matchers и
расширения (`languages.createDiagnosticCollection`) — это всего лишь *поставщики*,
которые пишут в реестр; панель, squiggly и счётчики — *потребители*, которые из него
читают. Поэтому «что-то рабочее» можно собрать без LSP/matchers: нужен один поставщик.

## Модель маркера (как в VS Code)

`IMarker { owner, resource, severity, range, message, code?, source? }`:
- `owner` — неймспейс поставщика (`"settings"`, позже `"typescript"`, `"eslint"`);
- `resource` — путь/URI файла;
- `severity` — `Error | Warning | Info | Hint`;
- `range` — `IRange` в документе.

API реестра: `changeOne(owner, resource, markers[])`, `read({ resource?, owner?, severities? })`,
`onMarkerChanged(resources[])`.

## Слои

- **Реестр** — `src/Editor/Markers/` (чистый, без DI — зеркало `Editor/Tokenization`,
  `TokenizationRegistry`). DI-токен `IMarkerServiceDIToken` + модуль — в Controllers.
- **Поставщик** — Controllers. Пишет через `changeOne`.
- **Потребитель (editor squiggly)** — `EditorController` подписан на `onMarkerChanged`
  для пути открытого файла, фильтрует маркеры документа, пушит диапазоны+severity в
  `EditorElement.setMarkerDecorations(...)` (зеркало `setSearchDecorations`). Editor не
  знает про DI/Controllers/resource — рисует только диапазоны.
- **Потребитель (панель)** — новый `ProblemsController`, подписан на весь реестр.

Точка пересчёта уже задокументирована: `ITextDocument.onDidChangeContent` (ARCHITECTURE.md
→ Editor: «marker tracking» назван consumer'ом этого события).

## Этапы

### [x] 1. Seam: IMarkerService + squiggly + валидатор settings.json (MVP)
Готово. Прогоняет весь пайплайн (поставщик → реестр → декорация в редакторе) на
реальной фиче с нулевой зависимостью от extension host / LSP. Реализовано:
`Editor/Markers/` (`MarkerService`, `IMarker`, `IMarkerDecoration`), squiggle-пасс в
`EditorElement` (undercurl + severity-цвета), валидатор `Controllers/Diagnostics/`,
`DiagnosticsController`. Дефолт-цвета `editorError/Warning/Info/Hint.foreground` в теме.

- **Реестр** `src/Editor/Markers/`: `IMarker`/`MarkerSeverity`/`IMarkerService` +
  `MarkerService` (Map `owner → Map<resource, IMarker[]>`, `onMarkerChanged`). DI-токен +
  модуль в `Controllers/Modules/`.
- **Squiggly**: `EditorElement.setMarkerDecorations(decorations)` + пасс подчёркивания.
  Глиф — `StyleFlags.Undercurl` (уже рендерится как SGR `4:3`, `TerminalRenderer.ts`);
  на legacy-терминалах деградирует до обычного underline. Цвет — из темы
  (`editorError.foreground` / `editorWarning.foreground`). Wiring — в `EditorController`
  (подписка на `markerService.onMarkerChanged` по пути документа, как hot-swap токенайзера).
- **Валидатор settings.json** (первый поставщик, Controllers): следит за активным
  редактором; если файл — **активный settings.json Vexx** (матч по точному пути через
  `SettingsResourceDIToken` = `IUserDataPaths.settingsFile`, а не по basename — чужой
  `settings.json` от VS Code/воркспейса не трогаем), парсит через `jsonc-parser` (уже в
  deps), сверяет top-level ключи с `getDefaultConfiguration()` (`Configuration/defaults.ts`),
  кладёт Warning-маркер «Unknown Configuration Setting» с диапазоном из node offsets.
  Пересчёт — по `onDidChangeContent`. TODO: подмешать дефолты `contributes.configuration`
  расширений (этап 3), иначе реальные VS Code-настройки, ещё не реализованные в Vexx,
  помечаются как неизвестные.

### [x] 2. Problems-панель
**2a (готово) — каркас нижней Panel.** Терминология VS Code: нижний контейнер — **Panel**
(`ViewContainerLocation.Panel`), на нём живут **Views** (Problems = `workbench.panel.markers.view`).
Сделано:
- `WorkbenchLayoutElement` — оживлена нижняя зона: Panel выровнена по ширине редактора
  (align=center, дефолт VS Code), sidebar на всю высоту слева; горизонтальный `SashElement`
  (обобщён на `orientation`) ресайзит высоту. Panel скрыта по умолчанию.
- `PanelContainerElement` — Panel part: таб-шапка Views + активный View; вкладка Problems
  с empty-state «No problems have been detected in the workspace.» (placeholder, пока без дерева).
  Цвета `panel.*`/`panelTitle.*` (раскрыты в теме + дефолты).
- `PanelController` — владеет контейнером; вписан в `AppController`.
- Команды: `workbench.action.togglePanel` (Ctrl+J), `workbench.actions.view.problems` (Ctrl+Shift+M);
  контекст-ключ `panelVisible`; пункты меню View «Problems» / «Toggle Panel».

**2b (готово) — содержимое Problems.** `ProblemsController` + `ProblemsTreeDataProvider`
(`Controllers/Diagnostics/`): дерево «файл → маркеры» (`TreeViewElement<ProblemNode>`; codicon-
иконка severity + цвет, сообщение, `[Ln, Col]`) из `MarkerService.onDidChangeMarkers` становится
`content` вкладки Problems (`setViewContent`; 0 маркеров → placeholder), файлы авто-разворачиваются.
Enter/клик по маркеру → reveal (`openFile` + `goToPosition/revealRange`). Ctrl+Shift+M открывает
и фокусирует дерево (`focus()` идёт к живому корню — контент панели крепится лениво). Добавлен
публичный `TreeViewElement.expand` (идемпотентный).

**Отложено (2c):** счётчик ошибок/варнингов в `StatusBarController` (текущий `StatusBarItem` без
клика/цвета per-item — нужен минорный апгрейд виджета); отдельный контекст-ключ `problemsFocus`
(сейчас дерево Problems попадает под `listFocus`, см. Caveat в плане).

### [ ] 3. Дополнительные поставщики
- JSON Schema-валидация целиком (типы/enum'ы, не только неизвестные ключи).
- Расширения: `vscode.languages.createDiagnosticCollection` → RPC → `changeOne`.
- LSP `publishDiagnostics`, problem matchers тасков — по мере появления слоёв.

### [ ] 4. Прочие потребители
Метки в gutter/overview ruler, навигация по маркерам (F8/Shift+F8), hover с сообщением.
