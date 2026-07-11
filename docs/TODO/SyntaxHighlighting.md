# Подсветка синтаксиса

**Статус**: TextMate-движок работает (vscode-textmate + oniguruma), hot-swap токенайзера сделан; остались scope-селекторы, async/background токенизация.

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
Подключён настоящий TextMate-парсер (`vscode-textmate` + `vscode-oniguruma`): адаптер в `src/Editor/Tokenization/textmate/`, грамматики поставляются builtin-расширениями (см. [Extensions.md](Extensions.md)), регистрация в `main.ts` с fallback на `WordTokenizer`/`PlainTextTokenizer`, защита от ReDoS (строки >20K — один root-токен). В production пакуется в `dist/vexx.bundle` через `IAssetAccess`. Детали: [ARCHITECTURE.md](../ARCHITECTURE.md) → Editor/Tokenization.

Открытый вопрос: бинарный API `tokenizeLine2` (быстрее, но требует переделки рендера на работу с metadata) — пока не используется.

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
Реализовано в рамках [Extensions.md](Extensions.md) Phase 1: `ILanguageService` в `Editor/Tokenization/`, `LanguageRegistry` в `Extensions/`. `EditorController.resolveLanguageId` ходит через DI-токен `LanguageServiceDIToken`; результат хранится на документе (`ITextDocument.languageId`, дефолт `plaintext`). Поддерживаются `extensions`, `filenames`, `filenamePatterns` (минимальный glob).

Осталось (отдельными подзадачами):

- [ ] **Шебанг** (`firstLine`): в манифесте типизировано, но в `LanguageRegistry.getLanguageIdForResource` не используется. Требует расширения API (принять `firstLine`).
- [ ] **mimetypes** — типизировано, не используется.
- [ ] **VS Code-style modeline** (`vim: set filetype=...`) — отдельная задача.
- [ ] **`filenamePatterns` с `/`** (например `**/.gitconfig`) не матчатся: `matchGlob` сравнивает только basename. Pre-existing ограничение, стало заметнее с полным набором языковых паков.
- [ ] **Команда `editor.action.changeLanguage`** — UI-пикер поверх готовой закладки: `EditorController.setLanguage(langId)` уже меняет язык документа и пересаживает токенизатор; языки для пикера — `LanguageRegistry.allLanguages()`.

### [x] Hot-swap токенайзера
Реализовано на уровне `EditorController`, а не `DocumentTokenStore` (store не знает про languageId — он у документа): контроллер подписан на `TokenizationRegistry.onDidChange(languageId)` и на `document.onDidChangeLanguage`; при совпадении с языком текущего документа вызывает `DocumentTokenStore.setTokenizationSupport` (полная инвалидация кеша) + `markDirty`. Закрыт пробел «файл открыт до async-загрузки грамматики → навсегда PlainTextTokenizer».

### [x] Cache scope-to-style на смене темы
`TokenThemeResolver.setTheme(tokenTheme)` пересобирает правила и чистит кеш по `scopes.join(" ")`. `main.ts` подписывает его на `ThemeService.onThemeChange`, поэтому смена цветовой темы (пикер / live preview) перекрашивает и синтаксис. Per-frame кеш в `EditorElement.render` самоочищается; редактор перерисовывается своим `onThemeChange` (deferred render — резолвер к этому моменту уже свежий). Тест — `TokenThemeResolver.test.ts` → «setTheme (color-theme swap)». Детали — [Theming.md](Theming.md).

### [ ] Bracket pair colorization (низкий приоритет)
VS Code держит отдельный bracket pair index поверх токенов. Можно отложить до полного TM. Точка интеграции — `TokenIndex` в `EditorElement.render` мог бы дополнительно отдавать bracket-level для оверрайда цвета.

## Связанные файлы

- `src/Editor/Tokenization/` — все интерфейсы и реализации
- `src/Theme/Tokenization/TokenThemeResolver.ts` — резолвер скоупов
- `src/Editor/EditorElement.ts` — `TokenIndex`, `packStyleFlags`, рендеринг с цветами
- `src/Controllers/EditorController.ts` — wiring per-document store
- `src/main.ts` — регистрация встроенных токенайзеров
