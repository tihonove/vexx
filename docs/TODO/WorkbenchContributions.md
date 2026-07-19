# Workbench contribution points — сближение с vscode

Перенос vscode-паттерна «declarative contribution points» (реестры, куда фичи
кладут себя декларативно). Уже сделано:
- **`IWorkbenchContribution` + реестр фаз** (#164) — code-contributions (event-проводка).
- **`MenuRegistry` + `MenuId`** (#166) — declarative menu-contributions для контекст-меню
  (редактор, Explorer).

Ниже — follow-up'ы, где наша реализация — сознательное подмножество vscode, и куда
двигаться при желании сблизиться с каноном. Источник сверки —
`vscode/src/vs/platform/actions/common/actions.ts` + `menuService.ts`.

## MenuRegistry → vscode-канон (по убыванию ценности)

- [ ] **Меню-бар на `MenuRegistry`.** Сейчас `MenuService.getMenus()` хардкодит дерево
  File/Edit/Selection/View/Go/Help. Перевести на реестр; для этого нужны:
  - **submenus** (`ISubmenuItem` в vscode) — пункт, открывающий вложенный `MenuId`
    (меню-бар = набор submenu-точек `MenubarFileMenu`/`MenubarEditMenu`/…);
  - спец-группа **`navigation` сортируется первой** (у vscode `_compareMenuItems`:
    navigation → потом `localeCompare` группы → order). Сейчас у нас обычный
    `localeCompare` без спец-группы.
  Риск: тесный golden-master `Workbench.Menu.test.ts` (точный порядок/лейблы/мнемоники).

- [ ] **Co-location placement на команде (`registerAction2`-аналог).** У нас пункт ссылается
  на команду по **id** + опциональный override-`title`; в vscode пункт несёт
  `command: ICommandAction` (id + title + icon + precondition + toggled), а идиоматичный
  путь — `registerAction2`, кладущий команду+keybinding+**menu placement** одним классом
  (`appendMenuItems` даже `@deprecated`). У нас placement живёт в отдельном массиве
  `MENU_CONTRIBUTIONS` — осознанный дивёрж под нашу конвенцию явных массивов. Сближение:
  дать `CommandAction` опциональные menu-placement'ы, из которых наполнять `MenuRegistry`.
  Побочно уберёт дубль явных лейблов Explorer (сейчас нужны, т.к. title команд «File: …»,
  а меню показывает «Copy»).

- [ ] **Живой `IMenu` вместо одноразового `getMenuItems`.** У vscode реестр (данные) отделён
  от `IMenuService.createMenu(id, contextKeyService) → IMenu`; `IMenu.getActions()` отдаёт
  `[group, actions][]` и **переэмитит** при смене контекста/реестра (`onDidChangeMenu`).
  У нас `getMenuItems(menuId, context)` — чистая функция, собирается заново при каждом
  открытии. Нужно только если меню должно перестраиваться на лету (тулбары/видимые меню),
  а не при повторном открытии контекст-меню — низкий приоритет.

- [ ] Мелочи vscode, которых нет: `alt` (альтернативный пункт по Alt), user hide-toggle
  пунктов (`isHiddenByDefault` + скрытие пользователем), `MenuId` как расширяемый класс
  (у нас закрытый const-набор — расширениям своих точек не завести).

## Другие contribution points (не начаты)

- [ ] **`QuickAccessRegistry`** — провайдеры Quick Open саморегистрируются по префиксу
  (`>` команды, `:` goto-line, будущие `@`/`#`). Сейчас — жёсткий `if startsWith(">")`
  в `QuickOpenService`.
- [ ] **`ConfigurationRegistry`** — фичи регистрируют свою схему настроек (сейчас
  генерённый `settings-schema` + хардкод дефолтов).
- [ ] **`ColorRegistry`** — `registerColor(id, defaults, desc)`, цвета саморегистрируются
  (сейчас центральный `IWorkbenchColors` + `defaultColors.ts`).
