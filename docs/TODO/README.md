
# Vexx — TODO

Трекер задач проекта. Каждая задача имеет статус, краткое описание и контекст.

Статусы: `[ ]` — открыта, `[~]` — в работе, `[x]` — сделана.

---

## Визуальный ориентир

### NVChad — референс для UI/UX
Проект: https://github.com/NvChad/NvChad

NVChad — конфигурация Neovim с красивым UI, быстрым рендерингом и продуманной визуальной частью. Ориентируемся на него в плане:
- **Внешний вид**: цветовые темы (base46), statusline, tabufline, общая эстетика
- **Иконки**: nvim-web-devicons — файловые иконки, иконки типов файлов в дереве и табах
- **Рендеринг UI-элементов**: telescope (fuzzy finder с превью), nvim-tree (файловое дерево), cheatsheets
- **Цветовые схемы**: onedark и другие темы из base46 как отправная точка для палитры

Ключевые плагины NVChad для вдохновения:
- [base46](https://github.com/NvChad/base46) — темы и подсветка
- [NvChad UI](https://github.com/NvChad/ui) — statusline, tabufline, theme switcher
- [nvim-web-devicons](https://github.com/kyazdani42/nvim-web-devicons) — иконки файлов
- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) — поиск файлов с превью
- [nvim-tree.lua](https://github.com/kyazdani42/nvim-tree.lua) — файловое дерево

---

## Крупные задачи

- [x] Система команд редактора — сделана, см. ARCHITECTURE.md → Controllers
- [~] [WhenContext](WhenContext.md) — система контекста when (остался полноценный парсер when-выражений)
- [~] [SyntaxHighlighting](SyntaxHighlighting.md) — подсветка синтаксиса (TextMate готов; далее scope-селекторы, async/background токенизация)
- [ ] [PieceTree](PieceTree.md) — текстовый бэкенд документа (большие файлы, undo, snapshots)
- [~] [Extensions](Extensions.md) — VS Code-совместимые расширения (Phases 1, 8 готовы; 6, 9 частично; в работе — active-editor API)
- [~] [E2E](E2E.md) — e2e тесты против SEA-бинаря (Phase 1 готова)
- [ ] [Inspector](Inspector.md) — рефакторинг TUIElement-иерархии + основа приложения → inspector-протокол (`--inspect-tui`) для e2e
- [~] [Logging](Logging.md) — единый ILogService + RingBufferSink/FileSink (Phases 1–3.5 готовы); далее Output UI, CLI flags, vscode API
- [~] [FileTreePerformance](FileTreePerformance.md) — производительность больших файловых деревьев (диагностика + бенчмарки готовы; фиксы — далее)

---

## Баги / недоделки

### [x] В инпутах приложения нет выделения и буфера обмена
Экшены `inputSelectLeft/Right/ToHome/ToEnd/WordLeft/WordRight/All` и
`inputCopy/inputCut/inputPaste` зарегистрированы в `AppController.builtinActions`
(под `when: "inputWidgetFocus"`), поэтому в реальных инпутах (QuickOpen) работают
Shift-выделение и Ctrl+C/X/V. Дополнительно добавлены Undo/Redo (`input.undo`/`input.redo`,
Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) на базе истории снапшотов в `InputState`. Покрыто
интеграционным тестом `AppController.Input.test.ts` через `TestApp`.

---

## Unicode и отображение символов

### [x] #7 Корректное отображение wide chars, табов и спецсимволов
Сделано (Phases 1–6): `DisplayLine` (`src/Common/DisplayLine.ts`) — графемная сегментация, tab expansion, offset↔column; ширины wide chars в `Cell`/`Grid`/`TerminalRenderer`; рендеринг и навигация через `DisplayLine` в `EditorElement`, `EditorViewState` и виджетах (`TextLabelElement`, `TextBlockElement`, `TreeViewElement` и др.). Детали: ARCHITECTURE.md → Common.

---

## События и скролл

### [ ] #5 Пересчёт координат событий мыши в ScrollableElement
Сейчас `ScrollableElement` не корректирует `localX`/`localY` событий мыши с учётом `scrollTop`/`scrollLeft`. Потребители вынуждены вручную пересчитывать координаты (пример — `WASDScrollableElement`, строки 40–41). Нужно разобраться:
- Должен ли `ScrollableElement` автоматически транслировать координаты мыши в контентные координаты (аналогично CSS overflow scroll в браузере)?
- Или ввести хелпер / дополнительное свойство `contentX`/`contentY` в событии?
- Учесть, что `renderViewport` уже работает в терминах `viewport.scrollTop`/`scrollLeft` — координаты рендера и событий должны быть согласованы.

Файлы: `src/TUIDom/Widgets/ScrollableElement.ts`, `src/demos/WASDScrollableElement.ts`, `src/TUIDom/Events/`

---

## Layout

### [ ] #6 HFlexElement / VStack — поддержка нескольких Fill с весами
Сейчас `HFlexElement` поддерживает максимум один `fill`-ребёнок. Нужно расширить:
- Разрешить несколько Fill-детей с весами (1fr, 2fr, ...) — оставшееся пространство делится пропорционально
- Применить ту же логику к будущему VFlexElement или унифицировать в один FlexContainer(direction)

Файлы: `src/TUIDom/Widgets/HFlexElement.ts`

---

## Рефакторинг примитивов

### [x] #8 Общий overlay session API для popup/menu/dialog
Унифицирован lifecycle оверлеев в `ContextMenuLayer`: добавлен session-handle API (`createSession`, `openPopupSession`) с политиками `restoreFocus`, `closeOnEscape`, `closeOnOutsidePointer`, `disposeOnClose` и общим позиционированием anchor-popup (clamp/flip). Мигрированы основные потребители: `EditorElement` context menu, `MenuBarElement` popup, file-tree context menu и quick-open/confirm dialog в `AppController`.

### [ ] #3 IScrollable — перейти на геометрические примитивы
`IScrollable` использует отдельные числовые поля `contentHeight`, `contentWidth`, `scrollTop`, `scrollLeft`. Нужно перейти на примитивы из `Common/GeometryPromitives.ts`:
- `contentHeight`/`contentWidth` → `Size`
- `scrollTop`/`scrollLeft` → `Offset` или `Point`
- Обновить `isScrollable` и все использования интерфейса

Файлы: `src/TUIDom/Widgets/IScrollable.ts`, `src/Common/GeometryPromitives.ts`

---

## Фокус

### [ ] #4 Автоматический фокус на старте приложения
Сейчас при запуске приложения `activeElement` не установлен — чтобы элемент начал получать события, приходится вручную вызывать `app.focusManager!.setFocus(widget)`. Нужно:
- Продумать систему автоматической установки `activeElement` при старте: авто-фокус на первый focusable элемент, или `autofocus`-атрибут на элементе
- Поддержать `autofocus` свойство на `TUIElement` — при `app.run()` FocusManager ищет первый элемент с `autofocus` и ставит фокус
- Фолбэк: если ни у одного элемента нет `autofocus`, фокусить первый элемент с `tabIndex >= 0`

Файлы: `src/TUIDom/Events/FocusManager.ts`, `src/TUIDom/TuiApplication.ts`, `src/TUIDom/TUIElement.ts`