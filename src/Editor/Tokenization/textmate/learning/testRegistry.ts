import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import type { IRawGrammar, Registry } from "vscode-textmate";
import vsctm from "vscode-textmate";

import { getOnigLib } from "../OnigLib.ts";

/**
 * Тестовый хелпер: строит `Registry` поверх грамматик, лежащих в
 * builtin-расширениях `src/Extensions/builtin/`. Каждый тест получает свежий
 * Registry (общий `onigLib` синглтон, чтобы WASM грузился один раз на процесс).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const builtinDir = path.resolve(here, "..", "..", "..", "..", "Extensions", "builtin");

const SCOPE_TO_PATH: Partial<Record<string, string>> = {
    "source.js": path.join(builtinDir, "javascript", "syntaxes", "JavaScript.tmLanguage.json"),
    "source.js.jsx": path.join(builtinDir, "javascript", "syntaxes", "JavaScriptReact.tmLanguage.json"),
    "source.ts": path.join(builtinDir, "typescript-basics", "syntaxes", "TypeScript.tmLanguage.json"),
    "source.tsx": path.join(builtinDir, "typescript-basics", "syntaxes", "TypeScriptReact.tmLanguage.json"),
    "source.css": path.join(builtinDir, "css", "syntaxes", "css.tmLanguage.json"),
    "documentation.injection.js.jsx": path.join(
        builtinDir,
        "typescript-basics",
        "syntaxes",
        "jsdoc.js.injection.tmLanguage.json",
    ),
    "documentation.injection.ts": path.join(
        builtinDir,
        "typescript-basics",
        "syntaxes",
        "jsdoc.ts.injection.tmLanguage.json",
    ),
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
            const filePath = SCOPE_TO_PATH[scopeName];
            if (filePath === undefined) return null;
            const content = await fs.promises.readFile(filePath, "utf-8");
            return vsctm.parseRawGrammar(content, filePath);
        },
        getInjections: (scopeName: string): string[] | undefined => {
            return INJECTION_SCOPES_BY_HOST[scopeName];
        },
    });
}
