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

### [ ] Полный TextMate-движок
Подключить настоящий TextMate-парсер (vscode-textmate + onig-asm/oniguruma-to-es) вместо `WordTokenizer`. Грамматика на YAML/plist, состояние = stack of rules. Принимать `.tmLanguage.json` файлы.

### [ ] Полный TextMate scope selector matcher
Сейчас `TokenThemeResolver` поддерживает только longest-prefix scope match. Добавить:
- parent selectors (`meta.foo bar`)
- exclusion (`-bar`, `text -comment`)
- weighted scoring по правилам TextMate

### [ ] Async-токенизация (LSP semantic tokens)
Расширить `ITokenizationSupport` методом для асинхронного источника (`tokenizeLineAsync` или отдельный `ISemanticTokensProvider`). `DocumentTokenStore` должен уметь принимать поздние результаты и не перетирать их при синхронной до-токенизации (через `setLineTokens` с пометкой источника).

### [ ] Background tokenization (chunked)
Сейчас `tokenizeUpTo` синхронный — на больших файлах это блокирует render. Сделать chunked-tokenizer на `setImmediate`/`queueMicrotask`, который догоняет видимый viewport синхронно, а фон — порциями.

### [ ] Language detection service
Сейчас `EditorController.pickTokenizer` хардкодит сопоставление расширения → languageId. Вынести в отдельный сервис (`ILanguageService`) с правилами по расширению, shebang-у и mime-type. Учесть `language` из VS Code-style frontmatter.

### [ ] Hot-swap токенайзера
При смене языка пользователем (или установки нового tokenizer-а через `TokenizationRegistry.register`) — пересоздать `DocumentTokenStore` или вызвать `setTokenizationSupport`. Сейчас `TokenizationRegistry.onDidChange` существует, но `DocumentTokenStore` на него не подписан.

### [ ] Cache scope-to-style на смене темы
Сейчас `TokenThemeResolver` создаётся один раз и держит свой кеш. При смене темы (`themeService.onThemeChange`) надо пересоздать резолвер и инвалидировать кеш стилей в `EditorElement.render()` (per-frame Map уже самоочищается, отдельная инвалидация не нужна).

## Связанные файлы

- `src/Editor/Tokenization/` — все интерфейсы и реализации
- `src/Theme/Tokenization/TokenThemeResolver.ts` — резолвер скоупов
- `src/Editor/EditorElement.ts` — `TokenIndex`, `packStyleFlags`, рендеринг с цветами
- `src/Controllers/EditorController.ts` — wiring per-document store
- `src/main.ts` — регистрация встроенных токенайзеров
