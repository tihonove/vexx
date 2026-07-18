# Workbench/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).
История миграции Controllers → Workbench (задача завершена, слой Controllers растворён) —
[../TODO/WorkbenchRefactoring.md](../TODO/WorkbenchRefactoring.md).

Прикладной слой приложения. Здесь живут **сервисы** (логика приложения) и **компоненты**
(UI-сборка поверх контролов TUIDom) — как в VS Code (services + Part/ViewPane), а также
встроенные экшены (`Actions/`) и DI-модули с профилями (`Modules/`).

## Модель Service ↔ Component

- **Service** — где живёт логика приложения: состояние, I/O, индексы, подписки на нижние
  слои. Сервис ничего не знает про конкретные компоненты.
- **Component** — принимает сервисы в конструктор и общается с ними (вызовы, подписки);
  владеет корневым контролом и раздаёт данные/стили вниз.

**Правило-инвариант:** есть `view` → Component; нет `view` → Service.

Async-инициализация живёт в сервисах: интерфейс `IActivatable` (`src/Workbench/IActivatable.ts`):

```ts
export interface IActivatable {
    activate(): Promise<void>;
}
```

У компонентов отдельных `mount()`/`activate()` **нет** — вся сборка происходит в конструкторе.
Единственное исключение — корневой `WorkbenchComponent`: у корня есть реальная
bootstrap-последовательность приложения (mount → activate → open/restore файлов),
которую ведёт `main.ts`.

## Контракты Component / ThemedComponent (`src/Workbench/Component.ts`)

```ts
export abstract class Component extends Disposable {
    public abstract readonly view: TUIElement;
}

export abstract class ThemedComponent extends Component {
    protected constructor(protected readonly themeService: ThemeService);
    protected get theme(): WorkbenchTheme;      // активная тема из themeService
    protected initStyles(): void;               // подписка на onThemeChange → updateStyles()
    protected abstract updateStyles(): void;    // пуш стилей во владеемые контролы
}
```

- Компонент **владеет** корневым контролом (`view`), но в жизненный цикл контролов не
  встраивается — только размещает их (как DOM-узлы) и не наследует `TUIElement`.
- Наследник `ThemedComponent` вызывает `initStyles()` **последней строкой конструктора**
  (из базового конструктора нельзя — поля наследника ещё не инициализированы).
  `ThemeService.onThemeChange` файрит листенер немедленно с текущей темой, поэтому
  начальная покраска происходит ровно один раз — внутри `initStyles()`; явный вызов
  `updateStyles()` не нужен. Подписка снимается при `dispose()`.

### Идентичность в дереве

Компонент вешает `view.id` на свой корневой контрол — это DOM-идентичность для тестов и
Inspector'а (поиск по дереву, скриншот-демо). Контролы своих id не придумывают.

## Стандарт стилей контролов + мост defaultStyles

Контролы TUIDom про темы не знают. У контрола — плоский интерфейс packed-цветов и
дефолты рядом с ним:

```ts
export interface IButtonStyles { readonly fg: number; readonly bg: number; /* … */ }
export const unthemedButtonStyles: IButtonStyles = { /* историческая палитра */ };
class ButtonElement {
    constructor(label: string, options?: { styles?: IButtonStyles });
    setStyles(styles: IButtonStyles): void; // единственный канал обновления, вызывает markDirty()
}
```

Мост тема → стили — `src/Workbench/Styles/defaultStyles.ts`: по функции
`getXxxStyles(theme)` на контрол; **единственная точка знания «ключ темы → поле стиля»**.
Раздача — **пуш-моделью**: компонент подписан на смену темы (`ThemedComponent.updateStyles()`)
и заново вызывает `control.setStyles(getXxxStyles(this.theme))`. Никаких `applyTheme(theme)`
у контролов и никаких литералов цвета вне темы (см. [Theme.md](Theme.md)).

## Правила коммуникации

- **component → control**: вызовы методов контрола + `setStyles(...)`.
- **control → component**: колбэки `onX` (контрол не знает получателя).
- **component ↔ service**: конструкторная инъекция + подписки на события сервиса.
- **component ↔ component**: напрямую **запрещено** — только через общий сервис.

## Чек-лист новой пары Service ↔ Component

Исторически — чек-лист миграции view-контроллера (миграция завершена, слой
Controllers растворён); остаётся конвенцией для нового кода:

1. Логика — в `Workbench/Services/<Area>/`, UI-сборка — в `Workbench/Components/<Area>/`
   (компонент наследует `Component`/`ThemedComponent`).
