# TUIDom/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

TUI-фреймворк — дерево элементов с layout, событиями, фокусом (аналог браузерного DOM). Layout и позиционирование — в [../LAYOUT.md](../LAYOUT.md).

**Инвариант: контролы — «вещь в себе».** TUIDom не импортирует Theme и не знает других app-концепций — слой переиспользуем в другом приложении как есть. Цвета контрол получает через plain color-props (поля или объект вроде `MenuColors`) с theme-less дефолтами; маппинг активной темы в эти props делает владелец (см. [Theme.md](Theme.md), [Workbench.md](Workbench.md)). App-специфичные виджеты здесь не живут — они собираются из контролов на слое Workbench (пример: диалоги поверх `FitContentElement` — примитива «размер по содержимому» для окон в overlay).

`RenderContext` инкапсулирует то, что виджеты не обязаны знать: рендеринг wide chars (`drawText` через `DisplayLine` — без ручной возни с grapheme-слотами) и рамки (`drawBox` — углы/линии одним вызовом, `fill`, `separators`, пресеты из `BorderStyle.ts`, канон — `BORDER_ROUNDED`). Все бордер-виджеты рисуют рамку через него — единый стиль, без дублированных циклов.

Подсистемы: **Events** (capture/bubble, клавиатура/фокус, менеджер фокуса с tab-навигацией, default actions), **Styles** (наследование `fg`/`bg` от родителя, sentinel `INHERITED_*`, dirty-пропагация + top-down резолвинг; компонент-специфичные стили через generic `TUIElement<S extends TUIStyle>`), **Widgets** (боксы с рамкой, стек, word-wrap текст, скролл, меню, `CompletionListElement` и др.).

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
`TerminalViewElement` — лист-виджет встроенного терминала: каждый кадр читает абстрактную сетку ячеек через `ITerminalSurface` (`readCell`/`getCursor`) и блитит её в grid. Виджет **чистый** — он ничего не знает про PTY и VT-эмулятор: реальная связка (node-pty + `@xterm/headless`) реализует `ITerminalSurface` уровнем выше, в Controllers (`EmbeddedTerminalSession`), поэтому под `src/TUIDom/` не протекают импорты `@xterm/headless`/`node-pty`, а виджет тестируется скриптованным `FakeTerminalSurface`. Размером PTY управляет `performLayout` (реально выделенная область → `surface.resize`, TIOCSWINSZ+SIGWINCH), ввод пробрасывает в поверхность через чистую функцию `encodeKeyForPty` (клавиша → байты, которые ждёт PTY), мышь — через `sendMouse`. Цвета «по умолчанию» (`defaultFg`/`defaultBg`) пушит контроллер из активной темы. `TUIElement` не имеет lifecycle-хука, поэтому подписки на поверхность виджет держит сам и рвёт в `dispose()` (владелец — `TerminalController` — обязан его вызвать). Оркестрация и упаковка → [Controllers.md](Controllers.md), [../TODO/IntegratedTerminal.md](../TODO/IntegratedTerminal.md).
