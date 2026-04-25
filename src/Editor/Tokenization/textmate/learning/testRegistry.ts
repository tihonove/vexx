import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { IRawGrammar, Registry } from "vscode-textmate";
import vsctm from "vscode-textmate";

import { getOnigLib } from "../OnigLib.ts";

/**
 * Тестовый хелпер: строит `Registry` поверх грамматик, лежащих в
 * `src/Editor/Tokenization/grammars/`. Каждый тест получает свежий Registry
 * (общий `onigLib` синглтон, чтобы WASM грузился один раз на процесс).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const grammarsDir = path.resolve(here, "..", "..", "grammars");

const SCOPE_TO_FILENAME: Partial<Record<string, string>> = {
    "source.js": "JavaScript.tmLanguage.json",
    "source.js.jsx": "JavaScriptReact.tmLanguage.json",
    "source.ts": "TypeScript.tmLanguage.json",
    "source.tsx": "TypeScriptReact.tmLanguage.json",
    "source.css": "css.tmLanguage.json",
    "text.html.basic": "html.tmLanguage.json",
    "text.html.derivative": "html-derivative.tmLanguage.json",
    "documentation.injection.js.jsx": "jsdoc.js.injection.tmLanguage.json",
    "documentation.injection.ts": "jsdoc.ts.injection.tmLanguage.json",
};

const INJECTION_SCOPES_BY_HOST: Record<string, string[]> = {
    "source.js": ["documentation.injection.js.jsx"],
    "source.js.jsx": ["documentation.injection.js.jsx"],
    "source.ts": ["documentation.injection.ts"],
    "source.tsx": ["documentation.injection.ts"],
};

export function createTestRegistry(): Registry {
    return new vsctm.Registry({
        onigLib: getOnigLib(),
        loadGrammar: async (scopeName: string): Promise<IRawGrammar | null> => {
            const filename = SCOPE_TO_FILENAME[scopeName];
            if (filename === undefined) return null;
            const filePath = path.join(grammarsDir, filename);
            const content = await fs.promises.readFile(filePath, "utf-8");
            return vsctm.parseRawGrammar(content, filePath);
        },
        getInjections: (scopeName: string): string[] | undefined => {
            return INJECTION_SCOPES_BY_HOST[scopeName];
        },
    });
}
