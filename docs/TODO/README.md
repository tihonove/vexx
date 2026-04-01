# Vexx — TODO

Трекер задач проекта. Каждая задача имеет статус, краткое описание и контекст.

Статусы: `[ ]` — открыта, `[~]` — в работе, `[x]` — сделана.

---

## Визуальный ориентир

### NVChad — референс для UI/UX
Проект: https://github.com/NvChad/NvChad

NVChad — конфигурация Neovim с красивым UI, быстрым рендерингом и продуманной визуальной частью. Ориентируемся на него в плане:
- **Внешний вид**: цветовые темы (base46), statusline, tabufline, общая эстетика
- **Иконки**: nvim-web-devicons — файловые иконки, иконки типов файлов в дереве и табах
- **Рендеринг UI-элементов**: telescope (fuzzy finder с превью), nvim-tree (файловое дерево), cheatsheets
- **Цветовые схемы**: onedark и другие темы из base46 как отправная точка для палитры

Ключевые плагины NVChad для вдохновения:
- [base46](https://github.com/NvChad/base46) — темы и подсветка
- [NvChad UI](https://github.com/NvChad/ui) — statusline, tabufline, theme switcher
- [nvim-web-devicons](https://github.com/kyazdani42/nvim-web-devicons) — иконки файлов
- [telescope.nvim](https://github.com/nvim-telescope/telescope.nvim) — поиск файлов с превью
- [nvim-tree.lua](https://github.com/kyazdani42/nvim-tree.lua) — файловое дерево

---

## Крупные задачи

- [EditorCommands](EditorCommands.md) — система команд редактора
- [WhenContext](WhenContext.md) — система контекста when

---

## Команды и кейбиндинги

### [ ] #1 Рефакторинг Keybinding — типизированный билдер
Сейчас `Keybinding` — простой дата-объект с полями `key`, `ctrlKey`, `shiftKey`, `altKey`, `metaKey`. Создаётся через `parseKeybinding("ctrl+s")`. Хочется:
- Более выразительный и читаемый API сборки (билдер или фабричные хелперы)
- Строгая типизация клавиш (не просто `string`, а конкретные допустимые имена)
- Удобное сравнение, сериализация обратно в строку для отображения в UI

Файлы: `src/Controllers/KeybindingRegistry.ts`, `src/Controllers/Actions/*.ts`

### [ ] #2 Привязка меню к системе команд
Пункты меню сейчас содержат инлайн-коллбэки `onSelect` и хардкод `shortcut: "Ctrl+S"`. Нужно:
- Привязывать `MenuBarItem` напрямую к command ID
- Автоматически подтягивать shortcut из `KeybindingRegistry`
- Поддержать систему состояний пунктов меню: enabled/disabled, visible/hidden
- Возможно `when`-контекст (аналог VS Code `when` clause) для условного показа/скрытия

Файлы: `src/Controllers/AppController.ts`, `src/TUIDom/Widgets/MenuBarElement.ts`, `src/Controllers/CommandAction.ts`
