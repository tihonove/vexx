
# Prompts for Copilot — Vexx UI Fixes

Each section is a standalone prompt. Pass them individually.

---

## Prompt 1 — Tab не должен двигать фокус в редакторе

**Контекст:**
В `src/TUIDom/TuiApplication.ts` (строка ~83) обработчик по умолчанию: если клавиша `Tab` не была отменена (`event.preventDefault()`), `FocusManager.cycleFocus()` переключает фокус между элементами. `EditorElement` (`src/Editor/EditorElement.ts`) сейчас не вызывает `event.preventDefault()` при нажатии Tab, поэтому нажатие Tab в редакторе уводит фокус из редактора вместо того, чтобы вставить символ табуляции.

**Что сделать:**
Добавить обработку клавиши `Tab` в `EditorElement`: вставлять символ табуляции (или пробелы, если настроен soft-indent) и вызывать `event.preventDefault()`, чтобы `TuiApplication` не переключал фокус. Аналогично обработать `Shift+Tab` (backtab) — он тоже не должен уводить фокус из редактора.

**Тесты:**
Добавить тесты в `src/Editor/` (новый файл `EditorElement.Tab.test.ts` или расширить существующий). Покрыть:
- Нажатие Tab в редакторе вставляет `\t` (или пробелы) в текущей позиции курсора и не изменяет фокус.
- Нажатие Tab не вызывает `cycleFocus` (можно проверить через мок или через то, что фокус остался на редакторе).
- Shift+Tab тоже не уводит фокус.

---

## Prompt 2 — Кнопка скрытия дерева файлов

**Контекст:**
`WorkbenchLayoutElement` (`src/TUIDom/Widgets/WorkbenchLayoutElement.ts`) имеет методы `setLeftPanelVisible(bool)` и `getLeftPanelVisible()`. В данный момент нет кнопки для переключения видимости панели файлов.

`TitledPanelElement` (`src/TUIDom/Widgets/TitledPanelElement.ts`) отображает заголовок (`"  EXPLORER"`) и дочерний элемент, но не поддерживает кнопки в заголовке.

Собирается в `src/Controllers/FileTreeController.ts` и `src/Controllers/AppController.ts`.

**Что сделать:**
Добавить кнопку «закрыть/скрыть» (иконка `×` или стрелка `‹`) в правой части заголовка панели `TitledPanelElement`. По нажатию кнопки вызывать `WorkbenchLayoutElement.setLeftPanelVisible(false)` и вызывать `markDirty()`. Кнопку показывать только когда панель видима. Можно также добавить биндинг (например `Ctrl+B`) для удобства.

**Тесты:**
- Добавить/расширить тесты в `src/TUIDom/Widgets/WorkbenchLayoutElement.test.ts` — тест что панель скрывается после toggle.
- Добавить тест на `TitledPanelElement` что кнопка рендерится в заголовке.
- Добавить тест в `src/Controllers/AppController.FileTree.test.ts` или новый файл — тест что действие/клик меняет видимость файлового дерева.

---

## Prompt 3 — Верстка QuickPick прилипла к правому краю

**Контекст:**
`ContextMenuLayer.performLayout` (`src/TUIDom/Widgets/ContextMenuLayer.ts`) передаёт элементу `BoxConstraints.loose(availableSize)`, где `availableWidth = layerSize.width - item.position.x`.

`QuickPickElement.performLayout` (`src/TUIDom/Widgets/QuickPickElement.ts`) берёт `constraints.maxWidth` как ширину напрямую:
```ts
const width = Number.isFinite(constraints.maxWidth)
    ? Math.max(constraints.minWidth, constraints.maxWidth)  // ← берёт всё доступное место
    : Math.max(constraints.minWidth, 60);
```

В результате QuickPick занимает всё пространство от своей позиции до правого края экрана, вместо того чтобы использовать свою «желаемую» ширину (как задано в `updatePosition` в `src/Controllers/QuickOpenController.ts` через `pickerW`).

**Что сделать:**
Исправить `QuickPickElement.performLayout` так, чтобы при loose-ограничении элемент использовал желаемую/натуральную ширину (не больше `maxWidth`, но и не обязательно равную ему). Либо `QuickOpenController.updatePosition` должен задавать tight-ограничение, явно устанавливая размер элемента перед layout. В итоге QuickPick должен рендериться по центру экрана с заданной шириной, а не растягиваться до правого края.

