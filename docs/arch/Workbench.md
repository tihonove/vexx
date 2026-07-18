# Workbench/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).
План миграции Controllers → Workbench — [../TODO/WorkbenchRefactoring.md](../TODO/WorkbenchRefactoring.md).

Прикладной слой приложения. Здесь живут **сервисы** (логика приложения) и **компоненты**
(UI-сборка поверх контролов TUIDom) — как в VS Code (services + Part/ViewPane).

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

## Чек-лист миграции view-контроллера

1. Логику — в `Workbench/Services/<Area>/`, UI-сборку — в `Workbench/Components/<Area>/`
   (компонент наследует `Component`/`ThemedComponent`).
2. `applyTheme(...)` / ручные подписки на тему → `updateStyles()` +
   `getXxxStyles(theme)` из `Workbench/Styles/defaultStyles.ts`.
3. `mount()`/`activate()` контроллера: wiring — в конструктор компонента,
   async-часть — в сервис (`IActivatable`).
4. DI-токен компонента — `*ComponentDIToken`, рядом с компонентом; биндинг — в
   `Controllers/Modules/` (до этапа 12 рефакторинга).
5. `view.id` — на корневой контрол компонента; тесты переезжают `git mv` вместе с кодом.
6. Проверить направление зависимостей: Workbench не импортирует Controllers (никогда).

## Текущие обитатели

- `Component.ts` — база `Component`/`ThemedComponent`.
- `IActivatable.ts` — контракт async-инициализации сервисов.
- `Styles/` — мост тема → стили контролов (`defaultStyles.ts`).
- `Services/` — переехавшие из Controllers сервисы: система команд (`CommandRegistry`,
  `KeybindingRegistry`, `ContextKeyService`, `ContextKeys`), `KeybindingDispatcher`
  (клавиатурный диспатч: резолв keydown против `KeybindingRegistry` + `ContextKeyService`,
  chord-режим с таймаутами и swallow продолжения, chord-хинт/«is not a command» через
  `StatusBarService`, hold-сессии через `ModifierReleaseArmory`, runtime-детект CSI-u,
  применение user keybindings.json; view не знает — владелец корневого дерева (сейчас
  `AppController`) вешает его capture/bubble-листенеры и подключает два хука-шва:
  `updateContextKeys` и `hasKeyboardCapturingOverlay`), `StateKeys`,
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
    AppController), выбор (`getSelectedPaths`/`getPasteTargetDir`),
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
    активный `InputElement` (ставит AppController из `updateContextKeys`) и
    исполняет курсор/правки/выделение/клипборд для него (читают экшены
    `Controllers/Actions/InputActions.ts` под `when: inputWidgetFocus`).
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
    активный редактор — шов `IGotoLineEditorSource` → `EditorGroupController`
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
  `AppController` структурно, биндинг в `Modules/WorkbenchModule.ts`).
  Регистрирует их (пока) AppController в общем цикле `builtinActions`.
  Пикеры `changeEncoding`/`changeEOL` остались тонкими экшенами в
  `Controllers/Actions/` — тянут активный редактор через
  `EditorGroupController` (этап 9).
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
  view (сейчас AppController) после её постройки.
- **Жизненный цикл (этап 5c)** — `Services/LifecycleService.ts`:
  `requestQuit(onQuit)` последовательно спрашивает про «грязные» элементы
  участников через `DialogService.confirmSave` (Cancel прерывает выход; чистый
  выход — синхронно, до первого await). Шов — интерфейс `IShutdownParticipant`
  (`collectDirty(): IShutdownDirtyItem[]` — имя + `isStillDirty()` + `save()`
  с overwrite): Workbench объявляет, `EditorGroupController` реализует
  структурно, регистрирует его AppController; сам выход (teardown TUI +
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
    `onActiveEditorChanged`, курсор/encoding/EOL/язык), `EditorGroupController`
    соответствует ему структурно; связывание — биндинг
    `ActiveEditorStatusSourceDIToken` в `Controllers/Modules/WorkbenchModule.ts`.
    Chord-хинт публикует `KeybindingDispatcher` как обычную запись сервиса.
- **Panel-кластер (этап 6)** — нижняя панель и её вкладки:
  - `Services/PanelService.ts` — реестр вкладок нижней Panel (id, title, content,
    placeholder), активная вкладка и **видимость** панели. События:
    `onDidChangeViews`, `onDidChangeActiveView`, `onDidActivateView`
    (пользовательская активация — клик по табу; программный `setActiveView` его
    **не** порождает — на нём висят ленивые фичи), `onDidChangeVisibility`
    (владелец layout'а — сейчас AppController — двигает `WorkbenchLayoutElement`
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
    `goToPosition`/`revealRange`); `EditorGroupController` соответствует
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
    `IDiagnosticsEditor` (`EditorGroupController`/`EditorController`
    структурно; биндинг `DiagnosticsEditorSourceDIToken` — в WorkbenchModule).
- `Components/` — UI-компоненты: `StatusBar/` (пилот), `Dialogs/`, `Panel/`, `Explorer/` и `QuickInput/`.

Зависимости слоя: Workbench → { Editor, TUIDom, Theme, Configuration, Common,
интерфейс Backend }. Переходное правило: Controllers временно **над** Workbench
(импортирует его), по завершении миграции будет растворён.
