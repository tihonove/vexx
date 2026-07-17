
# Vexx — TODO

Трекер задач проекта. Каждая задача имеет статус, краткое описание и контекст.

Статусы: `[ ]` — открыта, `[~]` — в работе, `[x]` — сделана.

Завершённые задачи из трекера убираем — история живёт в git и в `docs/arch/`.

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

- [~] [WhenContext](WhenContext.md) — система контекста when (остался полноценный парсер when-выражений)
- [~] [SyntaxHighlighting](SyntaxHighlighting.md) — подсветка синтаксиса (TextMate готов; далее scope-селекторы, async/background токенизация)
- [~] [Theming](Theming.md) — цветовые темы (встроенные темы из VS Code + пикер со сменой готовы; далее темы от расширений, hot-swap токен-темы)
- [ ] [PieceTree](PieceTree.md) — текстовый бэкенд документа (большие файлы, undo, snapshots)
- [~] [Extensions](Extensions.md) — VS Code-совместимые расширения (Phases 1, 8 готовы; 6, 9 частично; в работе — active-editor API)
- [~] [E2E](E2E.md) — e2e тесты против SEA-бинаря (Phase 1 готова)
- [ ] [Inspector](Inspector.md) — рефакторинг TUIElement-иерархии + основа приложения → inspector-протокол (`--inspect-tui`) для e2e
- [~] [Logging](Logging.md) — единый ILogService + RingBufferSink/FileSink (Phases 1–3.5 готовы; Output UI — базовый MVP: вкладка OUTPUT + селектор канала); далее фильтр по уровню, CLI flags, vscode API
- [~] [FileTreePerformance](FileTreePerformance.md) — производительность больших файловых деревьев (диагностика + бенчмарки готовы; фиксы — далее)
- [ ] [EnvironmentTuning](EnvironmentTuning.md) — подсказки пользователю по тюнингу окружения (терминал/tmux/ssh); первый пункт — tmux extended-keys для Ctrl+Tab
- [~] [Folding](Folding.md) — сворачивание кода (#86, #87); indentation-фолдинг end-to-end готов, далее — API-провайдеры расширений, region-маркеры, hover-контролы
- [~] [Uri](Uri.md) — первоклассная идентичность ресурса (#108, #107); ядро/ext-host на `Uri`, `untitled:` как схема, `workspace.fs` роутится по схеме — готово; далее реестр провайдеров ФС и `untitled:`-провайдер
- [~] [Problems](Problems.md) — панель диагностик и squiggly (маркер-сервис как в VS Code); готово: seam + squiggle + валидатор settings.json + нижняя Panel с деревом Problems (reveal, фокус); далее — счётчик в статус-баре, доп. поставщики (LSP/matchers/расширения)
- [~] [IntegratedTerminal](IntegratedTerminal.md) — встроенный терминал (node-pty + @xterm/headless как in-process tmux); интегрировано: вкладка TERMINAL в нижней Panel, `TerminalController`, команды toggle/new, SEA-упаковка нативного node-pty в основном пайплайне; далее — кросс-платформенная упаковка (macOS/Windows) + CI-матрица, UX (скролбэк/выделение/копирование/ссылки/bracketed-paste), список нескольких терминалов, тема-реактивная ANSI-палитра, проброс клавиш (commandsToSkipShell)

---

## Кодировки

### [ ] `files.encoding` — дефолтная кодировка из настроек
Ось encoding в ядре и пикеры Reopen/Save with Encoding готовы (#106); детект — BOM-only,
без BOM всегда utf-8. Follow-up как в VS Code:
- **`files.encoding`** — кодировка по умолчанию для открытия/сохранения (вместо
  захардкоженного utf-8), применять в `EditorGroupController.applyConfigurationToEditor`.
- **`files.autoGuessEncoding`** — эвристический детект содержимого (jschardet-подобный),
  отдельная опция поверх BOM-снифа.
- Предупреждение о некодируемых символах при сохранении (сейчас — молчаливый `?`
  от iconv-lite).

Файлы: `src/Editor/Encoding.ts`, `src/Controllers/EditorController.ts`,
`src/Controllers/EditorGroupController.ts`.

## Unicode и отображение символов

### [ ] Системная ширина символов: кодоген таблиц + рантайм-проба ambiguous-width
Ручная таблица в `UnicodeWidth.ts` неизбежно отстаёт от Unicode (класс бага
«пропущенный диапазон», см. закрытый #60). Два направления:
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
