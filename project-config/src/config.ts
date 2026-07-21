// Схема и загрузка config.jsonc — декларативного описания доски проекта.
//
// Пакет знает только про GitHub: репозиторий, проект и его поля. Ничего про агентов,
// роли и порты здесь нет — это другой пакет и другая жизнь.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type ParseError, parse, printParseErrorCode } from "jsonc-parser";

import { UserError } from "./gh.ts";

export const OPTION_COLORS = ["GRAY", "BLUE", "GREEN", "YELLOW", "ORANGE", "RED", "PINK", "PURPLE"] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

/** Типы полей, которые умеет создавать createProjectV2Field. */
export const FIELD_DATA_TYPES = ["TEXT", "NUMBER", "DATE", "SINGLE_SELECT"] as const;
export type FieldDataType = (typeof FIELD_DATA_TYPES)[number];

export interface OptionSpec {
    name: string;
    color: OptionColor;
    description: string;
}

export interface FieldSpec {
    dataType: FieldDataType;
    /** Только для SINGLE_SELECT; порядок = порядок колонок на доске. */
    options?: OptionSpec[];
}

export interface ProjectConfig {
    repo: string;
    project: { owner: string; number: number };
    fields: Record<string, FieldSpec>;
}

export const DEFAULT_CONFIG_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), "config.jsonc");

export function loadConfig(path: string = DEFAULT_CONFIG_PATH): ProjectConfig {
    let text: string;
    try {
        text = readFileSync(path, "utf8");
    } catch {
        throw new UserError(`Конфиг не найден: ${path}`);
    }

    const errors: ParseError[] = [];
    const raw = parse(text, errors, { allowTrailingComma: true }) as unknown;
    if (errors.length > 0) {
        const details = errors.map(e => `${printParseErrorCode(e.error)} на позиции ${e.offset}`).join(", ");
        throw new UserError(`Не удалось разобрать ${path}: ${details}`);
    }
    return validateConfig(raw, path);
}

// Валидация руками, без схема-библиотеки: полей мало, а лишняя зависимость
// в машинерии дороже двадцати строк проверок.
export function validateConfig(raw: unknown, source = "config"): ProjectConfig {
    const fail = (message: string): never => {
        throw new UserError(`${source}: ${message}`);
    };
    const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);

    if (!isRecord(raw)) return fail("ожидался объект на верхнем уровне");

    if (typeof raw.repo !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(raw.repo)) {
        return fail("`repo` должен быть строкой вида owner/name");
    }

    if (!isRecord(raw.project)) return fail("`project` должен быть объектом");
    const { owner, number } = raw.project;
    if (typeof owner !== "string" || owner.length === 0) return fail("`project.owner` должен быть непустой строкой");
    if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
        return fail("`project.number` должен быть положительным целым");
    }

    if (!isRecord(raw.fields)) return fail("`fields` должен быть объектом");
    const fields: Record<string, FieldSpec> = {};
    for (const [fieldName, value] of Object.entries(raw.fields)) {
        if (!isRecord(value)) return fail(`поле "${fieldName}": ожидался объект`);
        const isFieldDataType = (value: unknown): value is FieldDataType =>
            typeof value === "string" && (FIELD_DATA_TYPES as readonly string[]).includes(value);
        const dataType = value.dataType;
        if (!isFieldDataType(dataType)) {
            return fail(`поле "${fieldName}": dataType должен быть одним из ${FIELD_DATA_TYPES.join(" | ")}`);
        }
        if (dataType !== "SINGLE_SELECT") {
            if (value.options !== undefined) return fail(`поле "${fieldName}": options допустимы только для SINGLE_SELECT`);
            fields[fieldName] = { dataType };
            continue;
        }
        if (!Array.isArray(value.options) || value.options.length === 0) {
            return fail(`поле "${fieldName}": SINGLE_SELECT требует непустой массив options`);
        }
        const options: OptionSpec[] = [];
        const seen = new Set<string>();
        for (const option of value.options) {
            if (!isRecord(option)) return fail(`поле "${fieldName}": каждая опция должна быть объектом`);
            if (typeof option.name !== "string" || option.name.length === 0) {
                return fail(`поле "${fieldName}": у опции должно быть непустое name`);
            }
            const key = option.name.toLowerCase();
            if (seen.has(key)) return fail(`поле "${fieldName}": опция "${option.name}" объявлена дважды`);
            seen.add(key);
            if (typeof option.color !== "string" || !(OPTION_COLORS as readonly string[]).includes(option.color)) {
                return fail(`поле "${fieldName}", опция "${option.name}": color должен быть одним из ${OPTION_COLORS.join(" | ")}`);
            }
            if (typeof option.description !== "string") {
                return fail(`поле "${fieldName}", опция "${option.name}": description должен быть строкой`);
            }
            options.push({ name: option.name, color: option.color as OptionColor, description: option.description });
        }
        fields[fieldName] = { dataType, options };
    }

    return { repo: raw.repo, project: { owner, number }, fields };
}
