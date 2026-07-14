/**
 * Фаза 4b: встроенные токенизаторы, пропущенные из-за фильтра «builtin» в кодемоде.
 * PlainTextTokenizer ≈ nullTokenize у vscode; кладём оба в editor/common/languages.
 */
export const moves = [
    ["src/Editor/Tokenization/builtin/PlainTextTokenizer.ts", "src/vs/editor/common/languages/plainTextTokenizer.ts"],
    ["src/Editor/Tokenization/builtin/WordTokenizer.ts", "src/vs/editor/common/languages/wordTokenizer.ts"],
];
export const stringPrefixes = [];
