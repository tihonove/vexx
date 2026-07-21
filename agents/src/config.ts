// Схема и загрузка agents/config.jsonc.
//
// Конфиг описывает ТОЛЬКО запуск агентов: порты и роли. Ни доски, ни лейблов, ни задач —
// это соседний пакет project-config/. И никаких лимитов: все ограничения живут прозой
// в скиллах, а не здесь (осознанное решение, см. план).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { type ParseError, parse, printParseErrorCode } from "jsonc-parser";

export class ConfigError extends Error {}

export interface Ports {
    dashboard: number;
    mcp: number;
}

/**
 * Как живёт агент этой роли.
 *
 * `oneshot` — `claude -p`: отработал и умер, итог попадает в журнал. Памяти между
 * запусками нет намеренно. Так живёт оркестратор: постоянная сессия копила бы контекст
 * и уходила в компакт, давая частичную память — она хуже, чем никакой.
 *
 * `session` — интерактивный claude в своём окне tmux: долгоживущий агент со стабильным
 * id сессии, которого можно позвать обратно и к которому можно подключиться руками.
 */
export type RoleMode = "oneshot" | "session";
export const ROLE_MODES = ["oneshot", "session"] as const;

export interface RoleSpec {
    /** Каталог в `.claude/skills/`; он же имя команды `/<skill>`. */
    skill: string;
    mode: RoleMode;
    /** Своё git-дерево. Без него агенты подерутся за ветку рабочей копии. */
    worktree: boolean;
    /** Запускать по расписанию раз в N минут. Нет поля — только по требованию. */
    everyMin?: number;
    /** Значение `--tools`. "default" — не сужать набор встроенных инструментов. */
    tools?: string;
    /** Значение `--allowedTools`: снимает вопросы о разрешениях. */
    allow?: string[];
    permissionMode?: string;
}

export interface AgentsConfig {
    ports: Ports;
    roles: Record<string, RoleSpec>;
}

export const DEFAULT_PORTS: Ports = { dashboard: 7777, mcp: 7778 };

export const DEFAULT_CONFIG_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), "config.jsonc");

export function loadConfig(path: string = DEFAULT_CONFIG_PATH): AgentsConfig {
    let text: string;
    try {
        text = readFileSync(path, "utf8");
    } catch {
        throw new ConfigError(`Конфиг не найден: ${path}`);
    }

    const errors: ParseError[] = [];
    const raw = parse(text, errors, { allowTrailingComma: true }) as unknown;
    if (errors.length > 0) {
        const details = errors.map(e => `${printParseErrorCode(e.error)} на позиции ${e.offset}`).join(", ");
        throw new ConfigError(`Не удалось разобрать ${path}: ${details}`);
    }
    return validateConfig(raw, path);
}

export function validateConfig(raw: unknown, source = "config"): AgentsConfig {
    const fail = (message: string): never => {
        throw new ConfigError(`${source}: ${message}`);
    };
    const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value);

    if (!isRecord(raw)) return fail("ожидался объект на верхнем уровне");

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

    if (!isRecord(raw.roles) || Object.keys(raw.roles).length === 0) {
        return fail("`roles` должен быть непустым объектом: без ролей запускать нечего");
    }

    const roles: Record<string, RoleSpec> = {};
    for (const [name, value] of Object.entries(raw.roles)) {
        if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
            return fail(`роль "${name}": имя должно быть из a-z, 0-9 и дефисов — оно становится именем worktree`);
        }
        if (!isRecord(value)) return fail(`роль "${name}": ожидался объект`);
        if (typeof value.skill !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(value.skill)) {
            return fail(`роль "${name}": skill должен быть именем каталога скилла (a-z, 0-9, дефис)`);
        }

        const bool = (key: string, fallback: boolean): boolean => {
            const raw = value[key];
            if (raw === undefined) return fallback;
            if (typeof raw !== "boolean") return fail(`роль "${name}": \`${key}\` должен быть boolean`);
            return raw;
        };

        const worktree = bool("worktree", false);

        const mode = value.mode ?? "oneshot";
        if (!(ROLE_MODES as readonly unknown[]).includes(mode)) {
            return fail(`роль "${name}": \`mode\` должен быть ${ROLE_MODES.join(" | ")}`);
        }
        // Долгоживущий агент правит код, поэтому обязан сидеть в своём дереве: иначе двое
        // таких подерутся за ветку рабочей копии — этот инцидент у нас уже был.
        if (mode === "session" && !worktree) return fail(`роль "${name}": \`mode: "session"\` требует \`worktree: true\``);

        if (value.everyMin !== undefined && (typeof value.everyMin !== "number" || value.everyMin <= 0)) {
            return fail(`роль "${name}": \`everyMin\` должен быть положительным числом`);
        }
        if (value.tools !== undefined && typeof value.tools !== "string") {
            return fail(`роль "${name}": \`tools\` должен быть строкой`);
        }
        if (value.allow !== undefined && (!Array.isArray(value.allow) || value.allow.some(item => typeof item !== "string"))) {
            return fail(`роль "${name}": \`allow\` должен быть массивом строк`);
        }
        if (value.permissionMode !== undefined && typeof value.permissionMode !== "string") {
            return fail(`роль "${name}": \`permissionMode\` должен быть строкой`);
        }

        roles[name] = {
            skill: value.skill,
            mode: mode as RoleMode,
            worktree,
            everyMin: value.everyMin as number | undefined,
            tools: value.tools as string | undefined,
            allow: value.allow as string[] | undefined,
            permissionMode: value.permissionMode as string | undefined,
        };
    }

    return { ports, roles };
}
