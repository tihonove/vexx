
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
- [~] [Theming](Theming.md) — цветовые темы (встроенные темы из VS Code + пикер со сменой готовы; далее темы от расширений, hot-swap токен-темы)
- [ ] [PieceTree](PieceTree.md) — текстовый бэкенд документа (большие файлы, undo, snapshots)
- [~] [Extensions](Extensions.md) — VS Code-совместимые расширения (Phases 1, 8 готовы; 6, 9 частично; в работе — active-editor API)
- [~] [E2E](E2E.md) — e2e тесты против SEA-бинаря (Phase 1 готова)
- [ ] [Inspector](Inspector.md) — рефакторинг TUIElement-иерархии + основа приложения → inspector-протокол (`--inspect-tui`) для e2e
- [~] [Logging](Logging.md) — единый ILogService + RingBufferSink/FileSink (Phases 1–3.5 готовы); далее Output UI, CLI flags, vscode API
- [~] [FileTreePerformance](FileTreePerformance.md) — производительность больших файловых деревьев (диагностика + бенчмарки готовы; фиксы — далее)
- [ ] [EnvironmentTuning](EnvironmentTuning.md) — подсказки пользователю по тюнингу окружения (терминал/tmux/ssh); первый пункт — tmux extended-keys для Ctrl+Tab
- [~] [Folding](Folding.md) — сворачивание кода (#86, #87); indentation-фолдинг end-to-end готов, далее — API-провайдеры расширений, region-маркеры, hover-контролы
- [~] [Problems](Problems.md) — панель диагностик и squiggly (маркер-сервис как в VS Code); готово: seam + squiggle + валидатор settings.json + нижняя Panel с деревом Problems (reveal, фокус); далее — счётчик в статус-баре, доп. поставщики (LSP/matchers/расширения)

---

## Баги / недоделки

### [x] #53 Авто-отступ при переводе строки (Enter)
Enter больше не вставляет «голый» `\n`: новая строка наследует ведущие пробелы/табы
текущей строки, а после открывающей скобки `{ [ (` отступ увеличивается на уровень;
если курсор стоит между парой скобок (`{}`/`[]`/`()`) — блок раскрывается (закрывашка
уходит на отдельную строку с исходным отступом, курсор — на пустой средней строке).
Языко-независимая эвристика (без `language-configuration.json`). Чистая логика —
`src/Editor/AutoIndent.ts` (`computeNewLinePlan`), интеграция — `EditorViewState.insertNewLine()`
(per-selection, корректный undo и мульти-курсор). Тесты — `AutoIndent.test.ts`,
`EditorViewState.AutoIndent.test.ts`.

### [x] Единая отмена уровня workspace (файлы + текст)
Новый подкаталог `src/Controllers/Workspace/`: `UndoRedoService` (история по контекстным
бакетам, à la VS Code), модель `WorkspaceEdit`/`IUndoRedoElement`, `WorkspaceEditService`
(исполняет delete/move/copy и пишет обратимый шаг), `TrashService` (системная корзина
freedesktop с восстановлением; нет корзины → безвозвратно). Удаление спрашивает подтверждение
(`explorer.confirmDelete`; безвозвратное — всегда), отмена деструктивной операции переспрашивает
(`explorer.confirmUndo`); Ctrl+Z / Ctrl+Shift+Z в дереве (`when: listFocus`). Диалоги — generic
`ConfirmDialogElement`. Настройки — `Configuration/defaults.ts`.
**Фаза 2 (готово):** текстовая отмена редактора переведена на тот же `UndoRedoService` —
`UndoManager` остаётся движком правок, но каждый его шаг через хук `onDidPush` регистрирует
обёртку в общем сервисе под контекстом = путь файла (`EditorController`); `undo/redo` редактора
идут через сервис. Стек теперь единый, разнесён по контекстам (файл vs `WORKSPACE`).

### [x] #67 Копирование пути файла из дерева (полный / относительный)
Команды `fileOperations.copyPath` (Shift+Alt+C) и `fileOperations.copyRelativePath`
(аккорд Ctrl+K Ctrl+Shift+C, legacy-fallback Ctrl+K Ctrl+C) под `when: "listFocus"`.
Пишут путь выбранного узла в системный буфер (`IClipboard`); относительный —
через `path.relative(FileTreeController.getRootPath(), …)`. Дескрипторы —
`Actions/FileTreeClipboardActions.ts`, обработчики и пункты контекстного меню
(«Copy Path» / «Copy Relative Path») — `AppController`. Команды видны в палитре по
`title`. Тесты — `AppController.FileClipboard.test.ts`.

### [x] Перемещение файлов в explorer (cut/copy/paste)
Внутренний файловый буфер за абстракцией `IFileClipboard` (`src/Common/IFileClipboard.ts`,
реализация `InMemoryFileClipboard`, токен `FileClipboardDIToken`) — отдельно от текстового
`IClipboard`, чтобы позже подменить на нативную интеграцию с ОС. Команды
`fileOperations.copy/cut/paste` (под `when: "listFocus"`, Ctrl+C/X/V) и пункты контекстного
меню дерева. ФС-операции (copy/move, авто-переименование `… copy`, guard «папка в себя`) —
`src/Controllers/Actions/fileClipboardFs.ts`. В `TreeViewElement` добавлен множественный
выбор (Ctrl/Shift-клик, Shift+стрелки) и аксессоры `getSelectedNode(s)`; «вырезанные»
элементы подсвечиваются приглушённо через `list.deemphasizedForeground`. Покрыто юнит- и
интеграционными тестами (`fileClipboardFs.test.ts`, `InMemoryFileClipboard.test.ts`,
`FileTreeClipboardActions.test.ts`, `TreeViewElement.MultiSelect.test.ts`,
`AppController.FileClipboard.test.ts`).

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

### [x] #60 Артефакты при скролле на цветных emoji-кружках
Причина: ручная таблица ширины в `src/Common/UnicodeWidth.ts` не содержала блок
Geometric Shapes Extended (`U+1F7E0..1F7EB` — 🟠🟡🟢…) и ещё несколько
Emoji_Presentation=Yes точек (`1F7F0`, `1F6CC`, `1F6DC`, `1F004`, `1F0CF`,
squared/enclosed-CJK). Они считались шириной 1, терминал рисовал 2 → рассинхрон
колонок и stale-глифы при частичной перерисовке на скролле. Диапазоны добавлены в
`isWide()`, покрыты регресс-тестами (`UnicodeWidth.test.ts`, `DisplayLine.Emoji.test.ts`).

### [ ] Системная ширина символов: кодоген таблиц + рантайм-проба ambiguous-width
Ручная таблица в `UnicodeWidth.ts` неизбежно отстаёт от Unicode (класс бага
«пропущенный диапазон», см. #60). Два направления:
- **Кодоген** — генерировать `isWide`/`isZeroWidth` из официальных Unicode-файлов
  (`EastAsianWidth.txt` + `emoji-data.txt`) скриптом `scripts/gen-unicode-width.mjs`
  в отдельный generated-модуль. Убирает «пропущенные диапазоны» навсегда.
- **Рантайм-проба (CPR)** — ширина *ambiguous-width* символов (`·≈→↔–—…№`, EAW=A)
  и часть emoji терминально-зависимы; terminfo/`TERM` этого НЕ содержит (там только
  возможности). Единственный источник правды — спросить сам терминал: напечатать
  символ → послать `ESC[6n` (Cursor Position Report) → по ответу `ESC[row;colR`
  вычислить фактическую ширину. Одноразовый probe в bootstrap для набора спорных
  символов, кэшировать результат. Опционально — mode 2027 (grapheme clustering).

Файлы: `src/Common/UnicodeWidth.ts`, bootstrap в `src/App/`/`main.ts`, `src/Backend/`.

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