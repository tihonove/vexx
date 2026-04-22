# Команды редактора

## Цель

Покрыть все действия текстового редактора системой команд (`CommandAction`), как в VS Code.

## Уровни команд

- **Tier 1** — базовая навигация и редактирование (курсор, выделение, delete, clipboard, undo/redo)
- **Tier 2** — продвинутая навигация и операции со строками (page up/down, move/copy/delete lines, indent)
- **Tier 3** — продвинутые фичи (find/replace, multi-cursor, comments, folding, smart select)
- **Tier 4** — LSP-зависимые (go to definition, hover, suggest, rename, format)

Справочник: VS Code `src/vs/editor/browser/coreCommands.ts` + `src/vs/editor/contrib/`.

## Зависимости

- [WhenContext](WhenContext.md) — нужна для условной активации команд

## Подзадачи

### [ ] 1. Добыть полный список команд VS Code и создать матрицу готовности

Добыть команды из `coreCommands.ts` + `editor/contrib/*`. Составить таблицу: команда → ID → дефолтный кейбиндинг → статус реализации.

### [x] 2. Реализовать команды Tier 1

Реализованы все базовые команды навигации и редактирования:

**Навигация курсора (24 команды):**
- `cursorLeft` / `cursorLeftSelect` — left / shift+left
- `cursorRight` / `cursorRightSelect` — right / shift+right
- `cursorUp` / `cursorUpSelect` — up / shift+up
- `cursorDown` / `cursorDownSelect` — down / shift+down
- `cursorHome` / `cursorHomeSelect` — home / shift+home
- `cursorEnd` / `cursorEndSelect` — end / shift+end
- `cursorTop` / `cursorTopSelect` — ctrl+home / ctrl+shift+home
- `cursorBottom` / `cursorBottomSelect` — ctrl+end / ctrl+shift+end
- `cursorWordLeft` / `cursorWordLeftSelect` — ctrl+left / ctrl+shift+left
- `cursorWordRight` / `cursorWordRightSelect` — ctrl+right / ctrl+shift+right
- `cursorPageDown` / `cursorPageDownSelect` — pagedown / shift+pagedown
- `cursorPageUp` / `cursorPageUpSelect` — pageup / shift+pageup

**Редактирование (7 команд):**
- `deleteLeft` — backspace
- `deleteRight` — delete
- `deleteWordLeft` — ctrl+backspace
- `deleteWordRight` — ctrl+delete
- `undo` — ctrl+z
- `redo` — ctrl+shift+z
- `editor.action.selectAll` — ctrl+a

Все команды зарегистрированы через `CommandAction` + `KeybindingRegistry` с `when: "textInputFocus"`.
Inline обработка клавиш в `EditorElement.handleKeyPress` убрана — осталось только Enter и печатные символы.

Файлы:
- `src/Controllers/Actions/EditorActions.ts` — навигация
- `src/Controllers/Actions/EditorEditActions.ts` — редактирование
- `src/Editor/EditorViewState.ts` — новые методы: `cursorTop`, `cursorBottom`, `cursorWordLeft`, `cursorWordRight`, `selectAll`, `deleteWordLeft`, `deleteWordRight`
- `src/Controllers/EditorController.ts` — `pushUndo`, `undo`, `redo` проксирующие методы

Тесты:
- `src/Editor/EditorViewState.DocumentNavigation.test.ts` (11 тестов)
- `src/Editor/EditorViewState.WordNavigation.test.ts` (29 тестов)
- `src/Editor/EditorViewState.SelectAll.test.ts` (7 тестов)

### [~] 3. Реализовать команды Tier 2

- [x] Команды управления табами (VS Code IDs):
	- `workbench.action.nextEditorInGroup` — `ctrl+tab`
	- `workbench.action.previousEditorInGroup` — `ctrl+shift+tab`
	- `workbench.action.closeActiveEditor` — `ctrl+w`
- [x] Добавлены fallback-хоткеи для терминалов, где `ctrl+tab` не различается:
	- next: `ctrl+pagedown`, `alt+pagedown`
	- previous: `ctrl+pageup`, `alt+pageup`
- Добавлены when-контексты для табов:
	- `editorGroupHasEditors`
	- `editorTabsMultiple`
- When-условия команд:
	- переключение табов: `textInputFocus && editorTabsMultiple`
	- закрытие активного таба: `textInputFocus && editorGroupHasEditors`
- Реализация: `src/Controllers/Actions/TabActions.ts`
- Интеграция: `src/Controllers/AppController.ts`, `src/Controllers/ContextKeys.ts`
- Тесты: `src/Controllers/Actions/TabActions.test.ts`, `src/Controllers/AppController.test.ts`, `src/Controllers/AppController.WhenContext.test.ts`

### [ ] 4. Реализовать команды Tier 3
