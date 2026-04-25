# Подсветка синтаксиса

**Статус**: каркас готов, есть встроенный заглушечный токенайзер.

Архитектура повторяет VS Code:

```
ITokenizationSupport ── ┐
       │                │
       ▼                ▼
DocumentTokenStore   TokenizationRegistry (DI)
       │
       ▼
EditorElement.render() ── ITokenStyleResolver ── (Theme) TokenThemeResolver
```

См. секцию **Editor/Tokenization/** в [docs/ARCHITECTURE.md](../ARCHITECTURE.md).

## Что уже сделано

- [x] Интерфейсы `IState`, `ITokenizationSupport`, `ILineTokens` (TextMate scopes), `ITokenStyleResolver`
- [x] `TokenizationRegistry` — DI-сервис languageId → support
- [x] `DocumentTokenStore` — per-document кеш с инвалидацией, шифтингом и end-state оптимизацией
- [x] `TextDocument.onDidChangeContent` — структурные события для всех per-document сервисов
- [x] `PlainTextTokenizer`, `WordTokenizer` — встроенные заглушки
- [x] `TokenThemeResolver` — TextMate scope → стиль (longest-prefix match по dot-сегментам)
- [x] `EditorElement.render()` применяет резолвленный fg/bg/fontStyle к каждой ячейке

## Подзадачи

### [x] Полный TextMate-движок
Подключить настоящий TextMate-парсер вместо `WordTokenizer`. Грамматика на YAML/plist, состояние = stack of rules. Принимать `.tmLanguage.json` файлы.

**Что сделано:**
- Зависимости: `vscode-textmate` + `vscode-oniguruma` (MIT, без нативных биндингов).
- Адаптер: `src/Editor/Tokenization/textmate/` — `OnigLib`, `TextMateState`, `TextMateTokenizationSupport`, `TextMateGrammarLoader`.
- Встроенные языки и маппинг расширений поставляются builtin-расширениями из `src/Extensions/builtin/` (см. [Extensions.md](Extensions.md)); резолвит `LanguageRegistry implements ILanguageService`.
- Регистрация в `main.ts` через `TextMateGrammarLoader.loadSupport(scope)` для всех `BUILTIN_LANGUAGES`. Async-загрузка дожидается `await grammarsLoading` до открытия первого файла. На ошибку грамматики — fallback на `WordTokenizer`/`PlainTextTokenizer`.
- Защита от ReDoS: строки длиннее 20K символов отдаются одним root-токеном без вызова oniguruma.
- Тесты: 20 учебных тестов на сам `vscode-textmate` (Registry, tokenizeLine, multiline state, tokenizeLine2, jsdoc injections) + 7 на адаптер + 15 на language detection.

**Открытые вопросы:**
- Стратегия загрузки `onig.wasm` и `.tmLanguage.json` в production-сборке (сейчас читается из `node_modules` через `import.meta.url`; для SEA/`tsup` нужно копирование в `dist/`).
- Бинарный API `tokenizeLine2` (быстрее, но требует переделки рендера на работу с metadata) — пока не используется.

### [ ] Полный TextMate-движок (заархивированный план)

**План реализации:**
1. **Зависимости.** `vscode-textmate` + WASM-движок regex (`vscode-oniguruma` или `onigasm`). Оба — npm-пакеты, MIT, без нативных биндингов. Проверить размер бандла WASM (~300 КБ); для CLI/SEA — норм.
2. **Адаптер.** `src/Editor/Tokenization/textmate/TextMateTokenizationSupport.ts` реализует наш `ITokenizationSupport` поверх `vscode-textmate` `IGrammar.tokenizeLine()` (binary `tokenizeLine2()` быстрее, но придётся декодировать metadata; для старта — обычный API со scope-стеками).
3. **State.** У `vscode-textmate` есть `StateStack` (immutable). Наш `IState` требует `clone()`/`equals()` — обернуть `StateStack` в адаптер. `equals` есть из коробки, `clone` бесплатный (immutable).
4. **Загрузчик грамматик.** `Registry({ loadGrammar(scopeName) → tmLanguage.json })`. Для встроенных языков — bundled `.tmLanguage.json` (взять из VS Code-репо). Маппинг `languageId → scopeName`.
5. **Где регистрировать.** В `main.ts` рядом с текущим `WordTokenizer`, через async `registry.loadGrammar()` → `TokenizationRegistry.register(languageId, support)`. Регистрация вызовет `onDidChange` — см. ниже про hot-swap.
6. **Тесты.** Снапшот-тесты на короткие фрагменты JS/TS/JSON: input → массив `{startIndex, scopes}`. Стили не сравнивать (это уже в `TokenThemeResolver`).

**Граничные случаи:**
- Очень длинные строки: у `vscode-textmate` есть таймаут / лимит. Прокинуть лимит в `tokenizeLine` и при превышении возвращать один токен `["text"]` для строки.
- `endState` после splice: `DocumentTokenStore` уже хранит endStates по соседям и вызывает `equals` для convergence — TextMate stack тут просто другой объект, особых хуков не нужно.

### [ ] Полный TextMate scope selector matcher
Сейчас `TokenThemeResolver` поддерживает только longest-prefix scope match по dot-сегментам. Добавить:

- **Parent selectors** (`meta.foo bar` — match если в скоуп-стеке есть `meta.foo`, и текущий — `bar.*`).
- **Exclusion** (`-bar`, `text -comment`).
- **Множественные селекторы через запятую** уже работают (`compileRules` разворачивает).
- **Weighted scoring**: TextMate-спека считает вес селектора как `(specificity, depth)` — важно когда два правила одинаково подходят.

**План:**
1. Заменить `scopeMatches(rule, scope)` на парсер селектора → структура `{ scopes: string[], excludes: string[] }`.
2. `resolve(scopeStack)` уже принимает массив (top-down). Перейти на bottom-up для матчинга parent-селекторов: для каждого правила проверить «совпадает ли паттерн с подпоследовательностью стека».
3. Скоринг: сейчас сортируем по `segments` desc + `order` desc. Добавить третий ключ — `parentDepth` (длина совпавшей подпоследовательности).
4. **Тесты:** `TokenThemeResolver.ScopeSelectors.test.ts` (parent), `TokenThemeResolver.Exclusion.test.ts`. Кейсы из VS Code (`vs/editor/test/common/modes/supports/tokenization.test.ts`) — хорошая база.

**Что не делать:** полный TM scope selector grammar (group, `|` внутри селектора) — этого нет даже у VS Code. Достаточно того, что использует Dark+/Light+.

### [ ] Async-токенизация (LSP semantic tokens)
Расширить пайплайн новым источником токенов поверх синхронного TM.

**План:**
1. Новый интерфейс `ISemanticTokensProvider`:
   ```ts
   interface ISemanticTokensProvider {
       provideTokens(document, range): Promise<ISemanticTokens>;
   }
   ```
   Регистрируется через отдельный `SemanticTokensRegistry` (по аналогии с `TokenizationRegistry`).
2. В `DocumentTokenStore` добавить второй слой кеша `semanticTokens: ISemanticToken[][]` и метод `mergeSemanticTokens(range, tokens)`. Семантика рендера: TM-токены — базовый цвет, семантические — оверрайд (как в VS Code).
3. **Не блокировать sync catch-up.** Async-результат приходит позже — при инвалидации участка отбрасывается (stale). Хранить `version: number` документа на момент запроса.
4. **Триггер:** debounced по `onDidChangeContent` (~300 мс idle), запрос на видимый range.
5. В `EditorElement.render` добавить ещё одну стадию: после `TokenIndex.tokenAt(offset)` — `SemanticTokenIndex.overrideAt(offset)`. Если оверрайд есть — резолвить его scope тем же `ITokenStyleResolver`.

**Тесты:** мок-провайдер, проверка что late-arriving tokens с устаревшей версией не применяются.

### [ ] Background tokenization (chunked)
Сейчас `tokenizeUpTo(target)` синхронный. На больших файлах блокирует render.

**План:**
1. В `DocumentTokenStore` метод `scheduleBackgroundTokenization()`. В Node — `setImmediate`.
2. Каждая итерация — фиксированный budget (5 мс или 200 строк), потом yield. После yield — продолжить с `invalidLineIndex` (если что-то снова инвалидировалось).
3. **Не дублировать работу с render.** Если `EditorElement.render` уже вызвал `tokenizeUpTo(visibleEnd)` — фоновая задача начинает с `max(visibleEnd, invalidLineIndex)`.
4. **Сигнал «весь документ затокенизирован»:** event `onDidTokenizeAll`. Полезно для feature вроде «document symbols» из токенов.

**Граничный случай:** end-state convergence уже умеет «пропустить хвост». Если фоновая задача доходит до места, где endState не изменился, она прекращает работу досрочно (текущая логика и так это делает).

### [x] Language detection service
Реализовано в рамках [Extensions.md](Extensions.md) Phase 1: `ILanguageService` в `Editor/Tokenization/`, `LanguageRegistry` в `Extensions/`. `EditorController.pickTokenizer` ходит через DI-токен `LanguageServiceDIToken`. Поддерживаются `extensions`, `filenames`, `filenamePatterns` (минимальный glob).

Осталось (отдельными подзадачами):

- [ ] **Шебанг** (`firstLine`): в манифесте типизировано, но в `LanguageRegistry.getLanguageIdForResource` не используется. Требует расширения API (принять `firstLine`).
- [ ] **mimetypes** — типизировано, не используется.
- [ ] **VS Code-style modeline** (`vim: set filetype=...`) — отдельная задача.
- [ ] **Команда `editor.action.changeLanguage`** — ручная смена языка с пересозданием `DocumentTokenStore`.

### [ ] Hot-swap токенайзера
При смене языка пользователем (или установке нового tokenizer-а через `TokenizationRegistry.register`) — пересоздать токенизатор у `DocumentTokenStore`. Сейчас `TokenizationRegistry.onDidChange` существует, но `DocumentTokenStore` на него не подписан.

**План:**
1. В `DocumentTokenStore` подписаться на `tokenizationRegistry.onDidChange(languageId)`. Если меняется текущий languageId документа — вызвать `setTokenizationSupport(newSupport)`. Подписка диспозится вместе со store.
2. `setTokenizationSupport`: сбросить `cachedTokens`, `endStates`, `invalidLineIndex = 0`. Следующий `tokenizeUpTo` — с нуля.
3. Команда `editor.action.changeLanguage` (для пользователя): отдельная задача. Архитектурно — `EditorController.changeLanguage(langId)` пересоздаёт store с другим languageId.

### [ ] Cache scope-to-style на смене темы
`TokenThemeResolver` создаётся один раз и держит свой кеш по `scopes.join(" ")`.

**План:**
1. При смене темы (`themeService.onThemeChange`) — `main.ts` биндинг должен пересоздавать `TokenThemeResolver` (или у резолвера должен быть `setTheme(tokenTheme)`, который чистит кеш).
2. Per-frame кеш в `EditorElement.render` — самоочищается, отдельных действий не нужно.
3. После смены темы — `editor.scheduleRender()` (уже триггерится из `themeService.onThemeChange` в `EditorController`).

**Тест:** `TokenThemeResolver.ThemeSwap.test.ts` — установить scope, запросить style, поменять тему через `setTheme`, убедиться что вернулся новый цвет.

### [ ] Bracket pair colorization (низкий приоритет)
VS Code держит отдельный bracket pair index поверх токенов. Можно отложить до полного TM. Точка интеграции — `TokenIndex` в `EditorElement.render` мог бы дополнительно отдавать bracket-level для оверрайда цвета.

## Связанные файлы

- `src/Editor/Tokenization/` — все интерфейсы и реализации
- `src/Theme/Tokenization/TokenThemeResolver.ts` — резолвер скоупов
- `src/Editor/EditorElement.ts` — `TokenIndex`, `packStyleFlags`, рендеринг с цветами
- `src/Controllers/EditorController.ts` — wiring per-document store
- `src/main.ts` — регистрация встроенных токенайзеров
