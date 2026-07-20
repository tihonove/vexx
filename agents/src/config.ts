// Схема и загрузка config.jsonc — декларативного описания состояний машинерии.
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

export interface LabelSpec {
    /** Hex без `#`, в нижнем регистре — как отдаёт `gh label list`. */
    color: string;
    description: string;
}

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

export interface Ports {
    dashboard: number;
    mcp: number;
}

export interface Limits {
    maxConcurrent: number;
    spawnsPerHour: number;
    tickIntervalMin: number;
}

export interface RoleSpec {
    /** Каталог в `.claude/skills/`; он же имя команды `/<skill>`. */
    skill: string;
}

export interface AgentsConfig {
    repo: string;
    project: { owner: string; number: number };
    ports: Ports;
    limits: Limits;
    /** Режим наблюдения: spawn_agent отказывает, остальное работает. */
    dryRun: boolean;
    roles: Record<string, RoleSpec>;
    labels: { prefix: string; items: Record<string, LabelSpec> };
    fields: Record<string, FieldSpec>;
}

export const DEFAULT_PORTS: Ports = { dashboard: 7777, mcp: 7778 };
export const DEFAULT_LIMITS: Limits = { maxConcurrent: 2, spawnsPerHour: 4, tickIntervalMin: 10 };

export const DEFAULT_CONFIG_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), "config.jsonc");

/** Нормализация цвета лейбла к виду, в котором его отдаёт GitHub: 6 hex-символов, нижний регистр. */
export function normalizeLabelColor(color: string): string {
    return color.replace(/^#/, "").toLowerCase();
}

export function loadConfig(path: string = DEFAULT_CONFIG_PATH): AgentsConfig {
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
export function validateConfig(raw: unknown, source = "config"): AgentsConfig {
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

    // ports/limits/roles/dryRun — секции демона. Необязательны: `sync` работает и без них,
    // а у демона есть разумные дефолты.
    const positiveInt = (value: unknown, path: string, fallback: number): number => {
        if (value === undefined) return fallback;
        if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
            return fail(`\`${path}\` должен быть положительным целым`);
        }
        return value;
    };

    if (raw.ports !== undefined && !isRecord(raw.ports)) return fail("`ports` должен быть объектом");
    const rawPorts = isRecord(raw.ports) ? raw.ports : {};
    const ports: Ports = {
        dashboard: positiveInt(rawPorts.dashboard, "ports.dashboard", DEFAULT_PORTS.dashboard),
        mcp: positiveInt(rawPorts.mcp, "ports.mcp", DEFAULT_PORTS.mcp),
    };
    if (ports.dashboard === ports.mcp) return fail("`ports.dashboard` и `ports.mcp` должны отличаться");

    if (raw.limits !== undefined && !isRecord(raw.limits)) return fail("`limits` должен быть объектом");
    const rawLimits = isRecord(raw.limits) ? raw.limits : {};
    const limits: Limits = {
        maxConcurrent: positiveInt(rawLimits.maxConcurrent, "limits.maxConcurrent", DEFAULT_LIMITS.maxConcurrent),
        spawnsPerHour: positiveInt(rawLimits.spawnsPerHour, "limits.spawnsPerHour", DEFAULT_LIMITS.spawnsPerHour),
        tickIntervalMin: positiveInt(rawLimits.tickIntervalMin, "limits.tickIntervalMin", DEFAULT_LIMITS.tickIntervalMin),
    };

    if (raw.dryRun !== undefined && typeof raw.dryRun !== "boolean") return fail("`dryRun` должен быть boolean");
    // Отсутствующий dryRun трактуем как true: забыть его — не повод начать спавнить.
    const dryRun = raw.dryRun === undefined ? true : raw.dryRun;

    if (raw.roles !== undefined && !isRecord(raw.roles)) return fail("`roles` должен быть объектом");
    const roles: Record<string, RoleSpec> = {};
    for (const [roleName, value] of Object.entries(isRecord(raw.roles) ? raw.roles : {})) {
        if (!isRecord(value)) return fail(`роль "${roleName}": ожидался объект`);
        if (typeof value.skill !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value.skill)) {
            return fail(`роль "${roleName}": skill должен быть именем каталога скилла (a-z, 0-9, дефис)`);
        }
        roles[roleName] = { skill: value.skill };
    }

    if (!isRecord(raw.labels)) return fail("`labels` должен быть объектом");
    const { prefix, items } = raw.labels;
    if (typeof prefix !== "string" || prefix.length === 0) {
        return fail("`labels.prefix` должен быть непустой строкой — это юрисдикция --prune");
    }
    if (!isRecord(items)) return fail("`labels.items` должен быть объектом");

    const labelItems: Record<string, LabelSpec> = {};
    for (const [name, value] of Object.entries(items)) {
        if (!name.startsWith(prefix)) {
            return fail(`лейбл "${name}" не начинается с префикса "${prefix}" — он вне юрисдикции синка`);
        }
        if (!isRecord(value)) return fail(`лейбл "${name}": ожидался объект`);
        if (typeof value.color !== "string" || !/^#?[0-9a-fA-F]{6}$/.test(value.color)) {
            return fail(`лейбл "${name}": color должен быть hex из 6 символов`);
        }
        if (typeof value.description !== "string") return fail(`лейбл "${name}": description должен быть строкой`);
        labelItems[name] = { color: normalizeLabelColor(value.color), description: value.description };
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

    return {
        repo: raw.repo,
        project: { owner, number },
        ports,
        limits,
        dryRun,
        roles,
        labels: { prefix, items: labelItems },
        fields,
    };
}
