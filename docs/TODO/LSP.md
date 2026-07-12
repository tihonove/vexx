# LSP — спайк «завести стоковый language server»

Статус: **[x] встроено в vexx (dev)** — TypeScript-диагностики работают в обычном
`npm start` без флагов: открой `.ts` с ошибкой (Quick Open / файл-дерево) → squiggle в
редакторе + запись в панели Problems. Проверено на самом репозитории. Ветка `worktree-lsp-spike`.

Включено по умолчанию; выключить — `VEXX_LSP_DISABLE=1`. Расширение-клиент:
`src/Extensions/builtinLsp/tsLanguageClient.cjs`, регистрируется в `main.ts`.
Быстрый визуальный прогон: `npm run spike:lsp:app` (песочница) или
`VEXX_DEMO_WS=. VEXX_DEMO_QUERY=<файл> VEXX_DEMO_TIMEOUT=120000 npm run spike:lsp:app` (репозиторий).

## Что проверяли

Гипотеза: language server поднимает **не ядро**, а **стоковое расширение** через
`vscode-languageclient` (сам спавнит сервер, сам гоняет JSON-RPC, прокидывает результаты
через `vscode` API). Значит достаточно **дописать в наш `vscode`-стаб** то, что дёргает
стоковый languageclient — и стоковый сервер взлетит. Хотели: (а) взлетит ли сервер и
отдаст ли что-то; (б) оценить масштаб интервенции.

## Результат — ДА, взлетает

`npm run spike:lsp` поднимает **реальный** ExtensionHost (через тест-харнесс),
регистрирует фикстуру-расширение `startsLanguageClient.cjs`, которая стоковым
`vscode-languageclient@10` спавнит `typescript-language-server@5 --stdio`:

```
[spike] server initialized. definitionProvider = true
[spike] definition → [{ … targetUri: …/lspSample/defs.ts,
                        targetSelectionRange:{start:{line:0,character:16}, …} }]
```

- Сервер **заспавнен и прошёл `initialize`** (получили capabilities).
- Кросс-файловый **go-to-definition реально отработал**: из `lspSample/main.ts` уехал в
  `lspSample/defs.ts` (на объявление `greet`).
- После `dispose()` сервер-внук корректно убит (нет осиротевших процессов).
- Весь LSP-протокол — внутри стокового languageclient; **своего кода протокола ноль**.

## Масштаб интервенции (что застабали)

Правки только в настоящем `vscode`-стабе, **~540 добавленных строк**, всё наивное
(no-op / EventEmitter / простые value-классы):

