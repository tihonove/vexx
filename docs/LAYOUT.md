# Layout и позиционирование

## Ментальная модель

Элемент не живёт сам по себе — его помещают в контейнер. Контейнер решает, где ребёнок стоит и сколько места ему выделить. Ребёнок рисует себя в **локальных координатах** (от 0,0), а `RenderContext` автоматически транслирует их в экранные координаты и обрезает по `clipRect`.

Простые виджеты рисуют весь свой контент — clipRect гарантирует, что за пределы выделенной области ничего не попадёт. Тяжёлые виджеты (EditorElement) могут оптимизировать рендер, рисуя только видимую часть.

## Размер элемента (`allocatedSize`)

`allocatedSize` — это **выделенная видимая область** элемента на экране, а не размер его контента. Контейнер-родитель определяет это значение через вызов `performLayout(constraints)`. Элемент рисует себя от (0, 0) в локальных координатах, а clipRect обрезает всё, что выходит за границы.

Публичный геттер `layoutSize` — ленивый: если `isLayoutDirty`, он вызывает `performLayout` с loose constraints. Это fallback для чтения размера вне цикла layout.

## Контейнеры и `performLayout`

Layout управляют контейнеры. Каждый контейнер (`VStackElement`, `BodyElement`, `ScrollBarDecorator`, `ContextMenuLayer`) в своём `performLayout()`:

1. Вызывает `super.performLayout(constraints)` — фиксирует собственный размер
2. Для каждого ребёнка:
   - Вычисляет позицию и размер ребёнка по своей логике
   - Устанавливает `child.localPosition` и `child.globalPosition`
   - Вызывает `child.performLayout(childConstraints)`

Листовые элементы (`BoxElement`, `EditorElement`, `PopupMenuElement`) используют базовый `performLayout`, который просто применяет `constraints.constrain()` к текущему размеру. Некоторые (`PopupMenuElement`) переопределяют метод для вычисления intrinsic size.

## `layoutStyle` и `layoutState`

Поля `layoutStyle` и `layoutState` — нетипизированные (`unknown`) слоты для коммуникации между элементом и его контейнером-родителем:

- **`layoutStyle`** — задаётся извне при добавлении ребёнка в контейнер. Описывает желаемое позиционирование внутри конкретного контейнера. Например, `VStackLayoutStyle` содержит `{ width: number | "fill", height: number }`. Контейнер читает это поле в своём `performLayout()`.
- **`layoutState`** — записывает контейнер в `performLayout()` для хранения вычисленных промежуточных данных (например, `{ rect: Rect }`).

Оба поля специфичны для типа контейнера. Элемент не знает, в каком контейнере он находится — он просто хранит эти значения.

## Координатная система

Два свойства задают положение элемента на экране:

- **`localPosition: Offset`** — смещение элемента относительно родителя. Устанавливает контейнер в `performLayout()`.
- **`globalPosition: Point`** — абсолютная позиция элемента на экране (0-based). Устанавливает контейнер в `performLayout()` как `parent.globalPosition + child.localPosition`.

Корневой элемент получает `globalPosition = (0, 0)` от `TuiApplication` перед вызовом `performLayout()`.

## RenderContext

При рендере `RenderContext` несёт:

- **`offset: Offset`** — абсолютное смещение текущего элемента на canvas. Контейнеры пробрасывают его через `context.withOffset(child.localPosition)`.
- **`clipRect: Rect`** — область обрезки в экранных координатах. Контейнеры пробрасывают через `context.withClip(childVisibleRect)`, где `childVisibleRect = Rect(child.globalPosition, child.layoutSize)`. Clip rect'ы пересекаются — дети не могут рисовать за пределы родителя.

Виджеты используют `context.setCell(x, y, cell)` для рендера в локальных координатах. Метод транслирует координаты: `screenX = x + offset.dx`, `screenY = y + offset.dy`, проверяет попадание в clipRect и пишет в canvas. Аналогично работает `context.setCursorPosition(x, y)`.

`RenderContext.offset` и `globalPosition` отслеживают одну и ту же величину параллельно: offset накапливается при рендере, globalPosition вычисляется при layout. В корректном состоянии они равны.

## Скролл

Скролл разделён на два компонента:

- **`ScrollViewport`** — engine скролла. Оборачивает scrollable-ребёнка (реализующего `IScrollable`), сдвигает offset на `-scrollTop` и обрезает по своим границам. Ребёнок рисует весь контент от y=0, а viewport показывает только видимую часть.
- **`ScrollBarDecorator`** — рисует скроллбар рядом с ребёнком. Не управляет скроллом — только визуализация.

Для простых виджетов (TextBlockElement) используется композиция:
```
ScrollBarDecorator → ScrollViewport → TextBlockElement
```

Для тяжёлых self-scrolling виджетов (EditorElement), которые сами оптимизируют рендер видимой области:
```
ScrollBarDecorator → EditorElement
```

`IScrollable` определяет `contentHeight` и `scrollTop`. `ScrollViewport` реализует `IScrollable`, делегируя обёрнутому ребёнку.

## Цикл layout → render

```
TuiApplication.renderFrame():
    root.globalPosition = (0, 0)
    root.performLayout(tight(screenSize))          // рекурсивно: размеры + позиции
    screenClip = Rect((0,0), screenSize)
    root.render(RenderContext(screen, offset=0, screenClip))  // рекурсивно: отрисовка
    screen.flush(backend)
```

## Текущие ограничения

- **Нет z-index**: порядок отрисовки и перекрытие определяет порядок детей в контейнере (последний ребёнок — поверх). `ContextMenuLayer` — всегда последний ребёнок `BodyElement`, что гарантирует overlay-поведение.

## Intrinsic Size API

Элементы умеют отвечать на вопрос «какой размер мне нужен?» **до** вызова `performLayout()`. Это чистые read-only методы без side-effects:

- `getMinIntrinsicWidth(height)` — минимальная ширина, при которой элемент способен отрисоваться без потери контента
- `getMaxIntrinsicWidth(height)` — максимальная ширина, которую элемент может полезно использовать (больше — пустое место)
- `getMinIntrinsicHeight(width)` / `getMaxIntrinsicHeight(width)` — аналогично для высоты

Базовая реализация в `TUIElement` возвращает 0 для всех четырёх. Элементы переопределяют по необходимости.

Параметр `height`/`width` зарезервирован для виджетов с word-wrap (высота зависит от ширины). Сейчас большинство элементов его игнорируют.

Intrinsic-методы используются контейнерами (HFlexElement, будущий VFlexElement) для режима **Fit** — «подстройся под контент ребёнка».

## HFlexElement

Горизонтальный flex-контейнер. Раскладывает детей в строку. Каждому ребёнку задаётся `HFlexLayoutStyle`:

```
width: Fixed(n) | Fit | Fill     — размер по главной оси (горизонтальной)
height: number | "fill"          — размер по cross оси (вертикальной)
```

Режимы ширины:
- **Fixed(n)** — ровно n символов
- **Fit** — ширина по `getMaxIntrinsicWidth()` ребёнка
- **Fill** — заполнить оставшееся после Fixed и Fit (максимум один Fill-ребёнок)

Алгоритм `performLayout`:
1. Суммировать ширины Fixed-детей
2. Измерить Fit-детей через `getMaxIntrinsicWidth()`, суммировать
3. `remaining = containerWidth - fixedSum - fitSum`
4. Fill-ребёнок получает `remaining`
5. Вызвать `child.performLayout(tight(width, height))` для всех

Хелперы: `hflexFixed(n)`, `hflexFit()`, `hflexFill()`.
