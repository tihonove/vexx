# Vexx — Архитектура

## Обзор слоёв

Проект организован в виде стека слоёв. Каждый слой зависит только от нижележащих.

1. **App** (main.ts) — точка входа, bootstrap
2. **Controllers** — контроллеры с lifecycle (constructor → mount → activate → dispose), оркестрация UI и бизнес-логики
3. **Editor** — модель текстового редактора + мост к TUIDom
4. **TUIDom** — TUI-фреймворк (аналог браузерного DOM): дерево элементов, события, виджеты
5. **Input**, **Rendering**, **Backend** — платформенный слой: парсинг ввода, отрисовка, терминальный I/O
6. **Common** — общие примитивы и утилиты

## Каталоги src/

### Common/
Базовые типы и утилиты, не зависящие ни от чего: `Point`, `Size`, `Offset`, `BoxConstraints`, `Rect`, `IDisposable`, `Disposable`, DI-контейнер (`Token`, `Container`, см. [docs/DI.md](DI.md)).

### Input/
Пайплайн парсинга терминального ввода: сырые байты stdin → токены → `KeyPressEvent`. Включает токенизатор stdin, отслеживание мыши, stateful парсер клавиатурных событий (keydown/keypress/keyup в browser-like стиле) и обратную сериализацию для тестов.

### Rendering/
Вывод на экран: двойная буферизация, diff, минимальные ANSI-последовательности. Модель ячейки экрана, 2D-матрица с diff-алгоритмом, высокоуровневое API рисования (drawText, fill, clip) и генератор ANSI escape-последовательностей для flush в stdout.

### Backend/
Абстракция терминального I/O. Определяет интерфейс бэкенда (onInput, onResize, flush, setup, teardown) и две реализации: реальную (Node.js stdin/stdout, Kitty protocol, alternate screen) и in-memory для тестов (sendKey DSL, screenToString).

### TUIDom/
TUI-фреймворк — дерево элементов с layout, событиями, фокусом. Аналог браузерного DOM. Содержит базовый класс элемента, корневой event loop и два подкаталога. Система layout и позиционирования описана в [docs/LAYOUT.md](LAYOUT.md).

- **Events** — система событий: capture/bubble фазы, клавиатурные и фокус-события, менеджер фокуса с tab-навигацией, механизм default actions
- **Widgets** — конкретные виджеты: корневой элемент, боксы с рамкой, вертикальный стек, текстовый блок с word-wrap, скролл-контейнер со скроллбаром, контекстные меню, выпадающие меню, полоса меню

#### Default Actions

Система default actions повторяет модель Web DOM. У каждого элемента есть встроенное поведение (default action), отделённое от клиентских event listeners.

**Порядок обработки события:**
```
1. Capture phase   (root → target)
2. Target phase
3. Bubble phase    (target → root)
4. Default action  — вызов performDefaultAction(event) на target-элементе
```

**Как работает:**
- `TUIElement` определяет protected-метод `performDefaultAction(event)` (noop по умолчанию)
- `dispatchEvent()` вызывает `performDefaultAction()` на target-элементе **после** всех фаз propagation
- Если любой listener (на любой фазе) вызвал `preventDefault()`, default action **не выполняется**
- `stopPropagation()` **не отменяет** default action — только `preventDefault()`

**Как виджеты определяют default action:**
```typescript
class MyWidget extends TUIElement {
    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "keydown") {
            // встроенное поведение виджета
        }
    }
}
```

**Как клиенты отменяют default action:**
```typescript
widget.addEventListener("keydown", (event) => {
    event.preventDefault(); // отменяет встроенное поведение
});
```

**Что считать default action, а что нет:**
- Default action — встроенное поведение элемента, которое клиент может захотеть отменить (открытие подменю по клику, навигация по пунктам клавишами)
- НЕ default action — internal state management (сохранение `previousFocusedElement` при focus, деактивация при blur)

**Ограничение:** `performDefaultAction` вызывается только на `event.target` (элемент, на котором произошло событие), а не на каждом элементе в цепочке propagation. Для событий, где target — дочерний элемент, а обработка нужна на родителе (например, click на пункт меню обрабатывает родительский MenuBarElement), используйте bubble listener с проверкой `event.defaultPrevented`.

### Editor/
Модель текстового редактора и виджет-мост к TUIDom. Хранение текста (пока массив строк, в планах Piece Table), состояние вида (scroll, selections, folding, курсор), undo/redo стек, TUI-виджет редактора и набор интерфейсов. Содержит подкаталог с тестовыми утилитами (TrackDSL).

### Controllers/
Контроллеры приложения с чётким жизненным циклом. Каждый контроллер реализует `IController` (extends `IDisposable`):
- **constructor** (sync) — создаёт UI-скелет (`view`), все поля non-null
- **mount()** — подписка на события, wiring после вставки view в DOM-дерево
- **activate()** (async) — загрузка данных, инициализация внешних сервисов
- **dispose()** — cleanup ресурсов (LIFO через `Disposable.register()`)

Родительский контроллер создаёт дочерние, вставляет их `view` в своё дерево, вызывает `mount()` и `activate()`. Текущие контроллеры: `AppController` (корневой, меню, шорткаты), `EditorController` (текстовый редактор).

Зависимости контроллеров объявляются через `static dependencies` и резолвятся DI-контейнером из `Common/DiContainer.ts` при старте приложения. Подробности — [docs/DI.md](DI.md).

### demos/
Демо-приложения для ручного тестирования отдельных компонентов.

### TestUtils/
Общие утилиты для тестов (визуальные assertions для экрана).

## Правила зависимостей

```
App → Controllers → Editor → TUIDom → { Input, Rendering, Backend } → Common
```

- **Common** не импортирует ничего из проекта
- **Input**, **Rendering** зависят только от Common
- **Backend** зависит от Input, Rendering, Common
- **TUIDom** зависит от Rendering, Common (через TerminalScreen)
- **TUIDom/Events** используют тип TUIElement — это внутренняя зависимость TUIDom
- **Editor** зависит от TUIDom, Rendering (ColorUtils), Common
- **Controllers** зависит от Editor, TUIDom, Common
- **App** (main.ts) зависит от всех слоёв

### DI-контейнер: границы использования

Примитивы DI (`Token`, `Container`, `token()`) реализованы в `Common/DiContainer.ts`, но **объявлять конкретные DI-токены и импортировать `Container`** можно **только на уровнях Controllers и App**. Слои ниже (Editor, TUIDom, Input, Rendering, Backend) не должны зависеть от DI-контейнера.

Все DI-токены именуются по конвенции `*DIToken` (например `EditorControllerDIToken`, `TuiApplicationDIToken`). Подробности — [docs/DI.md](DI.md).
