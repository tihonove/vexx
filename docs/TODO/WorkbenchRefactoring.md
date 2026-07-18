# Workbench-рефакторинг: Controllers → Services + Components, контролы TUIDom как «вещь в себе»

Статус: `[~]` в работе.

## Цель

1. **Контролы** (примитивы TUIDom) — переиспользуемая «вещь в себе»: не знают ничего про темы,
   сервисы и приложение. Стили — по VS Code-паттерну: плоский интерфейс `IXxxStyles`
   (packed-цвета) через `options.styles` конструктора и/или метод `setStyles()`, плюс
   `unthemedXxxStyles`-дефолты рядом с контролом.
2. **Новый слой `src/Workbench/`** — прикладные компоненты + сервисы приложения. Компоненты
   используют контролы композиционно: размещают их (как DOM), не вмешиваются в их жизненный
   цикл, не наследуются от конкретных контролов.
3. **Модель Service ↔ Component**: сервис — где живёт логика приложения; компонент принимает
   сервисы в конструктор и общается с ними (подписки, вызовы). Как в VS Code (Part/ViewPane).
4. **Контроллеры растворяются полностью**: логика → Services, UI-сборка → Components,
   слой Controllers исчезает.
5. Тяжёлые контролы остаются контролами: `EditorElement`, `TerminalViewElement`, `TreeViewElement`.

Целевая схема слоёв:

```
App → Extensions → Workbench → Editor → TUIDom → { Input, Rendering, Backend } → Common
          ↑            ↑          ↑
        Theme ─────────┘──────────┘  (Editor и TUIDom НЕ импортируют Theme; связь через IXxxStyles)
```

Переходное правило на время миграции: `Controllers → Workbench` (Controllers временно над
Workbench и может его импортировать; обратно — никогда).

## Этапы

- [x] 1. Стандарт `IXxxStyles` + дестемизация контролов TUIDom (Button-эталон; MenuBar/PopupMenu/
       FindWidget/диалоги теряют `applyTheme(WorkbenchTheme)`; `Workbench/Styles/defaultStyles.ts`;
       1b: TreeView/ScrollBar/TabStrip/QuickPick/CompletionList/TerminalView/PanelContainer,
       `applyScrollBarTheme` растворён в `getScrollBarStyles`)
- [x] 2. `IEditorStyles`: дестемизация `EditorElement` (включая `menuTheme`) — специализированные
       цвета (гуттер/номера строк/word-highlight/indent-guides/fold-контрол/squiggles) + `menu`
       единым каналом `setStyles(IEditorStyles)`; маппинг — `getEditorStyles` в
       `Workbench/Styles/defaultStyles.ts`; основные fg/bg остаются на `editor.style = { fg, bg }`
- [x] 3. Каркас Workbench (`Component`/`ThemedComponent`) + переезд готовых сервисов
       (CommandRegistry, KeybindingRegistry, ContextKeyService, Workspace/, TerminalEnvironment/, …;
       в Controllers остались `TrashService`/`WorkspaceEditService` — тянули `Actions/fileClipboardFs.ts`,
       доехали на этапе 7 — и `TerminalEnvironmentIntegration.test.ts` — тянет `AppController`)
- [x] 4. Пилот: `StatusBarService` + `StatusBarComponent` (эталонная пара; `StatusBarController`
       растворён: сегменты публикуют `EditorStatusContribution` (шов
       `IActiveEditorStatusSource` → `EditorGroupController`) и `TerminalEnvStatusContribution`,
       chord-хинт — `AppController` через `StatusBarService`; биндинги — `Modules/WorkbenchModule.ts`)
