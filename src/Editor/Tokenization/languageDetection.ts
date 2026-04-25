import * as path from "node:path";

import type { IBuiltinLanguage } from "./textmate/builtinGrammars.ts";
import { BUILTIN_LANGUAGES } from "./textmate/builtinGrammars.ts";

/**
 * Минимальное определение языка по расширению файла.
 *
 * Это временный механизм — полноценный `ILanguageService` (с поддержкой
 * filename patterns, shebang, mimetype) описан как отдельная задача в
 * `docs/TODO/SyntaxHighlighting.md`.
 */
export function getLanguageIdForFile(
    filePath: string | null,
    languages: readonly IBuiltinLanguage[] = BUILTIN_LANGUAGES,
): string {
    if (filePath === null) return "plaintext";
    const ext = path.extname(filePath).toLowerCase();
    if (ext === "") return "plaintext";
    for (const lang of languages) {
        if (lang.extensions.includes(ext)) return lang.languageId;
    }
    return "plaintext";
}
