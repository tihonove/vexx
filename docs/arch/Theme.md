# Theme/

Часть архитектуры Vexx — обзорная карта в [../ARCHITECTURE.md](../ARCHITECTURE.md).

Система темизации, совместимая с VS Code theme files. Активная тема — `WorkbenchTheme` за `ThemeService` (`ThemeServiceDIToken`), хранит packed RGB + правила подсветки синтаксиса. Контроллеры применяют цвета через `applyTheme()`, компоненты Workbench — через хук `applyStyles()` базы `Component`; переприменение — по `ThemeService.onThemeChange`. TUIDom про темы не знает.

> **Механизм «color-props + applyXxxTheme» (канон).** Контрол TUIDom несёт **plain color-props** (плоские поля, как `ButtonElement.normalBg`, либо сгруппированный объект, как `MenuColors`/`ScrollBarColors`) с theme-less дефолтами — и **не имеет** метода `applyTheme(WorkbenchTheme)` и импортов из `Theme/*`. Маппинг темы в color-props живёт на стороне приложения: free-function `applyXxxTheme(control, theme)` / `xxxColorsFromTheme(theme)` рядом с `Controllers/applyScrollBarTheme.ts` (`applyButtonTheme`, `menuColorsFromTheme`), вызывается владельцем контрола из `applyTheme`/`applyStyles`. Прямая аналогия vscode: `IButtonStyles` + `unthemedButtonStyles` (base) и `defaultButtonStyles` (platform/theme).

> **Правило работы с цветами (единственная система цветов).** Все цвета UI берутся **только** из активной темы через `theme.getColor(key)` / `theme.getRequiredColor(key)`. Никаких цветовых литералов в контроллерах/виджетах и никаких инлайн-фоллбэков. Цвета, которых нет в JSON-темах VS Code (они из code-based color registry), задаёт наш реестр `defaultColors.ts`. Новый цвет добавляется **в одном месте**: ключ в `IWorkbenchColors` + дефолт (dark/light) в `defaultColors.ts`. Исключение — widget-baseline константы для элементов без темизируемого ключа VS Code.

Enforcement и разрешение цветов:
- `getColor(key) → number | undefined` (опциональные цвета потребитель обрабатывает сам); `getRequiredColor(key) → number` — **кидает**, если цвета нет ни в теме, ни в дефолтах. То есть используемый required-цвет обязан иметь дефолт (покрытие проверяет `defaultColors.test.ts`).
- `WorkbenchTheme.fromThemeFile(json)` слоит дефолты **под** цвета темы (тема побеждает) и парсит hex→packRgb.
- `ThemeRegistry` (`ThemeRegistryDIToken`) — реестр тем по label, `resolve`/`list`; точка расширения под `contributes.themes` (см. [../TODO/Theming.md](../TODO/Theming.md)).
- `themes/` — встроенные темы, импортированы **verbatim** из microsoft/vscode и **разреженные**: неопределённые цвета приходят из `defaultColors.ts`, поэтому дописывать их руками не нужно (перезатрётся при ре-импорте).

Выбор темы: `main.ts` читает `workbench.colorTheme` → `ThemeRegistry.resolve` (неизвестное имя → `DEFAULT_COLOR_THEME`). Рантайм-смена — команда `workbench.action.selectTheme`: quick-pick с **live preview**, Enter применяет и persist'ит через `IConfigurationService.updateUserValue`, Escape откатывает.

**Зависимости:** Theme → Rendering (ColorUtils/packRgb), Common. Находится на одном уровне с Controllers.
