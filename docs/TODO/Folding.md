# Folding — сворачивание кода (#86, #87)

Статус: `[~]` — indentation folding (end-to-end) сделан, см. [docs/arch/Editor.md](../arch/Editor.md) → Folding. Остальное ниже.

## Осталось

### [x] #87 Api extensions — `languages.registerFoldingRangeProvider` (#194)
Сделано в рамках #194. Провайдерный путь folding-range реализован по шаблону
completion-seam: `FoldingRange`/`FoldingRangeKind` раскомментированы в `vscode.d.ts` +
заведены value-типами (`vscodeTypes.ts`); RPC `languages.provideFoldingRanges` host↔subprocess
(`languagesNamespace.ts` / `wireTypes.ts` / `extensionHost.ts`); core-seam
`Editor/IFoldingSource.ts` + `EditorService.foldingRangeSource`, инъекция в
`ExtensionHostModule`. **Политика слияния — union (provider ∪ indentation, provider
выигрывает по общей `startLine`)** — по решению в #194 (безопаснее «provider замещает»:
не теряется indentation-folding для языков, где провайдер покрыл не всё; отклонение от
прежнего плана «приоритет provider + fallback»). Поздняя активация (провайдер появился
после openFile) пере-триггерит пересчёт через `ExtensionHost.onFoldingProvidersChanged`.
Стоковый `maptz.regionfolder` сворачивает `#region` — см. кейс ниже.

**Indent guides и провайдерские области.** Направляющая региона рисуется в колонке
отступа его заголовка. Для indentation-фолдов тело всегда глубже заголовка, поэтому
колонка гарантированно попадает в ведущий whitespace; у провайдерских областей это не
так — маркер `#region` стоит на том же отступе, что и обёрнутый код. Поэтому
`paintIndentGuides` проверяет отступ **каждой строки тела** и пропускает ячейку, если
направляющая легла бы на код (пустые строки её по-прежнему проносят). Демо —
`e2e/scenarios/regionFolding.scenario.ts` (кадр `rest`).

<details><summary>Исходный план #87 (для истории)</summary>

### [ ] #87 Api extensions — `languages.registerFoldingRangeProvider`
Расширения должны уметь поставлять области фолдинга (LSP / декларативно). Сейчас весь
блок закомментирован (`Extensions/Api/vscode.d.ts` ~строки 6980–7063 и 16436),
рантайма нет — `languages.registerFoldingRangeProvider` отсутствует. Объём сопоставим с
completion-seam'ом (WP8) — это **дословный шаблон**; цепочка файл-за-файлом:

1. **`Extensions/Api/vscode.d.ts`** — раскомментировать блок `FoldingRange`,
   `FoldingRangeKind` (`Comment=1, Imports=2, Region=3`), `FoldingContext`,
   `FoldingRangeProvider`, и `languages.registerFoldingRangeProvider`.
2. **`Host/Vscode/VscodeTypes.ts`** — рантайм `class FoldingRange` + `enum FoldingRangeKind`
   (рядом с `CompletionItem`/`CompletionItemKind`).
3. **`Host/VscodeNamespace.ts`** — добавить `FoldingRange`/`FoldingRangeKind` **по имени**
   в объект namespace (cast `as unknown as typeof vscode` прячет пропуски).
4. **`Host/Vscode/LanguagesNamespace.ts`** — по образцу `registerCompletionItemProvider`:
   `IFoldingRegistration`, `serializeFoldingRange`, `registerFoldingRangeProvider`, флаг
   `hasFoldingProviders` в `languages.updateSubscriptions`, и
   `rpc.handleRequest("languages.provideFoldingRanges", …)` — снапшот через
   `ExtHostDocuments.upsertFull({fileName,languageId,text})` → `matchDocumentSelector`
   (`Host/Vscode/DocumentSelector.ts`) → провайдеры в try/catch → `WireFoldingRange[]`.
   Reuse: `neverCancelledToken()`, `DisposableImpl`.
5. **`Host/WireTypes.ts`** — `WireFoldingRange {start,end,kind?}`, `parseWireFoldingRanges`,
   `wireToCoreFoldingRegions` (→ `Editor/IFoldingRegion.ts`, kind можно игнорировать для
   MVP), `requestFoldingRanges(request, params, timeoutMs)` на методе
   `"languages.provideFoldingRanges"`.
