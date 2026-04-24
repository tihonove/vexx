import type { IToken } from "../../ILineTokens.ts";
import { createLineTokens, createToken } from "../../ILineTokens.ts";
import type { IState } from "../IState.ts";
import { NULL_STATE } from "../IState.ts";
import type { ITokenizationResult, ITokenizationSupport } from "../ITokenizationSupport.ts";

const KEYWORDS = new Set([
    "if",
    "else",
    "for",
    "while",
    "do",
    "return",
    "function",
    "const",
    "let",
    "var",
    "class",
    "extends",
    "implements",
    "interface",
    "import",
    "export",
    "from",
    "new",
    "this",
    "super",
    "true",
    "false",
    "null",
    "undefined",
    "void",
    "typeof",
    "instanceof",
    "in",
    "of",
    "throw",
    "try",
    "catch",
    "finally",
    "switch",
    "case",
    "break",
    "continue",
    "default",
    "async",
    "await",
    "yield",
    "static",
    "public",
    "private",
    "protected",
    "readonly",
    "type",
    "enum",
]);

const SCOPE_KEYWORD = Object.freeze(["source", "keyword.control"]);
const SCOPE_NUMBER = Object.freeze(["source", "constant.numeric"]);
const SCOPE_STRING = Object.freeze(["source", "string.quoted"]);
const SCOPE_COMMENT = Object.freeze(["source", "comment.line"]);
const SCOPE_IDENTIFIER = Object.freeze(["source", "identifier"]);
const SCOPE_TEXT = Object.freeze(["source"]);

function isIdentStart(ch: string): boolean {
    return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_" || ch === "$";
}

function isIdentPart(ch: string): boolean {
    return isIdentStart(ch) || (ch >= "0" && ch <= "9");
}

function isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
}

/**
 * Tiny stateless tokenizer for demos and tests.
 * Recognises keywords, numbers, double-/single-quoted strings, line comments
 * (`//`), and identifiers. Anything else is emitted as a generic `source`
 * token. Multi-line constructs are not supported.
 */
export class WordTokenizer implements ITokenizationSupport {
    public getInitialState(): IState {
        return NULL_STATE;
    }

    public tokenizeLine(line: string, _state: IState): ITokenizationResult {
        const tokens: IToken[] = [];
        const length = line.length;
        let i = 0;

        const push = (start: number, scope: readonly string[]): void => {
            const last = tokens[tokens.length - 1];
            if (last && last.scopes === scope) return;
            tokens.push(createToken(start, scope));
        };

        while (i < length) {
            const ch = line[i];

            if (ch === "/" && line[i + 1] === "/") {
                push(i, SCOPE_COMMENT);
                i = length;
                continue;
            }

            if (ch === '"' || ch === "'") {
                push(i, SCOPE_STRING);
                const quote = ch;
                i++;
                while (i < length) {
                    if (line[i] === "\\" && i + 1 < length) {
                        i += 2;
                        continue;
                    }
                    const stop = line[i] === quote;
                    i++;
                    if (stop) break;
                }
                continue;
            }

            if (isDigit(ch)) {
                push(i, SCOPE_NUMBER);
                while (i < length && (isDigit(line[i]) || line[i] === ".")) i++;
                continue;
            }

            if (isIdentStart(ch)) {
                const start = i;
                while (i < length && isIdentPart(line[i])) i++;
                const word = line.substring(start, i);
                push(start, KEYWORDS.has(word) ? SCOPE_KEYWORD : SCOPE_IDENTIFIER);
                continue;
            }

            push(i, SCOPE_TEXT);
            i++;
        }

        if (tokens.length === 0) {
            tokens.push(createToken(0, SCOPE_TEXT));
        }

        return { tokens: createLineTokens(tokens), endState: NULL_STATE };
    }
}
