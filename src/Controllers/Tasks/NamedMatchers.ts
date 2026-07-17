// Реестр встроенных именованных матчеров (VS Code поставляет их «из коробки»).
// Первый срез: `$tsc` и `$gcc`. Матчеры из расширений (`contributes.problemMatchers`)
// — документированный follow-up; сюда же добавятся `$eslint-*`, `$msCompile` и пр.

import type { IProblemMatcher, ProblemMatcherRef } from "./ITask.ts";

const BUILT_IN: Record<string, IProblemMatcher> = {
    // TypeScript-компилятор: `app.ts(3,5): error TS2322: Type ... is not assignable ...`.
    $tsc: {
        owner: "typescript",
        source: "ts",
        fileLocation: ["relative", "${workspaceFolder}"],
        pattern: {
            regexp: "^([^\\s].*)[\\(:](\\d+)[,:](\\d+)(?:\\):\\s+|\\s+-\\s+)(error|warning|info)\\s+(TS\\d+)\\s*:\\s*(.*)$",
            file: 1,
            line: 2,
            column: 3,
            severity: 4,
            code: 5,
            message: 6,
        },
    },
    // GCC/Clang: `src/main.c:12:5: error: expected ';' before '}' token`.
    $gcc: {
        owner: "gcc",
        source: "gcc",
        fileLocation: ["relative", "${workspaceFolder}"],
        pattern: {
            regexp: "^(.*?):(\\d+):(\\d+):\\s+(warning|error|info):\\s+(.*)$",
            file: 1,
            line: 2,
            column: 3,
            severity: 4,
            message: 5,
        },
    },
    // ESLint stylish (дефолтный формат): строка-путь файла, затем отступные строки
    // `  10:5  error  Message  rule-id`, повторяются под общим заголовком (loop).
    $eslintStylish: {
        owner: "eslint",
        source: "eslint",
        fileLocation: "absolute",
        pattern: [
            { regexp: "^([^\\s].*)$", file: 1 },
            {
                regexp: "^\\s+(\\d+):(\\d+)\\s+(error|warning|info)\\s+(.*?)(?:\\s\\s+(\\S+))?$",
                line: 1,
                column: 2,
                severity: 3,
                message: 4,
                code: 5,
                loop: true,
            },
        ],
    },
    // ESLint compact (`--format compact`): `path.ts: line 10, col 5, Error - Message (rule-id)`.
    $eslintCompact: {
        owner: "eslint",
        source: "eslint",
        fileLocation: "absolute",
        pattern: {
            regexp: "^(.+):\\sline\\s(\\d+),\\scol\\s(\\d+),\\s(Error|Warning|Info)\\s-\\s(.+?)(?:\\s\\((\\S+)\\))?$",
            file: 1,
            line: 2,
            column: 3,
            severity: 4,
            message: 5,
            code: 6,
        },
    },
};

// Псевдонимы с дефисом (`$eslint-stylish`) → ключи-идентификаторы объекта выше.
const ALIASES: Record<string, keyof typeof BUILT_IN> = {
    "$eslint-stylish": "$eslintStylish",
    "$eslint-compact": "$eslintCompact",
};

/** Развернуть именованную ссылку (`"$tsc"`, `"$eslint-stylish"`) в определение; `null` — неизвестное имя. */
export function resolveNamedMatcher(name: string): IProblemMatcher | null {
    const key = ALIASES[name] ?? name;
    return BUILT_IN[key] ?? null;
}

/**
 * Нормализовать `problemMatcher` таска в список определений. Строки резолвятся через
 * реестр, inline-объекты проходят насквозь; неизвестные имена молча отбрасываются.
 */
export function resolveMatchers(ref: ProblemMatcherRef | undefined): IProblemMatcher[] {
    if (ref === undefined) return [];
    const refs = Array.isArray(ref) ? ref : [ref];
    const result: IProblemMatcher[] = [];
    for (const item of refs as readonly (string | IProblemMatcher)[]) {
        if (typeof item === "string") {
            const resolved = resolveNamedMatcher(item);
            if (resolved !== null) result.push(resolved);
        } else {
            result.push(item);
        }
    }
    return result;
}