2. Стили — `updateStyles()` + `getXxxStyles(theme)` из `Workbench/Styles/defaultStyles.ts`
   (никаких `applyTheme(...)` у контролов и ручных подписок на тему).
3. Wiring — в конструктор компонента, async-часть — в сервис (`IActivatable`).
4. DI-токен компонента — `*ComponentDIToken`, рядом с компонентом; биндинг — в
   `Workbench/Modules/`.
5. `view.id` — на корневой контрол компонента; тесты живут рядом с кодом.

## Текущие обитатели

- `Component.ts` — база `Component`/`ThemedComponent`.
- `IActivatable.ts` — контракт async-инициализации сервисов.
- `Styles/` — мост тема → стили контролов (`defaultStyles.ts`).
- `Modules/` — DI-модули и профили (`ProductionProfile`/`TestProfile`,
  `WorkbenchModule` со всеми парами Service ↔ Component и интерфейсными швами,
  `ExtensionHostModule` и др.) — см. [../DI.md](../DI.md).
- `Services/` — переехавшие из Controllers сервисы: система команд (`CommandRegistry`,
  `KeybindingRegistry`, `ContextKeyService`, `ContextKeys`), `KeybindingDispatcher`
  (клавиатурный диспатч: резолв keydown против `KeybindingRegistry` + `ContextKeyService`,
  chord-режим с таймаутами и swallow продолжения, chord-хинт/«is not a command» через
  `StatusBarService`, hold-сессии через `ModifierReleaseArmory`, runtime-детект CSI-u,
  применение user keybindings.json; view не знает — владелец корневого дерева
  (`WorkbenchComponent`) вешает его capture/bubble-листенеры и подключает хук-шов
  `hasKeyboardCapturingOverlay`; второй хук — `updateContextKeys` — замыкает на
  себя `WorkbenchContextKeys`), `StateKeys`,
  `ModifierReleaseArmory`, `ChokidarFileWatcher` + `IFileWatcherDIToken`,
  `FileSearchService`, `QuickOpenParsing`, `collectWordCompletions`, `CoreTokens`,
  каталоги `Workspace/` (undo/redo + `TrashService`/`WorkspaceEditService`/
  `fileClipboardFs.ts` — чистые ФС-операции copy/cut/paste), `TerminalEnvironment/`,
  `Terminal/` (EmbeddedTerminalSession, фабрика, загрузчик node-pty,
  `TerminalService`), `Diagnostics/` (валидатор settings.json,
  `ProblemsTreeDataProvider`, `DiagnosticsService`).
- **Explorer-кластер (этап 7)** — дерево файлов сайдбара и файловые операции:
  - `Services/FileTreeDataProvider.ts` — данные дерева (ленивая загрузка по
    уровням, chokidar-watch раскрытых каталогов, статус-декорации/иконки).
  - `Services/ExplorerService.ts` — логика Explorer'а (аналог `IExplorerService`):
    корень воркспейса + владение провайдером (`setRootPath` пересоздаёт провайдер и
    файрит `onDidChangeRoot`), `revealPath` (построение цепочки предков),
    `autoRevealActiveFile` (настройка `explorer.autoReveal`; активный файл передаёт
    `WorkbenchComponent`), выбор (`getSelectedPaths`/`getPasteTargetDir`),
    `setFileDecorations` (мост декораций extension-host'а: адаптер
    `FileDecorationsServiceAdapter` типизирован минимальным интерфейсом
    `IFileDecorationsTarget`, сервис соответствует структурно), подсветка
    «вырезанных» по `IFileClipboard.onDidChange` и лог ошибок file-watcher'а
    (`filetree.watcher`, подсказка про inotify-лимит). Дерево приходит через шов
    `IExplorerView` (refresh/reveal/focus/selection/cut-keys):
    `TreeViewElement<FileTreeNode>` соответствует структурно, регистрирует его
    компонент через `attachView`.
  - `Components/Explorer/ExplorerComponent.ts` — `ThemedComponent`; по
    `onDidChangeRoot` строит `TreeViewElement` поверх провайдера сервиса
    (обёрнут `ScrollBarDecorator` + `TitledPanelElement` «EXPLORER»,
    `view.id = "explorer"`; стили — `getFileTreeStyles`/`getScrollBarStyles`),
    вяжет события дерева (expand → watch каталога, активация файла → команда
    `workbench.openFile`) и владеет контекст-меню дерева (PopupMenu, пункты
    исполняют команды `explorer.*`/`fileOperations.*`; правый клик и Shift+F10 —
    `openContextMenuAtSelection` — один путь). Overlay-хост приходит через
    late-init шов `attachHost(BodyElement)` (как у DialogService).
  - `Services/FileOperationsService.ts` — файловые операции поверх
    `WorkspaceEditService`/`DialogService`/`UndoRedoService`/`IFileClipboard`:
    `runCreate`/`runRename` (промпт имени через узкий шов
    `IExplorerInputPrompt` — срез `QuickInputService.input`, в DI замкнут на
    `QuickInputServiceDIToken`; интерфейс оставлен ради фейков в тестах),
    `requestDeleteFile` (корзина/
    безвозвратно + подтверждения), `copySelected`/`cutSelected`/`paste`
    (+ `buildPasteEdits`), workspace-undo/redo, `resolveInputPath` (`~`, корень
    воркспейса).
  - `Services/InputWidgetService.ts` — целевой сервис input-команд: держит
    активный `InputElement` (ставит `WorkbenchContextKeys.update()`) и
    исполняет курсор/правки/выделение/клипборд для него (читают экшены
    `Workbench/Actions/InputActions.ts` под `when: inputWidgetFocus`).
