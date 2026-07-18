# TUIDom/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

TUI-фреймворк — дерево элементов с layout, событиями, фокусом (аналог браузерного DOM). Layout и позиционирование — в [../LAYOUT.md](../LAYOUT.md).

`RenderContext` инкапсулирует то, что виджеты не обязаны знать: рендеринг wide chars (`drawText` через `DisplayLine` — без ручной возни с grapheme-слотами) и рамки (`drawBox` — углы/линии одним вызовом, `fill`, `separators`, пресеты из `BorderStyle.ts`, канон — `BORDER_ROUNDED`). Все бордер-виджеты рисуют рамку через него — единый стиль, без дублированных циклов.

Подсистемы: **Events** (capture/bubble, клавиатура/фокус, менеджер фокуса с tab-навигацией, default actions), **Styles** (наследование `fg`/`bg` от родителя, sentinel `INHERITED_*`, dirty-пропагация + top-down резолвинг; компонент-специфичные стили через generic `TUIElement<S extends TUIStyle>`), **Widgets** (боксы с рамкой, стек, word-wrap текст, скролл, меню, `CompletionListElement`, `FitContentElement` — контейнер «размер по содержимому» под loose-constraints overlay-слоя, типовой корень диалогов/поповеров, `SizedBoxElement` — контейнер фиксированного «предпочтительного» размера (клампится к constraints), корень overlay-виджетов фиксированной ширины (find), и др.).

Диалоги приложения (`ConfirmDialog`/`ConfirmSaveDialog`/`AboutDialog`) — **не** виджеты TUIDom: они живут компонентами в `Workbench/Components/Dialogs/` (владеют `FitContentElement` и собирают в нём дерево примитивов), см. [Workbench.md](Workbench.md).

## OverlayLayer + pointerPolicy (инвариант)
`OverlayLayer` — overlay-менеджер с session API (`createSession`/`openPopupSession`): единый lifecycle popup/dialog/quick-open, политики закрытия, restore-focus, якорное позиционирование с clamp/flip по экрану.

**`pointerPolicy` — обязательное поле сессии** (пропуск = ошибка компиляции, дефолта нет). Закручивает инвариант «окно либо закрывается по клику снаружи, либо не пропускает клики позади себя». Три варианта:
- `"close-on-outside"` — клик мимо закрывает сессию, но доходит до элемента позади (контекст-меню, Quick Open).
- `"modal"` — клик мимо **блокируется** (`elementFromPoint` отдаёт сам модал), Tab-фокус заперт focus-scope'ом в `FocusManager`. Диалог несохранённых изменений.
- `"passthrough"` — клик проходит насквозь, сессия не закрывается через OverlayLayer (Find, дропдаун меню-бара).

## Default Actions (модель Web DOM)
У каждого элемента есть встроенное поведение (`performDefaultAction`), отделённое от клиентских listeners. Порядок обработки: capture → target → bubble → **default action на target-элементе**. Правила, которые нельзя вывести из кода за секунду:
- `preventDefault()` (на любой фазе) **отменяет** default action; `stopPropagation()` — **не** отменяет.
- `performDefaultAction` вызывается **только на `event.target`**, не на всей цепочке propagation.
- Default action — то, что клиент может захотеть отменить (открытие подменю, навигация клавишами). НЕ default action — internal state (сохранение `previousFocusedElement`, деактивация при blur).

**Готча «click → callback»:** когда target события — внутренний дочерний элемент (hit-test попал в `TextLabelElement` внутри `MenuBarItemElement`), полагаться на `performDefaultAction` родителя нельзя — используй bubble-listener с проверкой `defaultPrevented`.

## Terminal-виджет (`Widgets/Terminal/`)
`TerminalViewElement` — лист-виджет встроенного терминала: каждый кадр читает абстрактную сетку ячеек через `ITerminalSurface` (`readCell`/`getCursor`) и блитит её в grid. Виджет **чистый** — он ничего не знает про PTY и VT-эмулятор: реальная связка (node-pty + `@xterm/headless`) реализует `ITerminalSurface` уровнем выше, в Workbench (`EmbeddedTerminalSession`), поэтому под `src/TUIDom/` не протекают импорты `@xterm/headless`/`node-pty`, а виджет тестируется скриптованным `FakeTerminalSurface`. Размером PTY управляет `performLayout` (реально выделенная область → `surface.resize`, TIOCSWINSZ+SIGWINCH), ввод пробрасывает в поверхность через чистую функцию `encodeKeyForPty` (клавиша → байты, которые ждёт PTY), мышь — через `sendMouse`. Цвета «по умолчанию» (`defaultFg`/`defaultBg`) пушит владелец-компонент из активной темы. `TUIElement` не имеет lifecycle-хука, поэтому подписки на поверхность виджет держит сам и рвёт в `dispose()` (владелец — `TerminalPanelComponent` — обязан его вызвать). Оркестрация и упаковка → [Workbench.md](Workbench.md), [../TODO/IntegratedTerminal.md](../TODO/IntegratedTerminal.md).
