# Folding — сворачивание кода (#86, #87)

Статус: `[~]` — первая подфича (indentation folding, end-to-end) сделана; остальное ниже.

## Сделано (подфича 1)

Indentation-based фолдинг «под ключ», как дефолт VS Code:
- Модель: `EditorViewState` (`IFoldingRegion`, проекция видимых строк, toggle/fold/unfold(All), навигация сквозь свёртки, `adjustFoldingRegionsForEdits`, reveal). Была в репозитории; добавлены `foldingRegionContaining`/`foldRegionContaining`/`unfoldRegionContaining`/`toggleFoldContaining` (операции у курсора).
- Провайдер: `Editor/FoldingRangeProvider.ts` — `computeIndentationFolds(document, tabSize)`.
- Интеграция: `EditorController` пересчитывает области при открытии и на `onDidChangeContent` (микротаск после сдвига существующих областей), сохраняя `isCollapsed`.
- Рендер: chevron в гуттере (`editorGutter.foldingControlForeground`) + inline-маркер `⋯`; клик по chevron'у тоглит область.
- Команды/бинды: `editor.fold` (`ctrl+shift+[`), `editor.unfold` (`ctrl+shift+]`), `editor.toggleFold` (`ctrl+k ctrl+l`), `editor.foldAll` (`ctrl+k ctrl+0`), `editor.unfoldAll` (`ctrl+k ctrl+j`) — `Controllers/Actions/FoldingActions.ts`.

## Осталось

### [ ] #87 Api extensions — `languages.registerFoldingRangeProvider`
Расширения должны уметь поставлять области фолдинга (LSP / декларативно). Объём —
сопоставим с completion-seam'ом (WP8):
- Раскомментировать в `Extensions/Api/vscode.d.ts` **дословно** блок `FoldingRange`,
  `FoldingRangeKind`, `FoldingContext`, `FoldingRangeProvider`,
  `registerFoldingRangeProvider` (+ зависимости closure).
- Runtime-типы (`FoldingRange`, enum `FoldingRangeKind`) в `Host/Vscode/VscodeTypes.ts`;
  `LanguagesNamespace.registerFoldingRangeProvider` + host-запрос
  `languages.provideFoldingRanges` (по образцу `provideCompletionItems`): снапшот
  документа → матч `DocumentSelector` → вызов провайдеров → сериализация
  `WireFoldingRange[]`.
- Host-сторона: seam в `EditorController`/`EditorGroupController`
  (`foldingRangeSource?`), инъекция в `Controllers/Modules/ExtensionHostModule.ts`.
- Слияние источников: провайдерские области поверх/вместо indentation-дефолта
  (в VS Code — приоритет по `FoldingRangeProvider`, fallback на indentation).
- Тесты: `ExtensionTestHarness` + `*.cjs`-расширение с провайдером.

### [ ] Region-маркеры и language-configuration
`//#region`/`//#endregion` (и `folding.markers` из `language-configuration.json`),
плюс `offSide` (пустые строки завершают блок — Python/YAML). Сейчас `offSide`
игнорируется; провайдер чисто по отступам.

### [ ] `editor.showFoldingControls` + hover
VS Code по умолчанию `"mouseover"` — chevron'ы видны только при наведении мыши на
гуттер. Сейчас всегда `"always"` (проще и заметнее в TUI). Нужна hover-модель строки
гуттера и настройка `editor.showFoldingControls: always | mouseover | never`.

### [ ] Рекурсивные и уровневые команды
`editor.foldRecursively` (`ctrl+k ctrl+[`), `editor.unfoldRecursively` (`ctrl+k ctrl+]`),
`editor.foldAllBlockComments`, `editor.foldLevelN` (`ctrl+k ctrl+<1..7>`),
`editor.foldAllMarkerRegions` / `unfoldAllMarkerRegions`.

### [ ] `editor.foldBackground`
Подсветка фона свёрнутой строки-заголовка (в VS Code — полупрозрачный selection).
Требует альфа-композитинга поверх токен-фона; отложено.

### [ ] Персистентность свёрток
Сохранять состояние свёрток при переключении вкладок / переоткрытии файла
(в VS Code — по модели редактора). Сейчас область пересчитывается, `isCollapsed`
переносится по `startLine` только в пределах жизни редактора.
