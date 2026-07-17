// Загрузчик `.vscode/tasks.json` (JSONC). Читает файл и нормализует его в `ITask[]`.
// Разбор вынесен в чистый `parseTasksJson(text)` — как `validateSettingsJson` — чтобы
// тестировать без файловой системы. Отсутствие/битость файла → пустой список (не ошибка).

import * as fs from "node:fs";
import * as path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";

import type { ITask, ProblemMatcherRef } from "./ITask.ts";

/** Прочитать и распарсить `<workspaceFolder>/.vscode/tasks.json`. Нет файла → `[]`. */
export async function loadTasks(workspaceFolder: string): Promise<ITask[]> {
    const file = path.join(workspaceFolder, ".vscode", "tasks.json");
    let text: string;
    try {
        text = await fs.promises.readFile(file, "utf-8");
    } catch {
        return [];
    }
    return parseTasksJson(text);
}

/** Разобрать содержимое tasks.json в нормализованные таски. Битый JSON → `[]`. */
export function parseTasksJson(text: string): ITask[] {
    const parsed: unknown = parseJsonc(text, [], { allowTrailingComma: true });
    if (!isRecord(parsed)) return [];
    const rawTasks = parsed.tasks;
    if (!Array.isArray(rawTasks)) return [];

    const tasks: ITask[] = [];
    for (const raw of rawTasks) {
        const task = normalizeTask(raw);
        if (task !== null) tasks.push(task);
    }
    return tasks;
}

function normalizeTask(raw: unknown): ITask | null {
    if (!isRecord(raw)) return null;

    // Ярлык: VS Code исторически звал его `taskName`, ныне `label`.
    const label = asString(raw.label) ?? asString(raw.taskName);
    // `type: npm` не имеет `command` — синтезируем `npm run <script>` и трактуем как shell.
    const command = asString(raw.command) ?? npmCommand(raw);
    if (label === undefined || command === undefined) return null;

    const type = raw.type === "process" ? "process" : "shell";
    const args = asStringArray(raw.args);
    const options = normalizeOptions(raw.options);
    const group = normalizeGroup(raw.group);
    const problemMatcher = raw.problemMatcher as ProblemMatcherRef | undefined;

    return {
        label,
        type,
        command,
        ...(args !== undefined ? { args } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(group !== undefined ? { group } : {}),
        ...(problemMatcher !== undefined ? { problemMatcher } : {}),
    };
}

function normalizeOptions(raw: unknown): ITask["options"] {
    if (!isRecord(raw)) return undefined;
    const cwd = asString(raw.cwd);
    const env = isRecord(raw.env) ? (raw.env as Record<string, string>) : undefined;
    if (cwd === undefined && env === undefined) return undefined;
    return { ...(cwd !== undefined ? { cwd } : {}), ...(env !== undefined ? { env } : {}) };
}

/** `group` бывает строкой (`"build"`) или объектом `{ kind, isDefault }` — берём `kind`. */
function normalizeGroup(raw: unknown): string | undefined {
    if (typeof raw === "string") return raw;
    if (isRecord(raw)) return asString(raw.kind);
    return undefined;
}

/** Для `type: npm` собрать `npm run <script>` из поля `script`. */
function npmCommand(raw: Record<string, unknown>): string | undefined {
    if (raw.type !== "npm") return undefined;
    const script = asString(raw.script);
    return script === undefined ? undefined : `npm run ${script}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out: string[] = [];
    for (const item of value) if (typeof item === "string") out.push(item);
    return out;
}