6. **`Host/ExtensionHost.ts`** — поле `foldingSubscribed`, ветка `hasFoldingProviders` в
   хендлере `languages.updateSubscriptions`, метод `provideFoldingRanges(req)`.
7. **Core-seam:** новый `Editor/IFoldingRangeSource.ts`
   (`IFoldingRequest {fileName,languageId,text}` + `type FoldingRangeSource =
   (req) => Promise<readonly IFoldingRegion[]>`); свойство `foldingRangeSource?` на
   `Workbench/Services/EditorService.ts`; инъекция
   `group.foldingRangeSource = (req) => host.provideFoldingRanges(req)` в
   `Workbench/Modules/ExtensionHostModule.ts` (и `TestUtils/ExtensionTestHarness.ts`).
8. **Слияние — `Workbench/Components/Editor/EditorComponent.recomputeFoldingRegions`:** сделать
   fire-and-merge внутри существующего `queueMicrotask`-дебаунса; **приоритет
   провайдерских областей, fallback на `computeIndentationFolds`, когда провайдер пуст**;
   `isCollapsed` переносить по `startLine` как сейчас (учти async-гонку — мержить на
   промисе, не синхронно).
- Тесты: `ExtensionTestHarness` + `*.cjs`-расширение с folding-провайдером.

</details>

### [x] Кейс: стоковое расширение Maptz `regionfolder` (Custom Folding) (#194)
Взят весь скоуп: `regionfolder@1.0.22` ставится из настоящего `.vsix`
(`e2e/fixtures/maptz-regionfolder/`), активируется по `onStartupFinished` и **полноценно
работает** — folding по `#region`, и команды. Сквозная проверка:
`extensionHost.maptzRegionfolder.test.ts` (реальный код расширения на реальном host'е).
- **Folding** — через #87 (см. выше).
- **Команды `wrapWithRegion`/`deleteRegion`/`removeCurrentRegionTags`/`selectCurrentRegion*`**
  — заработали: заведён editor-write API (`TextEditor.edit()` c `TextEditorEdit`,
  `editor.selection(s)` геттер/сеттер, `window.visibleTextEditors`, value-тип `Selection`).
  Правки едут хосту (`editor.applyEdit`) и применяются одним undoable-батчем; выделение —
  `editor.setSelection`.
- **`contributes.keybindings`** — читается (`ctrl+m ctrl+r` и `ctrl+shift+m ctrl+shift+r`
  регистрируются в `KeybindingRegistry`; см. `extensionKeybindingContributor.ts`).
- **Auto-collapse `collapseDefaultRegionsOnOpen`** — работает логикой самого расширения
  (FileMonitor → `collapseAllRegions` через `editor.fold`), без правок ядра.
- **Осталось вне скоупа:** `FoldingRangeKind` на `IFoldingRegion` (модель хранит только
  `startLine/endLine/isCollapsed`) — для `editor.foldAllMarkerRegions`; outline
  (`registerDocumentSymbolProvider`, по дефолту выключен); `WorkspaceConfiguration.update()`
  (расширению для фолдинга не нужен; live-reload конфига — no-op).

### [ ] Region-маркеры и language-configuration
`//#region`/`//#endregion` (и `folding.markers` из `language-configuration.json`),
плюс `offSide` (пустые строки завершают блок — Python/YAML). Сейчас `offSide`
игнорируется; провайдер чисто по отступам.

### [ ] `editor.showFoldingControls` + hover
VS Code по умолчанию `"mouseover"` — chevron'ы видны только при наведении мыши на
гуттер. Сейчас всегда `"always"` (проще и заметнее в TUI). Нужна hover-модель строки
гуттера и настройка `editor.showFoldingControls: always | mouseover | never`.

### [~] Рекурсивные и уровневые команды
Осталось: `editor.foldAllBlockComments`, `editor.foldAllMarkerRegions` /
`unfoldAllMarkerRegions` — требуют `FoldingRangeKind` на `IFoldingRegion` (comment/region
вид области), см. #87 и кейс `regionfolder` выше.

### [ ] `editor.foldBackground`
Подсветка фона свёрнутой строки-заголовка (в VS Code — полупрозрачный selection).
Требует альфа-композитинга поверх токен-фона; отложено.

### [ ] Персистентность свёрток
Сохранять состояние свёрток при переключении вкладок / переоткрытии файла
(в VS Code — по модели редактора). Сейчас область пересчитывается, `isCollapsed`
переносится по `startLine` только в пределах жизни редактора.
