# Layout и позиционирование

## Ментальная модель

Элемент не живёт сам по себе — его помещают в контейнер. Контейнер решает, где ребёнок стоит и сколько места ему выделить. Ребёнок обязан уместиться в выданные constraints и рисовать себя строго в пределах своего размера — никакой обрезки извне нет, элемент сам отвечает за то, чтобы не вылезти за свои границы.

Исключение — `ScrollContainerElement`: он оборачивает ребёнка, который может иметь контент больше видимой области. Ребёнок рисует только видимую часть (через `scrollTop`/`viewportHeight`), а контейнер добавляет скроллбар.

Позиционирование внутри контейнера управляют `layoutStyle` (что хочет элемент) и `layoutState` (что вычислил контейнер). Типы этих полей зависят от конкретного контейнера.

## Размер элемента (`allocatedSize`)

`allocatedSize` — это **выделенная видимая область** элемента на экране, а не размер его контента. Контейнер-родитель определяет это значение через вызов `performLayout(constraints)`. Элемент обязан рисовать себя строго в пределах `allocatedSize`.

Если контент элемента больше выделенной области (например, текстовый документ длиннее viewport), элемент сам реализует скролл — хранит `scrollTop`/`scrollLeft` и рисует только видимую часть. `ScrollContainerElement` не обрезает ребёнка — он лишь рисует скроллбар рядом.

Публичный геттер `layoutSize` — ленивый: если `isLayoutDirty`, он вызывает `performLayout` с loose constraints. Это fallback для чтения размера вне цикла layout.

## Контейнеры и `performLayout`

Layout управляют контейнеры. Каждый контейнер (`VStackElement`, `BodyElement`, `ScrollContainerElement`, `ContextMenuLayer`) в своём `performLayout()`:

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

## RenderContext и `offset`

При рендере `RenderContext` несёт `offset: Offset` — абсолютное смещение текущего элемента на canvas. Контейнеры пробрасывают его через `context.withOffset(child.localPosition)`.

`RenderContext.offset` и `globalPosition` отслеживают одну и ту же величину параллельно: offset накапливается при рендере, globalPosition вычисляется при layout. В корректном состоянии они равны.

## Цикл layout → render

```
TuiApplication.renderFrame():
    root.globalPosition = (0, 0)
    root.performLayout(tight(screenSize))          // рекурсивно: размеры + позиции
    root.render(RenderContext(screen, offset=0))    // рекурсивно: отрисовка
    screen.flush(backend)
```

## Текущие ограничения

- **Нет clip rect**: обрезка не нужна — `Rect(globalPosition, layoutSize)` всегда равен видимой области элемента на экране. Контейнеры никогда не дают детям размер, выходящий за свои границы. Если появится контейнер с реальным clipping (виртуальный scroll через смещение позиции), потребуется отдельное свойство `visibleRect`.
- **Нет z-index**: порядок отрисовки и перекрытие определяет порядок детей в контейнере (последний ребёнок — поверх). `ContextMenuLayer` — всегда последний ребёнок `BodyElement`, что гарантирует overlay-поведение.
