# Read-only редактор

Режим «только чтение» у редактора — аналог `EditorOption.readOnly` в VS Code.
Задача выросла из Output-панели (Phase 4 в [Logging.md](Logging.md)): VS Code
рендерит Output не своим виджетом, а read-only редактором над моделью с языком
`log` (`outputView.ts`, `OutputEditor extends AbstractTextResourceEditor`).

## Готово — Этап 1: флаг read-only

Три уровня защиты, как в VS Code:

| Уровень | VS Code | У нас |
|---|---|---|
| Опция редактора | `EditorOption.readOnly` | `EditorViewState.readOnly` |
| Гейт команд | `precondition: EditorContextKeys.writable` | `when: "textInputFocus && !editorReadonly"` |
| Runtime-гард | `CodeEditorWidget.executeEdits` → `false` | ранний выход в мутаторах `EditorViewState` |

- **`EditorViewState.readOnly`** — флаг живёт здесь, потому что через эту точку
  проходят ВСЕ правки: клавиатура и paste, accept completion, rename/bulkEdit,
  `editor.applyEdit` из расширений. Мутаторы становятся no-op и возвращают
  `undefined` (сигнатуры `type`/`insertText`/`insertNewLine` расширены).
- **Пути мимо view-state** закрыты на `EditorPane`: `undo`/`redo`/`setEol`/
  `setEncoding` идут в `TextFileModel` напрямую — как `pushUndoStop`/`popUndoStop`
  в `CodeEditorWidget`. `applyActiveEditorEdits` теперь честно возвращает `false`,
  а не врёт расширению об успехе.
- **Контекст-ключ `editorReadonly`** — выставляет `WorkbenchContextKeys` по
  сфокусированному `EditorElement`, симметрично `textInputFocus`.
- **Команда** `workbench.action.files.toggleActiveEditorReadonlyInSession` —
  порт одноимённой из VS Code, session-скоуп, без дефолтного шортката.
- **Индикация** — метка-замок (nf-cod-lock) на вкладке перед именем файла.
- Фолдинг, курсор, выделение, копирование и Ctrl+F в read-only работают —
  как и в VS Code.

Демо: `e2e/scenarios/readonlyEditor.scenario.ts`.

## Открытые фазы

- [ ] **Этап 2 — detached pane.** Нужен, чтобы поселить редактор вне таб-строки
  (в нижней Panel). Уезжает в задачу про Output — у него нет другого потребителя,
  а гейт «что считать готово» требует живого демо.
  - Все ~75 вызовов `getActiveEditor()` идут через одну точку
    (`editorService.ts`, `this.editors[activeIndexValue]`): достаточно завести
    список detached-панелей и отдавать сфокусированную из него — **call-sites не
    меняются**.
  - `getEditors`/`editorCount`/`getOpenFilePaths`/`collectDirty` продолжают ходить
    по `this.editors` → detached pane автоматом вне табов, персиста и shutdown.
  - `EditorPane` склеен с `TextFileModel`; синтетический ресурс уже поддержан
    (`untitled:`), Output получит `output:<channel>`-URI, как в VS Code.

- [ ] **Конфигурационный слой** — `files.readonlyInclude`/`readonlyExclude`/
  `readonlyFromPermissions` и команды `setActiveEditorReadonlyInSession`/
  `setActiveEditorWriteableInSession`/`resetActiveEditorReadonlyInSession`.
  Сейчас есть только session-toggle.

- [ ] **Обратная связь при попытке правки** — VS Code показывает
  `readOnlyMessage` во всплывашке. У нас правка просто не происходит, молча.
