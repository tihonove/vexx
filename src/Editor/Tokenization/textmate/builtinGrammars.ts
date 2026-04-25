import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { IGrammarRecord } from "./TextMateGrammarLoader.ts";

/**
 * Описание встроенного языка: связка `languageId` (используется как ключ в
 * `TokenizationRegistry`), `scopeName` (root-scope в `.tmLanguage.json`) и
 * список расширений для simple language detection.
 */
export interface IBuiltinLanguage {
    readonly languageId: string;
    readonly scopeName: string;
    readonly extensions: readonly string[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const grammarsDir = path.resolve(here, "..", "grammars");

const grammarPath = (filename: string): string => path.join(grammarsDir, filename);

/** Встроенные языки. Используются и для регистрации, и для language detection. */
export const BUILTIN_LANGUAGES: readonly IBuiltinLanguage[] = [
    {
        languageId: "javascript",
        scopeName: "source.js",
        extensions: [".js", ".cjs", ".mjs"],
    },
    {
        languageId: "javascriptreact",
        scopeName: "source.js.jsx",
        extensions: [".jsx"],
    },
    {
        languageId: "typescript",
        scopeName: "source.ts",
        extensions: [".ts", ".cts", ".mts"],
    },
    {
        languageId: "typescriptreact",
        scopeName: "source.tsx",
        extensions: [".tsx"],
    },
    {
        languageId: "html",
        scopeName: "text.html.basic",
        extensions: [".html", ".htm"],
    },
    {
        languageId: "css",
        scopeName: "source.css",
        extensions: [".css"],
    },
];

/**
 * Полный набор грамматик (включая injection-грамматики и зависимости вроде
 * `text.html.derivative`), которые должен знать `TextMateGrammarLoader`.
 *
 * `injections` — список scope-имён хост-грамматик, в которые injection
 * подмешивается. Список расширений содержит только `BUILTIN_LANGUAGES`.
 */
export const BUILTIN_GRAMMAR_RECORDS: readonly IGrammarRecord[] = [
    { scopeName: "source.js", path: grammarPath("JavaScript.tmLanguage.json") },
    { scopeName: "source.js.jsx", path: grammarPath("JavaScriptReact.tmLanguage.json") },
    { scopeName: "source.ts", path: grammarPath("TypeScript.tmLanguage.json") },
    { scopeName: "source.tsx", path: grammarPath("TypeScriptReact.tmLanguage.json") },
    { scopeName: "source.css", path: grammarPath("css.tmLanguage.json") },
    { scopeName: "text.html.basic", path: grammarPath("html.tmLanguage.json") },
    { scopeName: "text.html.derivative", path: grammarPath("html-derivative.tmLanguage.json") },
    {
        scopeName: "documentation.injection.js.jsx",
        path: grammarPath("jsdoc.js.injection.tmLanguage.json"),
        injections: ["source.js", "source.js.jsx"],
    },
    {
        scopeName: "documentation.injection.ts",
        path: grammarPath("jsdoc.ts.injection.tmLanguage.json"),
        injections: ["source.ts", "source.tsx"],
    },
];
