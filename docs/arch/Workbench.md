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
  `KeybindingRegistry`, `ContextKeyService`, `ContextKeys`), `StateKeys`,
  `ModifierReleaseArmory`, `ChokidarFileWatcher` + `IFileWatcherDIToken`,
  `FileSearchService`, `QuickOpenParsing`, `collectWordCompletions`, `CoreTokens`,
  каталоги `Workspace/` (undo/redo; `TrashService`/`WorkspaceEditService` пока в
  Controllers), `TerminalEnvironment/`, `Terminal/` (EmbeddedTerminalSession, фабрика,
  загрузчик node-pty), `Diagnostics/`.
- `Components/` — появится начиная с пилота `StatusBarComponent` (этап 4).

Зависимости слоя: Workbench → { Editor, TUIDom, Theme, Configuration, Common,
интерфейс Backend }. Переходное правило: Controllers временно **над** Workbench
(импортирует его), по завершении миграции будет растворён.
