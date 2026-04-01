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

### [ ] 2. Реализовать команды Tier 1
### [ ] 3. Реализовать команды Tier 2
### [ ] 4. Реализовать команды Tier 3
