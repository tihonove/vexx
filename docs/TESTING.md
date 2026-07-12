# Vexx — Гайд по тестированию

Общие правила и паттерны тестирования для каждого слоя проекта.

---

## Общие принципы

- Тестовый фреймворк — **Vitest** (`describe`, `it`, `expect`, `vi`)
- Файлы с тестами лежат рядом с исходниками: `Foo.ts` → `Foo.test.ts`
- Если тестов много, разбиваем по категориям: `Foo.Events.test.ts`, `Foo.Layout.test.ts`
- Не лезем в приватные поля через bracket notation (`obj["privateField"]`) — тестируем публичный контракт
- Моки и шпионы (`vi.fn()`, `vi.spyOn()`) — только для внешних зависимостей и сайд-эффектов

---

## Controllers

Контроллеры тестируем как **чёрный ящик**. Контроллер — это штука, которая создаёт UI-дерево и связывает поведение. Проверяем результат через DOM-элементы и визуальное состояние, а не через внутренние поля контроллера.

### Что проверяем
- Структуру созданного DOM-дерева (`querySelector`, `querySelectorAll`)
- Состояние фокуса (`testApp.focusedElement`)
- Реакцию на пользовательский ввод через DOM (`testApp.sendKey(...)`)
- Визуальный результат рендера (`expectScreen`)
- Текстовое содержимое через DOM-элементы (например, текст в `EditorElement`)

### Чего НЕ делаем
- Не обращаемся к дочерним контроллерам: ~~`controller["editorController"]`~~
- Не шпионим за методами внутренних объектов контроллера
- Не проверяем внутреннее состояние — только наблюдаемое поведение через DOM

### Как создаём тестовое окружение
Используем `createAppTestHarness()` + `createTempWorkspace()` из `TestUtils/` — не собираем контейнер и temp-каталоги руками. Канонический вид:

```ts
let ws: ITempWorkspace;
let h: IAppHarness;

beforeEach(() => {
    ws = createTempWorkspace({ files: { "alpha.txt": "Alpha content" } });
    h = createAppTestHarness({ workspaceFolder: ws.dir });
});

afterEach(() => {
    h.dispose();
    ws.dispose();
});
```