**Тесты:**
Добавить/расширить тесты в `src/TUIDom/Widgets/QuickPickElement.Render.test.ts`:
- При loose-ограничении `QuickPickElement` не занимает полную ширину, а использует разумную «желаемую» ширину.
- Тест в `src/Controllers/QuickOpenController.test.ts`: после `updatePosition` QuickPick занимает правильную центрированную позицию и ширину.

---

## Prompt 4 — Padding в диалоговом окне прозрачный

**Контекст:**
`PaddingContainerElement.render` (`src/TUIDom/Widgets/PaddingContainerElement.ts`) заполняет padding-ячейки с помощью `this.resolvedStyle.bg`. Если у `PaddingContainerElement` нет явного `style.bg`, он наследует цвет фона от родителя через `resolveStyle`. Если цепочка наследования не заполнена или цвет оказывается `DEFAULT_COLOR` (прозрачный терминал), padding выглядит прозрачным.

В `ConfirmSaveDialogElement` (`src/TUIDom/Widgets/ConfirmSaveDialogElement.tsx`) внутри `BoxContainer` (который имеет `bg={BG}`) используется `PaddingContainer`, который должен был бы унаследовать фон. На практике padding прозрачный.

**Что сделать:**
Убедиться, что `PaddingContainerElement` рендерит padding-ячейки с правильным непрозрачным фоном. Нужно либо:
- передавать явный `bg` в `PaddingContainer` в `ConfirmSaveDialogElement`, или
- исправить наследование стилей в `PaddingContainerElement` так, чтобы `resolvedStyle.bg` корректно подхватывал фон родителя.

**Тесты:**
Добавить тест в `src/TUIDom/Widgets/PaddingContainerElement.test.ts`:
- `PaddingContainerElement` с явным `bg` рендерит padding-ячейки с этим цветом, а не прозрачным.
Добавить тест для `ConfirmSaveDialogElement` что рендер не содержит прозрачных ячеек в области padding.

---

## Prompt 5 — Кнопка фокуса на дереве файлов

**Контекст:**
`FileTreeController` (`src/Controllers/FileTreeController.ts`) имеет метод `focus()`, который вызывает `this.tree?.focus()`. Нет UI-кнопки для перехода фокуса в дерево файлов.

`TitledPanelElement` (`src/TUIDom/Widgets/TitledPanelElement.ts`) отображает заголовок панели. `WorkbenchLayoutElement` содержит левую панель.

Собирается в `src/Controllers/AppController.ts`, где есть доступ к `fileTreeController` и `workbenchLayout`.

**Что сделать:**
Добавить возможность перефокусироваться на дерево файлов: кнопку в заголовке панели (например, иконка папки или стрелка) и/или зарегистрировать команду/keybinding (например `Ctrl+Shift+E` как в VS Code). По нажатию вызывать `FileTreeController.focus()` и при необходимости `setLeftPanelVisible(true)`.

**Тесты:**
- Тест в `src/Controllers/AppController.FileTree.test.ts` или новый файл: действие фокусировки файлового дерева делает `fileTreeController.view` (или `tree`) сфокусированным.
- Если добавляется keybinding: тест что keybinding зарегистрирован и вызывает правильную команду.

---

## Prompt 6 — Иконка изменённости на табе не перерисовывается

**Контекст:**
`EditorGroupController.syncTabs()` (`src/Controllers/EditorGroupController.ts`) вызывается только при открытии, закрытии или переключении таба. Когда пользователь редактирует документ, `EditorController.isModified` (который проверяет `this.doc.versionId !== this.savedVersionId`) меняет своё значение, но `syncTabs()` не вызывается — иконка `●` на табе не появляется.

`TextDocument` (`src/Editor/TextDocument.ts`) имеет метод `onDidChangeContent(listener)` который возвращает `IDisposable` — через него можно подписаться на изменения документа.

`EditorGroupController` создаёт и открывает `EditorController`-ы. После `openFile()` и `activateTab()` вызывает `syncTabs()`, но не подписывается на изменение документа.

**Что сделать:**
При открытии файла в `EditorController` (или в `EditorGroupController` при добавлении эдитора) подписаться на `doc.onDidChangeContent(...)`. В колбэке вызывать `syncTabs()` (или аналогичный механизм уведомления). После сохранения файла (`EditorController.save()`) также вызывать `syncTabs()`, чтобы иконка исчезла.