- **QuickInput-кластер (этап 8)** — квик-инпут/квик-опен поверх ОДНОГО общего
  виджета:
  - `Components/QuickInput/QuickInputComponent.ts` — `ThemedComponent`; владеет
    единственным переиспользуемым `QuickPickElement` (`view.id = "quickInput"`;
    внутри — `InputElement` строки запроса) и его overlay-сессией
    (`restoreFocus`, `closeOnEscape`, `pointerPolicy: "close-on-outside"`).
    Overlay-хост — late-init шов `attachHost(BodyElement)` (как у
    DialogService). API для сервисов-клиентов: `show()` (позиция: центр, ~10%
    от верха + open + focus), `hide()`, `isOpen()`, канал закрытия `onDidClose`
    (Escape / клик мимо / программное — один путь). Стили: пуш
    `unthemedQuickPickStyles` — пикер пока на исторической unthemed-палитре,
    маппинг на ключи темы — отдельная задача.
  - `Services/QuickInputService.ts` — VS Code-style QuickInput: `input(opts)`
    (InputBox: title/prompt/placeholder/value/`validateInput`; Enter блокируется
    hard-ошибкой) и `quickPick(opts)` (фильтруемый список, `activeIndex`,
    `onDidChangeActive` — шов live-preview). Промисы резолвятся значением/
    выбранным айтемом или `undefined` при отмене; новый вызов отменяет
    предыдущий. На каждый показ полностью ре-инициализирует состояние и колбэки
    общего виджета.
  - `Services/QuickOpenService.ts` — Quick Open: файловый режим (фоновый индекс
    `FileSearchService`, leading+trailing debounce 16мс, live-refresh по
    `onIndexChanged` c сохранением курсора, `file:line[:col]`-суффикс через
    `QuickOpenParsing`), command palette (`>`: `CommandRegistry.listCommands` +
    шорткаты из `KeybindingRegistry`/`ContextKeyService`) и goto-line (`:`;
    активный редактор — шов `IGotoLineEditorSource` → `EditorService`
    структурно, биндинг в `Modules/WorkbenchModule.ts`). Принятие уходит в
    команды (`workbench.openFile` / id команды). UI — тот же
    `QuickInputComponent`; сервис-клиент, занявший виджет позже, закрывает
    предыдущий показ (его промис отменяется через `onDidClose`).
