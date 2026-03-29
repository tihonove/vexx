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
Базовые типы и утилиты, не зависящие ни от чего: `Point`, `Size`, `Offset`, `BoxConstraints`, `Rect`, `IDisposable`, `Disposable`.

### Input/
Пайплайн парсинга терминального ввода: сырые байты stdin → токены → `KeyPressEvent`. Включает токенизатор stdin, отслеживание мыши, stateful парсер клавиатурных событий (keydown/keypress/keyup в browser-like стиле) и обратную сериализацию для тестов.

### Rendering/
Вывод на экран: двойная буферизация, diff, минимальные ANSI-последовательности. Модель ячейки экрана, 2D-матрица с diff-алгоритмом, высокоуровневое API рисования (drawText, fill, clip) и генератор ANSI escape-последовательностей для flush в stdout.

### Backend/
Абстракция терминального I/O. Определяет интерфейс бэкенда (onInput, onResize, flush, setup, teardown) и две реализации: реальную (Node.js stdin/stdout, Kitty protocol, alternate screen) и in-memory для тестов (sendKey DSL, screenToString).

### TUIDom/
TUI-фреймворк — дерево элементов с layout, событиями, фокусом. Аналог браузерного DOM. Содержит базовый класс элемента, корневой event loop и два подкаталога:

- **Events** — система событий: capture/bubble фазы, клавиатурные и фокус-события, менеджер фокуса с tab-навигацией
- **Widgets** — конкретные виджеты: корневой элемент, боксы с рамкой, вертикальный стек, текстовый блок с word-wrap, скролл-контейнер со скроллбаром, контекстные меню, выпадающие меню, полоса меню

### Editor/
Модель текстового редактора и виджет-мост к TUIDom. Хранение текста (пока массив строк, в планах Piece Table), состояние вида (scroll, selections, folding, курсор), undo/redo стек, TUI-виджет редактора и набор интерфейсов. Содержит подкаталог с тестовыми утилитами (TrackDSL).

### Controllers/
Контроллеры приложения с чётким жизненным циклом. Каждый контроллер реализует `IController` (extends `IDisposable`):
- **constructor** (sync) — создаёт UI-скелет (`view`), все поля non-null
- **mount()** — подписка на события, wiring после вставки view в DOM-дерево
- **activate()** (async) — загрузка данных, инициализация внешних сервисов
- **dispose()** — cleanup ресурсов (LIFO через `Disposable.register()`)

Родительский контроллер создаёт дочерние, вставляет их `view` в своё дерево, вызывает `mount()` и `activate()`. Текущие контроллеры: `AppController` (корневой, меню, шорткаты), `EditorController` (текстовый редактор).

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
