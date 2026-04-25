# Piece Tree (текстовый бэкенд документа)

**Статус**: не начато. Сейчас `TextDocument` хранит текст как `string[]` (массив строк).

## Контекст

[GOAL.md](../../GOAL.md) явно требует Piece Table-подобную структуру для:
- больших файлов (десятки/сотни МБ),
- быстрого undo/redo (immutable snapshots),
- быстрой вставки/удаления в середину без копирования всего текста.

VS Code использует **Piece Tree** (red-black tree of pieces with line-start cache), не классический Piece Table. См. их [блог-пост](https://code.visualstudio.com/blogs/2018/03/23/text-buffer-reimplementation) и реализацию в [vscode-textbuffer](https://github.com/microsoft/vscode/tree/main/src/vs/editor/common/model/pieceTreeTextBuffer).

## Что нужно сохранить из текущего API

`ITextDocument` уже отделён от реализации — это правильная точка расширения. Контракт, который должен сохраниться при переезде:

- `getText()`, `getLineContent(lineNumber)`, `lineCount`, `getLength()`
- `getPositionAt(offset) ↔ getOffsetAt(position)` — конверсии offset ↔ {line,col}
- `applyEdits(edits[])` — батч правок, bottom-up
- `setText(text)` — полный replace
- **`onDidChangeContent(listener)`** — структурное событие `{startLine, oldEndLine, newEndLine}`. Это ключ: `DocumentTokenStore`, decorations, marker tracking уже подписаны на это событие. Piece Tree должен его генерировать **с теми же координатами и в том же порядке** (по документу, а не по применению).

## Подзадачи

### [ ] Спроектировать API буфера отдельно от ITextDocument
Внутренний интерфейс `ITextBuffer` — то, на что переключаемся:
- `getLineContent(lineNumber)`, `getLineLength(lineNumber)`, `getLineCount()`
- `getValueInRange(range)`, `getValueLength()`
- `getOffsetAt(position)`, `getPositionAt(offset)` — должны быть O(log n)
- `applyEdits(edits): IDocumentContentChange[]` — возвращает уже агрегированные структурные изменения

`TextDocument` становится тонким адаптером поверх `ITextBuffer`: держит eventEmitter, диспетчит `onDidChangeContent`.

### [ ] Реализовать PieceTreeBuffer
- **Buffers**: `original` (immutable snapshot файла) + список `changeBuffers` (append-only). Каждый piece ссылается на буфер + offset + длина + line-start offsets внутри.
- **Tree**: red-black tree, узел = piece. В узле кешируется `subtree.length` и `subtree.lfCount` (количество переводов строк в поддереве) — это даёт O(log n) для `offsetAt`/`positionAt`/`getLineContent`.
- **EOL-нормализация**: одна стратегия на документ (CR / LF / CRLF). При загрузке детектится, при правках сохраняется.
- **Snapshots для undo**: snapshot = corner case red-black tree клонирования (или persistent дерево). Альтернатива на старте — хранить inverse-edits и применять их.

### [ ] Сохранить семантику onDidChangeContent
- При `applyEdits` Piece Tree должен сгруппировать правки по строкам и эмитить `{startLine, oldEndLine, newEndLine}` **в порядке возрастания startLine**.
- Если правки overlap-ятся или соседствуют — слить в одно событие.
- `DocumentTokenStore.handleContentChange` уже корректно обрабатывает множественные события подряд — главное не нарушить порядок и не потерять промежуточные состояния (иначе `cachedTokens.splice` уедет относительно `lineCount`).

### [ ] CR/LF и mixed-EOL
- Сейчас `setText` делает `text.split("\n")` — теряется информация о CR.
- Piece Tree должен корректно отдавать `getLineContent` без EOL-символов и хранить EOL отдельно (поле `eol` документа + при необходимости per-line override на mixed).
- Тесты — отдельный файл `PieceTreeBuffer.EOL.test.ts`.

### [ ] Перформанс-тесты
- `PieceTreeBuffer.Performance.test.ts` (skipped по умолчанию или с длинным таймаутом):
  - загрузка 100 МБ файла — должно укладываться в секунды и не копировать буфер
  - 10к случайных правок в середине — линейный рост по правкам, не по размеру
  - `getLineContent(random)` — O(log n)

### [ ] Снэпшоты и undo
- Сейчас `UndoManager` хранит inverse-edits. С Piece Tree можно перейти на snapshot-based undo (cheap clone дерева).
- Решить: оставить inverse-edits (проще, работает) или сделать snapshot API на буфере и переключить UndoManager.

### [ ] Миграция в два шага
1. Ввести `ITextBuffer`, реализовать `ArrayLineBuffer` (текущая логика, тонкая обёртка). Все тесты должны остаться зелёными.
2. Реализовать `PieceTreeBuffer` за тем же интерфейсом. Переключение через DI или per-file (большие файлы — Piece Tree, мелкие — массив).

## Что **не** трогать при миграции

- `ITextDocument` API наружу.
- Сигнатуру `onDidChangeContent` и тип `IDocumentContentChange`.
- `DocumentTokenStore`, `EditorViewState`, `EditorElement` — они уже работают через events и lineCount/getLineContent.

## Связанные файлы

- `src/Editor/TextDocument.ts` — текущая реализация
- `src/Editor/ITextDocument.ts` — публичный контракт
- `src/Editor/IDocumentContentChange.ts` — событие
- `src/Editor/UndoManager.ts` — undo-стек (потенциальная миграция на snapshots)
