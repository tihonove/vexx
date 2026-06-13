# Покрытие тестами — бэклог

Цель — покрыть весь реально исполняемый код. Правила, команда и что исключаем — в
[../TESTING.md → Покрытие](../TESTING.md#покрытие-coverage). Планка зафиксирована
храповиком `coverage.thresholds` (`autoUpdate`) в [vitest.config.ts](../../vitest.config.ts).

Смотреть текущую картину:

```bash
npm run test:coverage   # skipFull: показывает только недопокрытое
```

Ниже — реальный код, который пока недопокрыт. Сгруппирован по сложности. Отмечай
сделанное `[x]`, в работе — `[~]`.

---

## Easy — чистая логика, без моков

- [ ] `src/Input/mouseTracking.ts` — чистая функция генерации escape-последовательностей
- [ ] `src/Editor/IRange.ts` — `createRange`, `isRangeEmpty`, `rangeContainsPosition`
- [ ] `src/Editor/Tokenization/IState.ts` — `NULL_STATE` (`clone`/`equals`)
- [ ] `src/TUIDom/Widgets/IScrollable.ts` — `isContentSized`, `isScrollable` (type guards)
- [ ] `src/Common/TypingUtils.ts` — `reject`
- [ ] `src/TUIDom/Widgets/ScrollableElement.ts` — viewport-математика
- [ ] `src/Input/KeyInputParser.ts` — расширить существующий `*.test.ts`
- [ ] `src/Controllers/Actions/*` — декларативные экшены (`ClipboardActions`, `EditorEditActions`,
      `InputActions`, `ListActions`, `EditorActions`), тестируются с лёгким моком контроллера

## Medium — виджеты/контроллеры с моками

- [ ] `src/Controllers/InputWidgetController.ts` — мок `InputElement` + `IClipboard`
- [ ] `src/TUIDom/Widgets/ButtonElement.ts` — фокус/активация через TUI-харнесс
- [ ] `src/TUIDom/Widgets/MenuBarItemElement.ts` — мнемоники/активация

## Hard — системные/async/JSX

- [ ] `src/Controllers/Actions/AppActions.ts` — дёргает `process.exit` (нужен мок)
- [ ] `src/TUIDom/Widgets/ConfirmSaveDialogElement.tsx` — JSX-композиция + навигация по фокусу
- [ ] `src/Extensions/Host/ExtensionHost.ts` — async-управление subprocess (есть `*.test.ts`, добить ветки)

## Частично покрытые (70–99%)

Остальные файлы с покрытием 70–99% (виджеты, контроллеры, токенизация и пр.) видны в
`npm run test:coverage`. Добивать по мере касания соответствующего кода — храповик не даст
им регрессировать.