**Тесты:**
Расширить тесты в `src/Controllers/EditorGroupController.test.ts`:
- После открытия файла и внесения изменений в документ (`doc.insert(...)` или через `EditorViewState`) таб должен содержать `isModified = true` — проверить через `tabStrip.tabs[i].isModified` или через рендер.
- После сохранения `isModified` становится `false` и таб обновляется.

---

## Prompt 7 — Паддинги на табе как в NvChad

**Контекст:**
`EditorTabItemElement` (`src/TUIDom/Widgets/EditorTabItemElement.ts`) имеет `paddingLeft` и `paddingRight` (по умолчанию `1`). В NvChad табы имеют более широкий padding (≈2–3 с каждой стороны) — это визуально разделяет табы и делает интерфейс просторнее.

Табы создаются в `EditorTabStripElement` (`src/TUIDom/Widgets/EditorTabStripElement.ts`).

**Что сделать:**
Увеличить `paddingLeft` и `paddingRight` у табов. Ориентировочные значения: `paddingLeft = 2`, `paddingRight = 2` (финальные значения — на усмотрение агента, должно выглядеть как в NvChad). Изменения применять в `EditorTabStripElement` там, где создаются `EditorTabItemElement`.

**Тесты:**
Обновить/добавить тесты в `src/TUIDom/Widgets/EditorTabItemElement.test.ts` и `src/TUIDom/Widgets/EditorTabStripElement.test.ts`:
- Таб имеет корректный `paddingLeft` / `paddingRight`.
- Ширина таба (`getMinIntrinsicWidth`) соответствует увеличенному padding.

---

## Prompt 8 — Паддинг в MenuBar для выравнивания с Explorer

**Контекст:**
`MenuBarItemElement` (`src/TUIDom/Widgets/MenuBarItemElement.tsx`) рендерит метку как `` ` ${label} ` `` (1 пробел с каждой стороны) и начинается с колонки 0.

`FileTreeController` (`src/Controllers/FileTreeController.ts`) создаёт заголовок `"  EXPLORER"` (2 пробела в начале, через `TitledPanelElement` с `titlePaddingLeft=1`). Визуально первый пункт меню не совпадает по горизонтали с текстом Explorer.

`MenuBarElement` (`src/TUIDom/Widgets/MenuBarElement.ts`) использует `HFlexElement` для раскладки пунктов; первый пункт начинается с x=0.

**Что сделать:**
Добавить отступ в начале `MenuBarElement` (или `MenuBarFillerElement` в начале) так, чтобы первый пункт меню визуально выравнивался с заголовком `"  EXPLORER"`. Например, добавить spacer с шириной 1 в начало `HFlexElement` в `MenuBarElement`.

**Тесты:**
Добавить тест в `src/TUIDom/Widgets/MenuBarElement.test.ts`:
- Первый пункт меню в рендере начинается не с x=0, а с отступом (соответствующим выравниванию с Explorer).

---

## Prompt 9 — Отступ справа от shortcuts в popup-меню

**Контекст:**
В `PopupMenuItemElement` (`src/TUIDom/Widgets/PopupMenuItemElement.tsx`) при наличии `shortcut` элемент рендерится так:
```
│ [icon] label ...fill...   Ctrl+K │
```
После текста шортката нет правого отступа — он «прилипает» к правой границе меню. При `!hasShortcuts` добавляется trailing space: `<TextLabel text=" " ...>`, но при наличии шортката эта логика не срабатывает.

Ширина меню вычисляется в `PopupMenuElement.getIntrinsicSize()` через `vstack.getMaxIntrinsicWidth(...)` + 2 (границы). Поэтому добавление пробела в элемент автоматически увеличит ширину меню — это ожидаемое поведение.

**Что сделать:**
Добавить 1 пробел правого отступа после shortcut-текста в `PopupMenuItemElement.describe()`. Убедиться, что trailing-пробел добавляется всегда, когда есть shortcuts (не только когда нет).

**Тесты:**
Добавить/расширить тесты в `src/TUIDom/Widgets/PopupMenuItemElement.test.tsx`:
- При наличии `shortcut` последняя ячейка строки (перед правой границей `│`) содержит пробел, а не последний символ шортката.
- При отсутствии `shortcut` trailing-пробел по-прежнему присутствует (существующее поведение не сломано).
