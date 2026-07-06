import type * as vscode from "vscode";

import type { ExtHostTextDocument } from "./ExtHostDocuments.ts";

/**
 * Матчинг `vscode.DocumentSelector` против документа (subprocess-side, WP8).
 *
 * Минимальная реализация `languages.match`: поддерживает строковый селектор
 * (сахар для `{ language }`), `DocumentFilter { language?, scheme?, pattern? }`
 * и массив (any-match). `pattern` — мини-glob по абсолютному пути (`**`, `*`, `?`),
 * которого достаточно для editorconfig-подобных селекторов (globstar + имя файла).
 */
export function matchDocumentSelector(selector: vscode.DocumentSelector, doc: ExtHostTextDocument): boolean {
    if (Array.isArray(selector)) {
        return selector.some((s) => matchDocumentSelector(s as vscode.DocumentSelector, doc));
    }
    if (typeof selector === "string") {
        return matchLanguage(selector, doc);
    }
    return matchFilter(selector as vscode.DocumentFilter, doc);
}

function matchLanguage(language: string, doc: ExtHostTextDocument): boolean {
    return language === "*" || language === doc.languageId;
}

function matchFilter(filter: vscode.DocumentFilter, doc: ExtHostTextDocument): boolean {
    if (filter.language !== undefined && !matchLanguage(filter.language, doc)) return false;
    if (filter.scheme !== undefined && filter.scheme !== "*" && filter.scheme !== doc.uri.scheme) return false;
    if (typeof filter.pattern === "string" && !matchGlobPath(filter.pattern, doc.uri.fsPath)) return false;
    // Хотя бы одно ограничение должно присутствовать (пустой фильтр не матчит).
    return filter.language !== undefined || filter.scheme !== undefined || filter.pattern !== undefined;
}

/** Компилирует glob (`**`, `*`, `?`) в regexp по всему пути. */
function globToRegExp(glob: string): RegExp {
    let re = "";
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === "*") {
            if (glob[i + 1] === "*") {
                i++;
                if (glob[i + 1] === "/") {
                    i++;
                    re += "(?:.*/)?"; // `**/` — ноль и более сегментов пути
                } else {
                    re += ".*";
                }
            } else {
                re += "[^/]*"; // `*` — внутри одного сегмента
            }
        } else if (c === "?") {
            re += "[^/]";
        } else if ("/.+^${}()|[]\\".includes(c)) {
            re += "\\" + c;
        } else {
            re += c;
        }
    }
    return new RegExp("^" + re + "$");
}

function matchGlobPath(pattern: string, fsPath: string): boolean {
    return globToRegExp(pattern).test(fsPath);
}
