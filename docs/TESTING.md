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
Собираем DI-контейнер как в проде, создаём `TestApp` из `controller.view`:

```ts
function createTestAppController(size: Size = new Size(80, 24)) {
    const container = new Container();
    container
        .bind(CommandRegistryDIToken, () => new CommandRegistry())
        .bind(KeybindingRegistryDIToken, () => new KeybindingRegistry())
        .bind(ServiceAccessorDIToken, (): ServiceAccessor => container)
        .bind(EditorControllerDIToken, EditorController)
        .bind(AppControllerDIToken, AppController);

    const controller = container.get(AppControllerDIToken);
    controller.mount();
    const testApp = TestApp.create(controller.view, size);
    container.bind(TuiApplicationDIToken, () => testApp.app);

    return { testApp, controller };
}
```

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
- У виджетов проверяем визуальный результат через `MockTerminalBackend` → `expectScreen`

```ts
it("renders a 6x3 box", () => {
    const backend = renderBox(6, 3);
    expectScreen(backend, screen`
        +----+
        |    |
        +----+
    `);
});
```

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
