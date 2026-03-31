# Vexx — TODO

Трекер задач проекта. Каждая задача имеет статус, краткое описание и контекст.

Статусы: `[ ]` — открыта, `[~]` — в работе, `[x]` — сделана.

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
