# Workbench-рефакторинг: Controllers → Services + Components, контролы TUIDom как «вещь в себе»

Статус: `[x]` завершено. Документ — исторический: фиксирует план и ход миграции;
актуальное описание слоя — [../arch/Workbench.md](../arch/Workbench.md).

## Цель

1. **Контролы** (примитивы TUIDom) — переиспользуемая «вещь в себе»: не знают ничего про темы,
   сервисы и приложение. Стили — по VS Code-паттерну: плоский интерфейс `IXxxStyles`
   (packed-цвета) через `options.styles` конструктора и/или метод `setStyles()`, плюс
   `unthemedXxxStyles`-дефолты рядом с контролом.
2. **Новый слой `src/vs/workbench/`** — прикладные компоненты + сервисы приложения. Компоненты
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
- [x] 10. Find/Suggest-кластер: `CompletionService` (`Workbench/Services/`;
       триггер/префикс/re-filter/авто-suggest/accept; `item.command` →
       `CommandRegistry.execute` напрямую, хук `onExecuteCommand` умер) +
       `SuggestComponent` (`Components/Editor/`; НЕ ThemedComponent —
       CompletionListElement на unthemed-палитре; overlay-сессия у каретки в
       body-слое, `attachHost(BodyElement)`); `FindService` (query→matches→index,
       next/prev, seed из выделения; закрытие при смене активного редактора —
       собственная подписка на `EditorService.onActiveEditorChanged`, у
       Completion — в `bindEditor`) + `FindComponent` (ThemedComponent,
       `getFindWidgetStyles`; сессия в ЛОКАЛЬНОМ слое группы,
       `attachHost(EditorGroupElement)` — зовёт AppController). Экшены
       Find*/Suggest* (+`triggerSuggest` из WhitespaceActions) — в
       `Workbench/Actions/` с реальными `run(accessor)`; регистрируются хвостом
       `builtinActions` (биндинги `*WidgetVisible` должны победить
       editor-команды). Тесты → `Services/CompletionService.test.ts` /
       `Services/FindService.test.ts`; биндинги — `Modules/WorkbenchModule.ts`
- [x] 11. `MenuService`+`MenuBarComponent`, `LayoutService`, `WorkbenchStateService`, ContextKeys:
       `MenuService` (декларативная модель главного меню из command-id; шорткаты —
       `KeybindingRegistry.getKeybindingForCommand`, строится ПОСЛЕ user keybindings) +
       `MenuBarComponent` (`Components/Shell/`; владеет `MenuBarElement`,
       `view.id="menuBar"`, исполнение — `CommandRegistry`, стили — `getMenuStyles`);
       `LayoutService` (сайдбар: видимость/ширина/toggle/nudge/reset; панель —
       истина в `PanelService`, layout и ключ `panelVisible` следуют за
       `onDidChangeVisibility`; персист layout'а поверх StateService c
       restore/capture + write-through `onDidChangeLayout`; сам
       `WorkbenchLayoutElement` — у AppController, шов `attachLayout`);
       `WorkbenchStateController` → `Services/WorkbenchStateService.ts` (только
       открытые редакторы + `openWorkspace`; write-through-подписка на
       `onActiveEditorChanged` — внутри сервиса); `WorkbenchContextKeys`
       (updateContextKeys/handleFocusChange из AppController: фокус из FocusManager
       корневой view через шов `attachView`, ключи Editor/Find/Suggest/Terminal/env;
       замыкает хук `KeybindingDispatcher.updateContextKeys`);
       `StateServiceDIToken` переехал в `Workbench/Services/CoreTokens.ts`.
       Каталог `Controllers/Actions/` растворён ЦЕЛИКОМ в `Workbench/Actions/`
       (git mv; `FileActions` слиты, save/saveAs/newUntitled получили реальные
       `run(accessor)` — раньше их перекрывал AppController; Preferences — реальные
       run поверх `SettingsResource`/`KeybindingsResource`; About — экшен); список
       `builtinActions` — `Workbench/Actions/builtinActions.ts`; новые
       `LayoutActions.ts` (toggle sidebar/panel, show explorer/problems, reveal,
       width-команды) и `TerminalActions.ts` (toggle/new terminal) вместо
       inline-registerAction в AppController. AppController: 1267 → ~430 строк
       (скорлупа: Body/Layout + вставка view + attach-швы + bootstrap + quit)
- [x] 12. Финал: `WorkbenchComponent`, Modules → Workbench, смерть `src/Controllers/`:
       AppController → `Workbench/Components/Shell/WorkbenchComponent.ts` (наследник
       `ThemedComponent`: `applyTheme` → `updateStyles`, `view.id="workbench"`; публичный
       bootstrap-API mount/activate/openFile/setWorkspaceFolder/restoreOpenEditors/
       getOpenEditorsToRestore/fileIndexReady/focusEditor/requestQuit сохранён — его ведёт
       `main.ts`); `Controllers/Modules/` → `Workbench/Modules/` (git mv; `controllersModule`
       растворён — `WorkbenchComponentDIToken` биндит `workbenchModule`, шов
       `IWorkspaceFolderOpener` замкнут на `WorkbenchComponent`); `IController` умер
       (у компонентов контракта lifecycle нет — у корня он собственный); тесты
       `AppController.*.test.ts` → `Workbench/Components/Shell/Workbench.*.test.ts`
       (git mv, сценарии 1:1; обвязка — `WorkbenchComponentDIToken`, `h.workbench`),
       `TerminalEnvironmentIntegration.test.ts` → `Workbench/Services/TerminalEnvironment/`;
       `main.ts` и `AppTestHarness` — на `WorkbenchComponentDIToken`
- [x] 13. Зачистка + документация: остаточные `*Controller*`-упоминания вычищены из
       src/ и docs/ (fixture-имена в тестах переименованы; исторические записи в этом
       файле и changelog-подобных оставлены); `docs/arch/Controllers.md` удалён — живое
       содержимое (конвенции системы команд, паттерн Service/Component/Element/State)
       переехало в arch/Workbench.md; ARCHITECTURE.md — финальная схема слоёв без
       Controllers (переходное правило снято), DI-границы — Workbench и App; DI.md —
       модули по новым путям; TESTING.md/AGENTS.md обновлены

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

Мост тема→стили — `src/vs/platform/theme/browser/defaultStyles.ts`: по функции `getXxxStyles(theme)` на
контрол; единственная точка знания «ключ темы → поле стиля». Раздача пуш-моделью: компонент
подписан на смену темы (`ThemedComponent.updateStyles()`) и заново вызывает `control.setStyles(...)`.

База компонентов — `src/vs/workbench/Component.ts`:

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