- **`Actions/`** — экшены Workbench (`CommandAction`/`registerAction` — описание
  команды + кейбинды; переехали из Controllers): `FileTreeActions.ts`
  (delete/rename/refresh/undo/redo + Shift+F10-меню Explorer'а),
  `FileTreeClipboardActions.ts` (copy/cut/paste, copyPath/copyRelativePath),
  `FileTreeCreateActions.ts` (`explorer.newFile`/`explorer.newFolder`);
  с этапа 8 — тонкие экшены-пикеры с реальными `run(accessor)`:
  `QuickOpenActions.ts` (Ctrl+P / Show Commands / goto-line →
  `QuickOpenService.open`), `ThemeActions.ts` (`selectColorTheme` поверх
  `QuickInputService.quickPick` + `ThemeRegistry`/`ThemeService`, live-preview
  через `onDidChangeActive`, персист в `workbench.colorTheme`; здесь же
  `themeTypeLabel`), `FileActions.ts` (Open File / Open Folder: InputBox-промпт
  пути + `FileOperationsService.resolveInputPath`; открытие — команда
  `workbench.openFile`, смена воркспейса — шов `IWorkspaceFolderOpener` →
  `WorkbenchComponent` структурно, биндинг в `Modules/WorkbenchModule.ts`).
  Регистрирует их `WorkbenchComponent` в общем цикле `builtinActions`.
  С этапа 9b здесь же экшены активного редактора поверх `EditorService`:
  `EncodingActions.ts` (двухуровневый пикер Reopen/Save with Encoding),
  `EolActions.ts` (convert/toggle/пикер EOL), `ContextMenuActions.ts`
  (Shift+F10-меню редактора). С этапа 10 — `FindActions.ts` (Ctrl+F/Enter/F3/
  Escape → `FindService`) и `SuggestActions.ts` (Ctrl+Space triggerSuggest +
  навигация/accept/hide попапа → `CompletionService`); экшены под
  `findWidgetVisible`/`suggestWidgetVisible` идут ХВОСТОМ `builtinActions`,
  чтобы победить editor-команды (резолвер берёт последний зарегистрированный
  с проходящим `when`). С этапа 11 `Controllers/Actions/` растворён целиком:
  сюда переехали Editor*/Input*/Clipboard*/Folding*/List*/Tab*/Whitespace*/App*/
  Preferences*-экшены (Preferences и save/saveAs/newUntitled — с реальными
  `run(accessor)`, About — экшен поверх DialogService; у quit `run` перекрывает
  `WorkbenchComponent` confirm-save-флоу), добавились `LayoutActions.ts`/
  `TerminalActions.ts`, а сам упорядоченный список — `builtinActions.ts`
  (регистрирует владелец приложения одним циклом).
- **Диалоги (этап 5b)** — `Components/Dialogs/`: база `DialogComponent`
  (наследник `ThemedComponent`; владеет `FitContentElement`-view и строит в нём
  JSX-дерево примитивов через reconcile — компонент **компонует** контролы, не
  наследуя `TUIElement`; общее поведение: ряд кнопок, стрелки, Escape →
  `onDismiss`; цвета — `getDialogStyles(theme)` из `Styles/defaultStyles.ts`:
  ключи `editorWidget.*`, `descriptionForeground`, `textLink.foreground`,
  `editorWarning.foreground`, `button.*`) и наследники `ConfirmDialog`,
  `ConfirmSaveDialog`, `AboutDialog`. Оркестрация — `Services/DialogService.ts`
  (аналог `IDialogService`): владеет компонентами и их overlay-сессиями
  (`pointerPolicy: "modal"`, центрирование по экрану), API —
  `showConfirmDialog`/`showConfirmSaveDialog` (+ promise-обёртка `confirmSave`)/
  `showAboutDialog`, `getOpen*` для тестов/оркестрации. OverlayLayer приходит
  через late-init шов `attachHost(BodyElement)` — его зовёт владелец корневой
  view (`WorkbenchComponent`) после её постройки.
- **Жизненный цикл (этап 5c)** — `Services/LifecycleService.ts`:
  `requestQuit(onQuit)` последовательно спрашивает про «грязные» элементы
  участников через `DialogService.confirmSave` (Cancel прерывает выход; чистый
  выход — синхронно, до первого await). Шов — интерфейс `IShutdownParticipant`
  (`collectDirty(): IShutdownDirtyItem[]` — имя + `isStillDirty()` + `save()`
  с overwrite): Workbench объявляет, `EditorService` реализует
  структурно, регистрирует его `WorkbenchComponent`; сам выход (teardown TUI +
  `process.exit`) остаётся колбэком `onQuit` от владельца приложения.
- **Статус-бар — эталонная пара Service ↔ Component** (пилот, этап 4):
  - `Services/StatusBarService.ts` — реестр записей статус-бара (аналог
    `IStatusbarService` VS Code): `addEntry(IStatusBarEntry) → IStatusBarEntryHandle`
    (`update`/`dispose`), `onDidChangeEntries`, `entries()` (left, затем right; внутри
    стороны — по убыванию `priority`, выше — левее, как в VS Code). Про поставщиков
    и контролы не знает.
  - `Components/StatusBar/StatusBarComponent.ts` — `ThemedComponent`; владеет
    `StatusBarElement` (`view.id = "statusBar"`), перерисовывает айтемы по
    `onDidChangeEntries`, красит бар из темы в `updateStyles()`.
  - Сегменты публикуют contribution-сервисы: `Services/EditorStatusContribution.ts`
    (правые, порядок VS Code: `Ln X, Col Y` · Encoding · EOL · Language; Encoding/EOL
    кликабельны — команды `changeEncoding`/`changeEOL` через `CommandRegistry`) и
    `Services/TerminalEnvironment/TerminalEnvStatusContribution.ts` (tier + моды).
    Активный редактор приходит через **интерфейсный шов**: Workbench объявляет
    `IActiveEditorStatusSource`/`IActiveEditorStatus` (минимальный срез:
    `onActiveEditorChanged`, курсор/encoding/EOL/язык), `EditorService`
    соответствует ему структурно; связывание — биндинг
    `ActiveEditorStatusSourceDIToken` в `Modules/WorkbenchModule.ts`.
    Chord-хинт публикует `KeybindingDispatcher` как обычную запись сервиса.
- **Panel-кластер (этап 6)** — нижняя панель и её вкладки:
  - `Services/PanelService.ts` — реестр вкладок нижней Panel (id, title, content,
    placeholder), активная вкладка и **видимость** панели. События:
    `onDidChangeViews`, `onDidChangeActiveView`, `onDidActivateView`
    (пользовательская активация — клик по табу; программный `setActiveView` его
    **не** порождает — на нём висят ленивые фичи), `onDidChangeVisibility`
    (с этапа 11 за ней следует `LayoutService`: двигает `WorkbenchLayoutElement`
    и контекст-ключ `panelVisible`).
  - `Components/Panel/PanelComponent.ts` — `ThemedComponent`; владеет
    `PanelContainerElement` (`view.id = "panel"`, стили —
    `getPanelContainerStyles`), отражает реестр сервиса (вкладки/контент/актив)
    и возвращает клик по табу в `PanelService.activateView`.
  - `Components/Panel/ProblemsComponent.ts` — `ThemedComponent`; дерево
    «файл → маркеры» (`TreeViewElement` поверх `ProblemsTreeDataProvider`,
    `view` = `ScrollBarDecorator`, `view.id = "problemsView"`; стили —
    `getProblemsTreeStyles` + `getScrollBarStyles`). Регистрирует вкладку
    PROBLEMS (`PROBLEMS_VIEW_ID`); пока маркеров нет — контент null (панель
    рендерит placeholder). Reveal маркера — через **интерфейсный шов**
    `IMarkerRevealTarget` (`openUri` + `getActiveEditor` с
    `goToPosition`/`revealRange`); `EditorService` соответствует
    структурно, биндинг `MarkerRevealTargetDIToken` — в `Modules/WorkbenchModule.ts`.
  - `Services/Terminal/TerminalService.ts` — headless-оркестратор терминала:
    инстансы (id/title/session), lazy spawn через `TerminalSessionFactory`,
    регистрация вкладки TERMINAL (`TERMINAL_VIEW_ID`) + подписка на её
    активацию, чистка PTY при выходе шелла/dispose. События:
    `onDidOpenInstance`/`onDidCloseInstance`/`onDidChangeActiveInstance`/
    `onDidRequestFocus`.
  - `Components/Panel/TerminalPanelComponent.ts` — view-владелец терминала:
    строит `TerminalViewElement` по каждому инстансу, вкидывает виджет
    активного в TERMINAL-вкладку (через `PanelService.setViewContent`), красит
    виджеты (`getTerminalViewStyles`). **Не** наследник `Component`: корневого
    контрола нет — его UI это несколько виджетов. ВАЖНО: у `TUIElement` нет
    unmount-хуков, поэтому компонент **обязан** сам dispose'ить виджеты — при
    закрытии инстанса и при своём `dispose()`.
  - `Services/Diagnostics/DiagnosticsService.ts` — headless-проводник диагностик
    поверх `MarkerService`: поставщик — валидатор активного settings.json,
    потребитель — editor squiggles (Problems — второй потребитель того же
    реестра). Редакторы приходят через шов `IDiagnosticsEditorSource` /
    `IDiagnosticsEditor` (`EditorService`/`EditorPane`
    структурно; биндинг `DiagnosticsEditorSourceDIToken` — в WorkbenchModule).
- **Editor-кластер (этапы 9a/9b)** — редактор целиком в Workbench:
  - `Services/TextFile/TextFileModel.ts` — per-file модель без view (аналог
    `ITextFileEditorModel`): владеет `TextDocument`, dirty-статусом
    (`isModified` = versionId + EOL-ось), осями encoding/EOL/language, записью
    на диск (`save`/`saveAs`/`saveWithEncoding` + save-участник с клампом правок),
    перечиткой (`revertToDisk`/`reopenWithEncoding` → событие
    `onDidReloadDocument`) и слежением за файлом на диске через `IFileWatcher`
    (авто-перечитка чистого буфера / `hasDiskConflict` у «грязного»); undo-роутинг
    в `UndoRedoService` (`undoContext` + `attachUndoRouting`; движок
    `UndoManager` остаётся в `src/Editor`). **Не** singleton-сервис: экземпляр на
    файл, создаёт владелец. Правки, которые модель применяет сама (участник,
    `setEol`, `applyExternalEdits`), идут через шов `ITextFileEditTarget` —
    его прикрепляет парный компонент.
  - `Components/Editor/EditorComponent.ts` — `ThemedComponent`; владеет
    `EditorElement` + view-state + токен-кешем (`view` = `ScrollBarDecorator`),
    принимает модель в конструктор: по `onDidReloadDocument` пересобирает
    view-state/`EditorElement` (перенося стили/контекст-меню/undo-роутинг), по
    `onDidChangeLanguage` и `TokenizationRegistry.onDidChange` пересаживает
    токенизатор, по контенту пересчитывает folding-регионы (микротаск-коалесинг).
    Здесь же view-API: курсор/reveal/goToPosition, декорации (search/markers/
    gutter change-bars), folding-команды, контекст-меню редактора,
    `updateStyles()` → `getEditorStyles` + `editor.style={fg,bg}` +
    `getScrollBarStyles`.
  - `Components/Editor/EditorPane.ts` — пара «модель + view-компонент» одного
    открытого редактора (аналог editor input + pane): владеет временем жизни
    `TextFileModel` + `EditorComponent` и делегирует единый API по
    принадлежности. Это поверхность «активного редактора» для потребителей
    (экшены, Find/Completion, host-адаптеры, швы `IActiveEditorStatus`/
    `IDiagnosticsEditor`/`IMarkerRevealEditor`/`IGotoLineEditor` — выполняются
    структурно делегатами в модель/компонент).
  - `Services/EditorService.ts` (этап 9b, растворённый `EditorGroupController`) —
    логика группы редакторов без view: создаёт/хранит пары `EditorPane`,
    активная вкладка + MRU-порядок (Ctrl+Tab: `cycleMru`/`endMruCycle`,
    заморозка серии), `openFile`/`openUri`/`newUntitled`/`closeTab`/
    `activateTab`, `displayName`/`suggestedSaveName`, применение
    `editor.*`-настроек (включая live-reload), группа-уровневые швы host'а
    (`saveParticipant`, `completionSource`), `IShutdownParticipant`
    (`collectDirty`). События: `onActiveEditorChanged`, `onEditorSaved`,
    `onDidChangeEditors` (канал синхронизации view; файрится до
    `onActiveEditorChanged`, чтобы контент стоял в дереве к моменту фокуса).
  - `Components/Editor/EditorGroupComponent.ts` — `ThemedComponent`; владеет
    `EditorGroupElement` (tab strip + контент-хост + локальный OverlayLayer
    для find-виджета; `view.id = "editorGroup"`): по `onDidChangeEditors`
    вставляет view активного `EditorPane` и перерисовывает табы (метки с
    минимальной разводкой тёзок по родительским каталогам, иконки, маркер
    изменённости — `getTabStripStyles`); клики по табам возвращает в сервис
    (`activateTab`/`closeTab`, закрытие «грязной» вкладки — через
    `EditorService.onRequestConfirmClose`).
- **Find/Suggest-кластер (этап 10)** — поиск по файлу и автодополнение поверх
  активного редактора (`EditorService`):
  - `Components/Editor/FindComponent.ts` — `ThemedComponent`; владеет
    `FindWidgetElement` (`view.id = "findWidget"`; стили —
    `getFindWidgetStyles`: кнопки из `getDialogButtonStyles`) и его
    overlay-сессией в ЛОКАЛЬНОМ слое группы редакторов (`pointerPolicy:
    "passthrough"` — док-виджет, клики мимо уходят в редактор). Хост
    (`EditorGroupElement`) приходит через late-init шов `attachHost` — его зовёт
    `WorkbenchComponent` после постройки дерева. `show()` позиционирует виджет (правый
    край группы с 1-колоночным отступом, под tab strip) и фокусирует input.
  - `Services/FindService.ts` — состояние поиска query → matches → current
    index: `open` (сеет запрос из однострочного выделения), `close` (курсор
    остаётся на текущем совпадении, подсветка снимается), `next`/`prev`
    (циклично), recompute по `onQueryChange` (стартовый индекс — первое
    совпадение от курсора); подсветка/reveal — `setSearchDecorations`/
    `revealRange` активного `EditorPane`. Смена активного редактора закрывает
    виджет (подписка на `onActiveEditorChanged` — find оперирует только
    активным редактором).
  - `Components/Editor/SuggestComponent.ts` — компонент suggest-попапа; владеет
    `CompletionListElement` (`view.id = "suggestWidget"`; НЕ `ThemedComponent` —
    контрол живёт на unthemed-палитре `unthemedCompletionListStyles`, маппинг
    на тему — отдельная задача) и overlay-сессией в глобальном body-слое
    (`attachHost(BodyElement)`; `capturesKeyboard: false` — редактор сохраняет
    фокус, команды идут по `suggestWidgetVisible`; `close-on-outside`).
    `openAt(anchor)`/`setAnchor` — позиционирование у каретки
    (`EditorPane.getCaretAnchor`).
  - `Services/CompletionService.ts` — логика автодополнения (WP8): `trigger()`
    (провайдеры расширений через `EditorService.completionSource` + word-based
    fallback `collectWordCompletions` из всех открытых редакторов), сессия
    попапа (живой `prefixRange`, re-filter по мере набора, авто-suggest по
    эвристике «вставлен 1 word-символ» с задержкой `autoSuggestDelayMs`),
    accept (замена префикса/провайдерского range с догоном каретки;
    `item.command` исполняется напрямую через `CommandRegistry.execute` в
    микротаске), делегаторы select*/accept/hide для команд, `onFocusChanged`
    (зовёт `WorkbenchContextKeys.handleFocusChange` при смене фокуса —
    клавиатурный уход с редактора закрывает попап).
- **Shell-кластер (этапы 11–12)** — корневой компонент, меню, layout, персист
  сессии и контекст-ключи:
  - `Components/Shell/WorkbenchComponent.ts` — **корневой компонент приложения**
    (финал этапа 12; бывший `AppController`): владеет корневой view
    (`BodyElement`, `view.id = "workbench"`, + `WorkbenchLayoutElement` с сэшами),
    вставляет в неё view компонентов (`EditorGroupComponent` в центр,
    `PanelComponent` вниз, `ExplorerComponent` в сайдбар при
    `setWorkspaceFolder`, `StatusBarComponent`, `MenuBarComponent` — ПОСЛЕ
    применения user keybindings), прикрепляет late-init швы
    (`DialogService`/`ExplorerComponent`/`QuickInputComponent`/`SuggestComponent`
    `attachHost(BodyElement)`, `FindComponent.attachHost(EditorGroupElement)`,
    `LayoutService.attachLayout`, `WorkbenchContextKeys.attachView`), вешает
    листенеры `KeybindingDispatcher` и фокус-хуки, регистрирует команду
    `workbench.openFile` и весь список `builtinActions` одним циклом (+
    перекрывает `run` у quit: confirm-save через `LifecycleService`, выход —
    teardown TUI + `process.exit`). Наследник `ThemedComponent`:
    `updateStyles()` красит корень (fg/bg body) и hover-цвет сэшей.
    Единственный компонент с lifecycle за пределами конструктора — bootstrap
    ведёт `main.ts`: `setWorkspaceFolder` → `mount()` (листенеры + restore
    layout до первого кадра) → `run()` → `activate()` (контекст-ключи, probe
    терминала, активация редакторов/Explorer'а) → `openFile`/
    `restoreOpenEditors` → `focusEditor`.
  - `Services/MenuService.ts` — декларативная модель главного меню
    (`IMenuModel`/`MenuEntryModel`): пункты собираются из command-id, лейблов и
    мнемоник; отображаемый шорткат резолвится из
    `KeybindingRegistry.getKeybindingForCommand` (тот же источник, что у command
    palette), поэтому меню не расходится с реальными биндингами. Про контролы и
    исполнение сервис не знает.
  - `Components/Shell/MenuBarComponent.ts` — `ThemedComponent`; владеет
    `MenuBarElement` (`view.id = "menuBar"`; стили — `getMenuStyles`), строит
    items из `MenuService.getMenus()`, выбор пункта исполняет команду через
    `CommandRegistry`. Резолвится ПОСЛЕ применения user keybindings (шорткаты
    снимаются на момент постройки); `view` вставляет владелец корневой view
    (`BodyElement.setMenuBar`).
  - `Services/LayoutService.ts` — логика workbench-layout'а: сайдбар
    (видимость/`toggleSidebar`/`nudgeSidebarWidth`/`resetSidebarWidth`) и
    нижняя панель (`isPanelVisible`/`setPanelVisible`; истина видимости — в
    `PanelService`, layout и контекст-ключ `panelVisible` следуют за
    `onDidChangeVisibility`). Персист layout'а поверх `IStateService`
    (`StateKeys.ts`): `restoreLayout()` до первого кадра (+ синхронизация истины
    в PanelService), write-through `captureLayout()` по
    `WorkbenchLayoutElement.onDidChangeLayout` (drag сэша и команды; во время
    restore глушится re-entrancy-guard'ом). Сам `WorkbenchLayoutElement` остаётся
    контролом у владельца корневой view (`WorkbenchComponent`) и приходит через
    late-init шов `attachLayout`.
  - `Services/WorkbenchStateService.ts` — персист открытых редакторов (headless):
    `openWorkspace` (per-project стор), `captureOpenEditors` (write-through —
    собственная подписка на `EditorService.onActiveEditorChanged`),
    `getOpenEditorsToRestore`/`restoreOpenEditors` (реплей выживших путей +
    активная вкладка). См. [State.md](State.md).
  - `Services/WorkbenchContextKeys.ts` — выставляет контекст-ключи
    (`ContextKeys.ts`) из фокуса и сервисов: `update()` читает активный элемент
    из FocusManager корневой view (шов `attachView`; ключи
    `textInputFocus`/`inputWidgetFocus`/`listFocus`/`terminalFocus` + передача
    активного `InputElement` в `InputWidgetService`), состояние сервисов
    (`editorGroupHasEditors`/`editorTabsMultiple`/`panelVisible`/
    `findWidgetVisible`/`suggestWidgetVisible`/`terminalIsOpen`) и терминальное
    окружение (tier/os/cap_*/mode_*; динамические `mode_<name>` регистрирует в
    конструкторе + подписка на `onDidChange`). Замыкает на себя хук
    `KeybindingDispatcher.updateContextKeys`; `handleFocusChange` (capture
    focus/blur листенеры вешает владелец дерева) сбрасывает незавершённый чорд и
    закрывает suggest-попап при уходе фокуса с редактора.
  - Экшены: `LayoutActions.ts` (toggle sidebar Ctrl+B, show explorer
    Ctrl+Shift+E, reveal active file, width-команды, toggle panel Ctrl+J,
    Problems Ctrl+Shift+M) и `TerminalActions.ts` (toggle Ctrl+` / new
    Ctrl+Shift+` на tier kitty/csi-u) — поверх LayoutService/PanelService/
    TerminalService/WorkbenchContextKeys.
- `Components/` — UI-компоненты: `StatusBar/` (пилот), `Dialogs/`, `Panel/`, `Explorer/`, `QuickInput/`, `Editor/` и `Shell/` (корневой `WorkbenchComponent` + меню-бар).

## Конвенции системы команд

- ID команд, отражающих VS Code Workbench/Editor, именуются в стиле VS Code
  (`workbench.action.closeActiveEditor`).
- Доступность кейбиндингов — через typed when-контексты из
  `Workbench/Services/ContextKeys.ts` (`ContextKeyService`); фокус/UI-состояния
  обновляет `WorkbenchContextKeys.update()`.
- Кейбинды адаптируются к терминалу по трём осям — **capability** / **tier**
  (`legacy < csi-u < kitty`) / **mode** (`local`/`ssh`/`tmux`) — доступны в
  when-клаузах (`tier == 'kitty'`, `cap_osc52`, `mode_ssh`, `os == 'mac'`).
  Default-бинды задают tier-зависимые fallback'и через per-binding `when`;
  пользовательские — через `keybindings.json` (VS Code-семантика `-command`
  для unbind).
- Экшены объявляются `CommandAction`/`registerAction` в `Workbench/Actions/`;
  упорядоченный список — `builtinActions.ts`, регистрирует `WorkbenchComponent`
  одним циклом. Порядок важен: резолвер берёт последний зарегистрированный
  биндинг с проходящим `when`.

## Разделение Service/Component / Element / State

Виджет со сколько-нибудь сложным поведением строится из трёх частей, а не из
«толстого» элемента:

- **Service/Component** (слой Workbench) — логика, I/O, подписки, оркестрация;
- **Element** (слой TUIDom) — тонкий: только render + локальные input-события;
- опц. **State-класс** — выделенное изменяемое состояние виджета.

Связь двунаправленная и без обратной зависимости TUIDom → Workbench:
`element.onX = …` (element → component) и `component.update(view)`
(component → element). Эталоны: `EditorGroupComponent` ↔ `EditorGroupElement`,
`InputWidgetService` ↔ `InputElement` + `InputState`, `StatusBarComponent` ↔
`StatusBarElement`. «Контроллеры под видом элемента» (напр. `MenuBarElement`,
`ContextMenuLayer`) сводим к этому паттерну — см.
[../TODO/Inspector.md](../TODO/Inspector.md).

Зависимости слоя: Workbench → { Editor, TUIDom, Theme, Configuration, Common,
интерфейс Backend }. Workbench — верхний слой ядра приложения; выше него только
Extensions (host-адаптеры) и App (`main.ts`).
