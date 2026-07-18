# Workbench/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Слой компонентов приложения (аналог vscode workbench: `vs/workbench/browser/parts/*`). Здесь живёт модель **Service ↔ Component** — целевой паттерн для всего UI поверх контролов TUIDom.

## Модель Service ↔ Component

- **Service** — app-логика без view: обычный класс (часто `extends Disposable`), регистрируется в DI, публикует состояние и события. Пример: `Dialogs/DialogService.ts` (аналог vscode `IDialogService`).
- **Component** — владеет view; получает сервисы **в конструктор** и общается только с ними. Компонент **компонует** контролы TUIDom (размещает их, как DOM-узлы), но **не встраивается в их жизненный цикл** — не наследует `TUIElement`; корневой контрол доступен как `component.view`.

Правило-инвариант: *есть `view` → Component; нет `view` → Service.* Существующие view-контроллеры в `src/Controllers/` — структурно уже компоненты (`IController` совпадает с `IComponent`); они мигрируют сюда постепенно, без изменения контракта.

## База `Component` и контракт `IComponent`

`IComponent` (`IComponent.ts`): `view: TUIElement` + `mount()` / `activate()` / `dispose()` — то же, что `Controllers/IController.ts` (осознанный структурный дубль, без импорта между слоями).

`Component` (`Component.ts`, аналог vscode `Component`/`Themable`):
- конструктор принимает `ThemeService`; `mount()` подписывается на `onThemeChange` (подписка сразу отдаёт текущую тему → начальная покраска происходит в mount);
- хук `applyStyles(theme)` — единственное место, где компонент пушит цвета темы в **plain color-props** контролов (контролы про темы не знают);
- наследники, переопределяющие `mount`/`activate`, обязаны звать `super.mount()`/`super.activate()`;
- подписки — через `this.register(...)` (LIFO-очистка в `dispose`).

## Идентичность в DOM-дереве

У компонента нет имени класса в дереве элементов (в дереве — его корневой контрол), поэтому компонент вешает на корень `view.id` (`querySelector("#confirmSaveDialog")`) — DOM-идентичность для тестов и инспектора.

## Текущие обитатели

- **`StatusBar/StatusBarComponent.ts`** — статус-бар: потребляет `EditorGroupController`, `ThemeService`, `TerminalEnvironmentService`, `ILanguageService`, `CommandRegistry`; view — чистый контрол `StatusBarElement` (айтемы + `onClick`-колбэки). Эталон оси «Component потребляет сервисы».
- **`Dialogs/`** — модальные диалоги: `DialogService` (оркестрация: overlay-сессии, центрирование, lifecycle компонентов) + `AboutDialog` / `ConfirmDialog` / `ConfirmSaveDialog` поверх общей базы `DialogComponent` (reconcile-перестройка JSX-дерева, покраска ряда кнопок, стрелки/Escape). Корневой контрол — `FitContentElement` (примитив «размер по содержимому» в TUIDom). Эталон оси «Component компонует контролы без наследования TUIElement».

## Зависимости

`Workbench → { Controllers (сервисы), Editor, Theme, TUIDom, Common }`. DI-токены объявлять можно (граница расширена: Controllers + Workbench + App, см. [../DI.md](../DI.md)).

Переходные исключения (до завершения распила `AppController`):
- `AppController` (корневой оркестратор в Controllers) импортирует Workbench-компоненты (`StatusBarComponent`, `DialogService`) — уйдёт вместе с его распилом;
- `Controllers/Modules/` (composition root DI) биндит классы Workbench.

## Как мигрировать view-контроллер (чек-лист)

1. Перенести файл в `src/Workbench/<Area>/<Name>Component.ts`, базу сменить на `Component`.
2. Подписку на тему из конструктора убрать; тело `applyTheme` → `protected override applyStyles`.
3. `mount()` → `override` с `super.mount()` первой строкой.
4. DI-токен `<Name>ComponentDIToken` объявить рядом с классом; биндинг — в `Controllers/Modules/`.
5. Если контрол view имел `applyTheme(WorkbenchTheme)` — выпилить: контрол несёт color-props, маппинг из темы — в `applyStyles` (хелперы `applyXxxTheme`, см. [Theme.md](Theme.md)).