- [x] 5. Вынос из AppController: 5a — `KeybindingDispatcher` (чорды/armory/swallow/
       chord-хинт/user keybindings в `Workbench/Services/KeybindingDispatcher.ts`;
       AppController вешает листенеры и подключает хуки `updateContextKeys` /
       `hasKeyboardCapturingOverlay`); 5b — `DialogService` (`Workbench/Services/`)
       + диалоги-компоненты `Components/Dialogs/` (база `DialogComponent` поверх
       нового примитива `FitContentElement`; цвета из `editorWidget.*` вместо
       хардкодов); 5c — `LifecycleService` (`requestQuit` + `IShutdownParticipant`,
       участник — `EditorGroupController`; выход — колбэк `onQuit` от AppController)
- [x] 6. Panel-кластер: `DiagnosticsService` (шов `IDiagnosticsEditorSource` →
       `EditorGroupController`), `PanelService` (реестр вкладок + активная +
       видимость; `onDidActivateView` — только пользовательская активация) +
       `PanelComponent` (владеет `PanelContainerElement`), `ProblemsComponent`
       (вкладка PROBLEMS + дерево; шов reveal `IMarkerRevealTarget` →
       `EditorGroupController`), `TerminalService` (инстансы, lazy spawn,
       вкладка TERMINAL) + `TerminalPanelComponent` (view-владелец виджетов
       `TerminalViewElement`; не наследник `Component` — корневого контрола нет,
       обязан dispose'ить виджеты: у TUIElement нет unmount-хуков); toggle-команды
       панели — `AppController` поверх `PanelService` (layout/`panelVisible` следуют
       за `onDidChangeVisibility`); биндинги — `Modules/WorkbenchModule.ts`
- [x] 7. Explorer-кластер: `ExplorerService` (корень/`FileTreeDataProvider`/reveal/
       autoReveal/декорации/cut-подсветка; дерево через шов `IExplorerView`,
       мост декораций host'а через `IFileDecorationsTarget`) + `ExplorerComponent`
       (TreeView + скроллбар + рамка EXPLORER, контекст-меню в overlay-хосте
       через `attachHost`), `FileOperationsService` (create/rename/delete/
       clipboard-paste/workspace-undo-redo/`resolveInputPath`; промпт — шов
       `IExplorerInputPrompt` → `QuickInputController` до этапа 8);
       `InputWidgetController` → `Services/InputWidgetService.ts` (это не
       inline-инпут Explorer'а, а headless-цель input-команд без view —
       по инварианту слоя это Service, не Component); `Workspace/`-хвост этапа 3
       (`TrashService`/`WorkspaceEditService`/`fileClipboardFs`) и
       `FileTreeDataProvider` доехали в `Workbench/Services/`; новый каталог
       `Workbench/Actions/` (`CommandAction`+`registerAction`, FileTree*-экшены
       перевязаны на сервисы; `showEditorContextMenuAction` остался в
       Controllers/Actions — тянет `EditorGroupController`, этап 9); биндинги —
       `Modules/WorkbenchModule.ts`, шов `FileTreeControllerDIToken` удалён
- [x] 8. QuickInput-кластер: `QuickInputComponent` (ЕДИНСТВЕННЫЙ общий
       `QuickPickElement` + overlay-сессия, `attachHost`, unthemed-стили 1:1) +
       `QuickInputService` (`input`/`quickPick`; шов `IExplorerInputPrompt`
       FileOperationsService замкнут на него в DI) + `QuickOpenService`
       (файлы/`>`команды/`:`goto-line; активный редактор — шов
       `IGotoLineEditorSource` → `EditorGroupController`; accept — команды
       `workbench.openFile`/id); `FileSearchService` забиндин в DI; пикеры из
       AppController → тонкие экшены: `Workbench/Actions/QuickOpenActions.ts`,
       `ThemeActions.ts` (selectColorTheme + `themeTypeLabel`),
       `FileActions.ts` (Open File/Open Folder; шов `IWorkspaceFolderOpener` →
       `AppController`); `changeEncoding`/`changeEOL` — тонкие экшены, но
       остались в `Controllers/Actions/` (тянут `EditorGroupController` —
       активный редактор/displayName/Save As; уедут со швом редактора на
       этапе 9); контроллеры QuickInput/QuickOpen растворены, биндинги —
       `Modules/WorkbenchModule.ts`
- [x] 9. Editor: 9a — `EditorController` растворён: `TextFileModel`
       (`Workbench/Services/TextFile/`; per-file модель: TextDocument, dirty,
       encoding/EOL/language-оси, save/saveAs + участник, disk-watch
       reload/conflict, undo-роутинг `undoContext`+`attachUndoRouting`; правки
       модели — через шов `ITextFileEditTarget`) + `EditorComponent`
       (`Workbench/Components/Editor/`; `ThemedComponent`: EditorElement/view-state/
       токен-кеш, пересборка по `onDidReloadDocument`, folding, декорации,
       курсор/reveal, контекст-меню, `updateStyles`); 9b — `EditorGroupController`
       растворён: `EditorService` (`Workbench/Services/`; пары `EditorPane`
       (переехал в `Workbench/Components/Editor/`), активная вкладка + MRU
       Ctrl+Tab, open/close/newUntitled, `displayName`/`suggestedSaveName`,
       `editor.*`-конфиг + live-reload, `saveParticipant`/`completionSource`,
       `IShutdownParticipant`; события `onActiveEditorChanged`/`onEditorSaved`/
       `onDidChangeEditors`) + `EditorGroupComponent` (`ThemedComponent` поверх
       `EditorGroupElement`: контент активного редактора, табы с разводкой
       тёзок, tab-колбэки; `view.id="editorGroup"`). Швы Active/Diagnostics/
       MarkerReveal/GotoLine и host-адаптеры (`EditorOptionsServiceAdapter`/
       `EditorDecorationsServiceAdapter`, `ExtensionHostModule`) перевязаны на
       `EditorService`; экшены Encoding/Eol/ContextMenu — в `Workbench/Actions/`;
       `runSave`/`runSaveAs` остались в AppController (тянут его приватный
       `updateContextKeys`). Тесты EditorGroupController.* → `EditorService.*` /
       `EditorGroupComponent.test.ts`
- [ ] 10. `CompletionService`+`SuggestComponent`, `FindService`+`FindComponent`
- [ ] 11. `MenuService`+`MenuBarComponent`, `LayoutService`, `WorkbenchStateService`, ContextKeys
- [ ] 12. Финал: `WorkbenchComponent`, Modules → Workbench, смерть `src/Controllers/`
- [ ] 13. Зачистка + документация (arch/Workbench.md, ARCHITECTURE.md, DI.md)

## Ключевые контракты

Стандарт стилей контрола (единый):

```ts
export interface IButtonStyles { readonly fg: number; readonly bg: number; /* … */ }
export const unthemedButtonStyles: IButtonStyles = { /* историческая палитра */ };
class ButtonElement {
    constructor(label: string, options?: { styles?: IButtonStyles });
    setStyles(styles: IButtonStyles): void; // единственный канал обновления, вызывает markDirty()
    // имя style занято базовым аксессором TUIElement (система наследования TUIStyle)
}
```

Мост тема→стили — `src/Workbench/Styles/defaultStyles.ts`: по функции `getXxxStyles(theme)` на
контрол; единственная точка знания «ключ темы → поле стиля». Раздача пуш-моделью: компонент
подписан на смену темы (`ThemedComponent.updateStyles()`) и заново вызывает `control.setStyles(...)`.

База компонентов — `src/Workbench/Component.ts`:

```ts
abstract class Component extends Disposable { abstract readonly view: TUIElement; }
abstract class ThemedComponent extends Component {
    constructor(themeService: ThemeService); // подписка на onThemeChange → updateStyles()
    protected abstract updateStyles(): void; // наследник вызывает в конце конструктора
}
```

У компонентов нет `mount()`/`activate()` — всё в конструкторе; async-инициализация живёт в
сервисах (`IActivatable { activate(): Promise<void> }`). Компонент ↔ компонент напрямую —
запрещено, только через сервис.