- **`Vscode/VscodeTypes.ts`** (~335 стр) — value-типы, которые languageclient `extends`-ит
  ещё на этапе `require` (protocol*-конвертеры) и конструирует на результатах:
  классы `Location, Diagnostic, CodeLens, CodeAction, CodeActionKind, DocumentLink,
  InlayHint, SymbolInformation, CallHierarchyItem, TypeHierarchyItem, CancellationError,
  CancellationTokenSource, MarkdownString, Hover, WorkspaceEdit`; enum'ы `LogLevel,
  ProgressLocation, DiagnosticSeverity, DiagnosticTag, CompletionItemTag,
  DocumentHighlightKind, FoldingRangeKind, SymbolKind, SymbolTag`.
- **`Vscode/LanguagesNamespace.ts`** — `createDiagnosticCollection` (наивная), `match`,
  и ~28 `register*Provider` no-op'ов (definition в спайке дёргается сырым запросом мимо
  провайдера).
- **`Vscode/WorkspaceNamespace.ts`** — `onDidChangeTextDocument` + ещё 11 никогда-не-фаерящих
  событий (files/notebook/workspaceFolders), `applyEdit`, `getWorkspaceFolder`,
  `createFileSystemWatcher`, `registerTextDocumentContentProvider`, `notebookDocuments`.
- **`Vscode/WindowNamespace.ts`** — `withProgress`, `visibleTextEditors`,
  `onDidChangeVisibleTextEditors`, `tabGroups`, `showTextDocument`, + `LogOutputChannel`-методы
  на `createOutputChannel`.
- **`VscodeNamespace.ts`** — namespace `env` (`language/appName/clipboard/openExternal`),
  регистрация всех новых типов; **`version` поднят до `1.127.0`** (languageclient требует
  валидный VS Code semver `^1.91.0`; держим в лок-степе с `builtin/VSCODE_VERSION`).

**Не понадобилось** (важно для оценки): богатый `ExtensionContext` (`asAbsolutePath`/
`extensionUri`) и namespace `extensions` — фикстура отдаёт путь к серверу напрямую, а не
резолвит его через контекст, как это делает встроенное TS-расширение.

## Артефакты спайка

- `src/demos/lspSpike.ts` — раннер (`npm run spike:lsp`).
- `src/Extensions/Host/__fixtures__/startsLanguageClient.cjs` — фикстура-расширение.
- `src/Extensions/Host/__fixtures__/lspSample/{defs.ts,main.ts,tsconfig.json}` — sample-проект.
- devDeps: `typescript-language-server`, `vscode-languageclient`.

## Интеграция в реальное приложение (диагностики) — ГОТОВО

Диагностики стокового `typescript-language-server` теперь видны в **настоящем** редакторе:
`npm run spike:lsp:app` поднимает `tsx src/main.ts` headless, открывает .ts с ошибкой типов
и снимает PNG (`screenshots/lsp-diagnostics.png`) — squiggle под `answer` + панель Problems:
`Type 'string' is not assignable to type 'number'. [Ln 2, Col 7]`.

Проводка (пере)использует существующий pipeline ошибок, ничего в нём не меняя:
- **Сток диагностик**: `languages.createDiagnosticCollection().set(uri, diags)` (стаб) →
  notify `diagnostics.publish` → `ExtensionHost` (опция `diagnosticsSink`) →
  `MarkerService.changeOne(owner, resource, markers)`. Потребители (squiggle в
  `EditorElement`, дерево Problems) уже слушают `MarkerService.onDidChangeMarkers` —
  правок в них не потребовалось. Проводка sink → `Controllers/Modules/ExtensionHostModule.ts`.
- **core→host document sync** (нужен languageclient): `ExtensionHost.didOpenTextDocument/
  didChangeTextDocument` → notify `editor.didOpen`/`didChange` → `WorkspaceNamespace` фаерит
  `onDidOpenTextDocument`/`onDidChangeTextDocument` с реальным текстом (full-range change).
  Пуш заводится в `ExtensionHostModule` (active-editor + `onDidChangeContent`); плюс
  `ExtensionHost` пушит `editor.didOpen` активного документа на готовности subprocess'а,
  чтобы `workspace.textDocuments` был заполнен ДО активации расширения.
- **Активация**: `main.ts` регистрирует `builtinLsp/tsLanguageClient.cjs`
  (fire-and-forget `client.start()`) при старте, если не задан `VEXX_LSP_DISABLE=1`.

**Ключевые грабли (запомнить для продуктивизации):**
- `vscode-languageclient` шлёт `didOpen` только для **видимых** документов
  (`VisibleDocumentsImpl.fillVisibleResources` читает `window.visibleTextEditors`). Наш стаб
  возвращал `[]` → сервер не получал документ → 0 диагностик. Фикс: `window.visibleTextEditors`
  отдаёт активный редактор.
- push-диагностики конвертируются через `p2c.asDiagnostics`; ошибка конвертации логируется
  **только** в `client.outputChannel` (у нас no-op) — молча теряется. Для дебага в фикстуре
  есть `VEXX_LSP_TRACE=1` (verbose LSP-трасса + outputChannel в stdout).
- Запуск dev-приложения из чужого cwd: node не резолвит `tsx/esm` из песочницы без
  node_modules (передаём loader абсолютным file-URL), а tsx подхватывает `tsconfig.json`
  из cwd — форсим репозиторный через `TSX_TSCONFIG_PATH` (иначе `.tsx` падает «React is not
  defined»). tsserver при этом использует свой tsconfig. См. `e2e/lspDiagnostics.demo.ts`.

## Что осталось за рамками (для настоящей интеграции)

- **Ленивая активация**: сейчас клиент стартует на каждом `npm start` (даже без TS-файлов) —
  сервер грузит проект по cwd. Надо поднимать сервер по факту открытия `.ts` (activationEvents).
  На большом репозитории первые диагностики появляются с задержкой (tsserver индексирует проект).

- **Тесты + coverage-храповик**: наивные стабы в `Window/Workspace/LanguagesNamespace`,
  `VscodeTypes` пока без тестов → `npm run test:coverage` покраснеет. `npm run typecheck`
  и `npm test` (без coverage) зелёные; тронутые namespace-тесты (60 шт.) проходят.
- **core→host document sync**: сейчас хост знает `uri`/`languageId` на active-editor-change,
  текст — только на save/completion. В спайке документ скармливается серверу **сырым
  `didOpen` из фикстуры**; живого буфера редактора сервер ещё не видит. Нужен push
  `didOpen`/`didChange` (+ позиция курсора) из `EditorController`.
- **Проводка результатов в UI**: диагностики → `Editor/Markers/MarkerService`; go-to-def →
  `EditorController.goToPosition`/`revealRange`; хостинг languageclient-расширения как
  настоящего builtin в `main.ts` (сейчас host стартует без расширений).
- **Рантайм-зависимость / SEA**: сервер и его deps должны лежать реальным `node_modules`
  (не в SEA-блобе).