Харнесс даёт `h.testApp`, `h.commands`, `h.controller`, а suite-specific сервисы достаём через `h.container.get(ThemeServiceDIToken)`. Низкоуровневый примитив под харнессом — тестовый профиль `createTestContainer()` (см. [DI.md](DI.md#профили)); напрямую он нужен только если тест не про `AppController`.

### Пример: проверяем набор текста через DOM

```ts
// Плохо — лезем в приватное поле контроллера
const editorController = controller["editorController"];
expect(editorController.getText()).toBe("hi");

// Хорошо — проверяем через DOM-элемент или рендер
const editor = testApp.querySelector("EditorElement");
expect(editor.getText()).toBe("hi");
```

---

## TUIDom

Тестируем элементы, геометрию, события и фокус. Слой ниже контроллеров — здесь допустимо создавать элементы напрямую и проверять их API.

### Что проверяем
- Layout и координатную систему (`performLayout`, `localToGlobal`)
- Диспетчеризацию событий (capture/bubble фазы, `dispatchEvent`)
- Фокус и tab-навигацию
- Визуальный рендер через `expectScreen` + `screen` tagged template

### Паттерны
- Для построения деревьев используем хелпер `ContainerElement` или конкретные виджеты
- У виджетов проверяем визуальный результат через `renderElement` → `expectScreen`

```ts
it("renders a 6x3 box", () => {
    const backend = renderElement(new BoxElement(), 6, 3);
    expectScreen(backend, screen`
        +----+
        |    |
        +----+
    `);
});
```

`renderElement` покрывает только single-shot рендер (layout → render → flush). Мультифреймовые сценарии, доступ к `TerminalScreen` или ненулевой `globalPosition` — ручной сетап, не форсим хелпер.

---

## Editor

Тестируем модели данных: `TextDocument`, `EditorViewState`, `UndoManager`. Это чистая логика без UI — unit-тесты в классическом смысле.

### Что проверяем
- Вставку, удаление, замену текста в `TextDocument`
- Мульти-курсор, выделения, навигацию в `EditorViewState`
- Undo/redo стек
- Folding-регионы

### Паттерны
- Простые тесты — создаём `TextDocument` и `EditorViewState` напрямую
- Для сложных сценариев (folding + cursors) используем DSL из `EditorTestUtils/TrackDSL.ts`

```ts
it("types with two cursors on the same line", () => {
    const doc = new TextDocument("aabb");
    const state = new EditorViewState(doc, [
        createCursorSelection(0, 2),
        createCursorSelection(0, 0),
    ]);
    state.type("X");
    expect(doc.getText()).toBe("XaaXbb");
});
```

---

## Rendering

Тестируем примитивы рендеринга: ячейки, грид, diff-алгоритм, ANSI-вывод.

### Что проверяем
- Корректность `Cell` (сравнение, клонирование)
- Операции `Grid` (инициализация, запись/чтение ячеек, копирование)
- Diff-рендеринг в `TerminalRenderer` (минимальный ANSI-вывод)
- Парсинг и упаковку цветов

### Паттерны
Прямое создание объектов, проверка через `expect`:

```ts
it("produces no output when grids are identical", () => {
    const a = new Grid(new Size(3, 2));
    const b = new Grid(new Size(3, 2));
    b.copyAllCellsFrom(a);
    renderer.render(a, b);
    expect(output).toBe("");
});
```

---

## Input

Тестируем пайплайн парсинга ввода: токенизация сырых байтов, парсинг клавиш, сериализация.

### Что проверяем
- Токенизацию stdin-потока (`tokenize`)
- Парсинг клавиатурных событий (`KeyInputParser`)
- Обратную сериализацию клавиш (`serializeKey`)
- Обработку мыши

### Паттерны
Чистые функции — подаём вход, проверяем выход:

```ts
it("parses simple character", () => {
    const result = parseInput("a");
    expect(result.key).toBe("a");
});
```

---

## Common

Тестируем DI-контейнер и базовые утилиты.

### Паттерны
Классические unit-тесты без зависимостей:

```ts
it("resolves a registered token", () => {
    const container = new Container();
    const token = new Token<string>("test");
    container.bind(token, () => "value");
    expect(container.get(token)).toBe("value");
});
```

---

## Тестовые утилиты

### AppTestHarness (`TestUtils/AppTestHarness.ts`)
Boot-харнесс интеграционных тестов над `AppController`: `createAppTestHarness({ workspaceFolder?, size?, openFile?, focusEditor? })` собирает тестовый DI-контейнер, монтирует контроллер и оборачивает его view в `TestApp`. Возвращает `{ testApp, controller, commands, container, activeEditor(), dispose() }`. Харнесс синхронный — async-активация (`await controller.activate()`, `fileIndexReady`) остаётся в тесте. Воркспейсом не владеет — композиция с `createTempWorkspace` (см. канонический сниппет в разделе Controllers).

### TempWorkspace (`TestUtils/TempWorkspace.ts`)
Временный воркспейс: `createTempWorkspace({ prefix?, files? })` → `{ dir, writeFile(rel, content), path(rel), dispose() }`. Сид-файлы поддерживают вложенные пути; `dispose()` — рекурсивный `rmSync`, безопасен в `afterEach`/`finally`.

### timing (`TestUtils/timing.ts`)
- `flushMicrotasks(turns = 3)` — прокачка microtask-очереди (continuation'ы QuickInput/QuickOpen после `commands.execute`)
- `settle(ms = 200)` — real-time ожидание subprocess/RPC-эффектов (ExtensionHost-тесты)

### domQueries (`TestUtils/domQueries.ts`)
DOM-аксессоры над `TestApp`: `quickPickByTitle(app, title)`, `tabLabels(app)`, `typeText(app, text)`.

### renderElement (`TestUtils/renderElement.ts`)
Single-shot рендер standalone-элемента: `renderElement(element, width, height, { constraints?, resolveStyles? })` → `MockTerminalBackend` для `expectScreen` (см. раздел TUIDom).

### TestApp (`TestUtils/TestApp.ts`)
Обёртка для интеграционных тестов: создаёт `TuiApplication` с `MockTerminalBackend`, предоставляет:
- `sendKey(key)` — эмуляция нажатия
- `querySelector(name)` — поиск элементов в DOM-дереве
- `focusedElement` — текущий элемент с фокусом
- `app` — доступ к `TuiApplication`

### expectScreen (`TestUtils/expectScreen.ts`)
Визуальная проверка рендера через tagged template:

```ts
expectScreen(backend, screen`
    +----+
    |    |
    +----+
`);
```

### ExtensionTestHarness (`TestUtils/ExtensionTestHarness.ts`)
Для тестов extension host'а: `createExtensionTestHarness({ initialFile?, extensions? })` поднимает реальный `EditorGroupController` + `ExtensionHost` поверх `TestApp`. Subprocess форкается через `subprocessSpawnArgsForTests()`; тестовые расширения — `*.cjs`-файлы с `exports.activate` из `__fixtures__`, регистрация — `extensionFixture(id, file)` (расширяемые поля добавляются спредом), путь к каталогу — `EXTENSION_FIXTURES_DIR`. Unit-тесты RPC без subprocess'а используют `createInProcessChannelPair()`.

---

## E2E

`npm run test:e2e` (отдельный конфиг `vitest.e2e.config.ts`) собирает SEA-бинарь и гоняет его через `node-pty` + ANSI-парсер. Сьюты и helpers — в `e2e/`. Детали и roadmap — [TODO/E2E.md](TODO/E2E.md).

### Скриншот-демо (screenshots)

Визуальные фичи демонстрируются **сценариями** в `e2e/scenarios/` (`*.scenario.ts`). Сценарий — это `defineScenario({ name, open, run })`: `run(editor)` получает драйвер над настоящим бинарём (headless) и шлёт команды (`sendKey`, `sendText`, `waitForText`) + снимает кадры (`capture("shot")`). Механика захвата: `HeadlessSession` (реальный SEA-бинарь с `--headless` + инспектор по WebSocket) → `GridSnapshot` → `gridToSvg` → PNG через resvg (всё в `e2e/helpers/`; растеризатор — только тулинг, не в редакторе).

- `npm run screenshots` — прогоняет все сценарии, пишет PNG в `screenshots/` (в `.gitignore`) + `screenshots/INDEX.md`-галерею.
- `e2e/scenarios.test.ts` гоняет те же сценарии в `npm run test:e2e` (и в CI) — страховка, чтобы демо не протухли; функциональных ассертов там нет.

### Политика: визуальные фичи требуют скриншот-демо

Фича с видимой/внешней составляющей обязана добавить/обновить сценарий в `e2e/scenarios/` и приложить PNG к PR (правило — в [AGENTS.md](../AGENTS.md)).

---

## Покрытие (Coverage)

```bash
npm run test:coverage      # = vitest run --coverage
```

В отчёте включён `skipFull: true` — показываются **только недопокрытые** файлы (полностью покрытые скрыты). Конфиг — [vitest.config.ts](../vitest.config.ts).

### Политика: покрываем весь новый код

Цель — 100% покрытия по всему, что реально исполняется. Это закреплено **храповиком** `coverage.thresholds` с `autoUpdate: true`:
- если покрытие падает ниже зафиксированной планки — прогон/CI **краснеет**;
- если покрытие выросло — vitest сам поднимает числа порогов в конфиге (коммить их).

Бэклог недопокрытого реального кода — [TODO/Coverage.md](TODO/Coverage.md).

### Что и почему исключаем из метрики

Исключения (`coverage.exclude`) добавляем **только** если файл попадает в одну из категорий:

1. **Чистые типы** — интерфейсы `I*.ts`, `*.d.ts`, barrel-`index.ts`. Исполнять нечего; чистый интерфейс добавляем в **явный список** exclude (глоб `I*.ts` НЕ используем — см. ниже).
2. **Непокрываемое юнит-тестами** — реальный tty (`NodeTerminalBackend`), subprocess-точка входа (`ExtensionHostSubprocess`), SEA-детект (`IsSea`, `createDefaultAssetAccess`), RPC-стаб в subprocess (`VscodeNamespace`), DI-проводка (`Controllers/Modules/**`), null-object заглушки. Это проверяется e2e (`vitest.e2e.config.ts`), а не юнит-тестами.

**Важно:** реальную логику в файлах с префиксом `I*` (например хелперы `createRange` в `IRange.ts`, `NULL_STATE` в `IState.ts`, `isScrollable` в `IScrollable.ts`) **не прячем** — её покрываем. Поэтому интерфейсы исключаем поимённо, а не глобом `src/**/I*.ts`.
