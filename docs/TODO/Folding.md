# Folding — сворачивание кода (#86, #87)

Статус: `[~]` — indentation folding (end-to-end) сделан, см. [docs/arch/Editor.md](../arch/Editor.md) → Folding. Остальное ниже.

## Осталось

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
   `Controllers/EditorGroupController.ts`; инъекция
   `group.foldingRangeSource = (req) => host.provideFoldingRanges(req)` в
   `Controllers/Modules/ExtensionHostModule.ts` (и `TestUtils/ExtensionTestHarness.ts`).
8. **Слияние — `Controllers/EditorController.recomputeFoldingRegions` (≈756–771):** сделать
   fire-and-merge внутри существующего `queueMicrotask`-дебаунса; **приоритет
   провайдерских областей, fallback на `computeIndentationFolds`, когда провайдер пуст**;
   `isCollapsed` переносить по `startLine` как сейчас (учти async-гонку — мержить на
   промисе, не синхронно).
- Тесты: `ExtensionTestHarness` + `*.cjs`-расширение с folding-провайдером.

### [ ] Кейс: стоковое расширение Maptz `regionfolder` (Custom Folding)
Проверяли, взлетит ли `regionfolder` (engine `^1.76.0`, `onStartupFinished`) без правок
самого расширения. Итог: **достаточно #87, чтобы оно активировалось и его #region-
свёртки отображались**.
- **Уже работает стоково:** регистрация/выполнение 8 команд (`commands.registerCommand`);
  чтение конфига `maptz.regionfolder` (`getConfiguration.get/has/inspect`,
  `onDidChangeConfiguration`/`affectsConfiguration`, contributed-дефолт `{}` через
  `WorkspaceConfigStore.applyDefaults` до `activate()`); `activate(context)` (жадная
  активация — `activationEvents` игнорируются, для `onStartupFinished` ок; `context`
  даёт `subscriptions`).
- **Блокер:** `Engine` расширения зовёт `languages.registerFoldingRangeProvider` →
  `activate()` падает `TypeError`, пока не сделан #87.
- **Вне скоупа (для «просто взлетел» не нужно, крупные отдельные пласты):**
  - редактируемый extension-`TextEditor` API (`editor.edit()`/`selection(s)`/
    `revealRange`) — команды `wrapWithRegion`/`deleteRegion`/`removeCurrentRegionTags`/
    `selectCurrentRegion*` зарегистрируются, но их действия не заработают;
  - `FoldingRangeKind` на `IFoldingRegion` (модель хранит только `startLine/endLine/
    isCollapsed`) — нужно для команд `collapseAllRegions`/`collapseDefault` и
    `editor.foldAllMarkerRegions`/`unfoldAllMarkerRegions`;
  - outline: `languages.registerDocumentSymbolProvider` (опциональная фича расширения при
    `showRegionsInOutline`, по дефолту выключена);
  - host не читает `contributes.keybindings` расширения (2 бинда не подхватятся);
  - `WorkspaceConfiguration.update()` — no-op (расширению для фолдинга не нужен).

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
