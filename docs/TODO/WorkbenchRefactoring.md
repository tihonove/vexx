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
       в Controllers остались `TrashService`/`WorkspaceEditService` — тянут `Actions/fileClipboardFs.ts` —
       и `TerminalEnvironmentIntegration.test.ts` — тянет `StatusBarController`)
- [ ] 4. Пилот: `StatusBarService` + `StatusBarComponent` (эталонная пара)
- [ ] 5. Вынос из AppController: `KeybindingDispatcher`, `DialogService`, `LifecycleService`
- [ ] 6. Panel-кластер: `DiagnosticsService`, `PanelService`+`PanelComponent`,
       `ProblemsComponent`, `TerminalService`+`TerminalPanelComponent`
- [ ] 7. Explorer: `ExplorerService`+`ExplorerComponent`+`InputWidgetComponent`,
       `FileOperationsService`
- [ ] 8. `QuickInputService`+`QuickInputComponent`, `QuickOpenService`, пикеры → Actions
- [ ] 9. Editor: `TextFileModel`+`EditorComponent`; `EditorService`+`EditorGroupComponent`
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
