// Контракт входа скилла.
//
// Единственная форма, в которой задача попадает в агента, — этот файл. Скилл не ходит
// за постановкой ни в GitHub, ни куда-либо ещё: всё уже собрано здесь. Отсюда же берётся
// отладка — файл можно написать руками и запустить скилл в одиночку, без демона и без сети.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { UserError } from "./gh.ts";
import { taskPath } from "./paths.ts";

export interface Task {
    /** Он же имя агента и его worktree. Например `issue-136`. */
    id: string;
    title: string;
    /** Произвольные пары для машины: номер issue, ссылки, лейблы. */
    fields: Record<string, unknown>;
    /** Постановка для человека и модели. */
    text: string;
}

/** Имя агента = имя worktree = имя файла задачи, поэтому оно должно быть безопасным для пути. */
export const TASK_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function parseTask(raw: unknown, source = "задача"): Task {
    const fail = (message: string): never => {
        throw new UserError(`${source}: ${message}`);
    };
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return fail("ожидался объект");
    const value = raw as Record<string, unknown>;

    if (typeof value.id !== "string" || !TASK_ID_RE.test(value.id)) {
        return fail("`id` должен быть именем, безопасным для пути (буквы, цифры, точка, дефис, подчёркивание)");
    }
    if (typeof value.title !== "string" || value.title.trim().length === 0) return fail("`title` должен быть непустой строкой");
    if (typeof value.text !== "string" || value.text.trim().length === 0) {
        return fail("`text` должен быть непустой строкой — это вся постановка, которую увидит агент");
    }
    if (value.fields !== undefined && (typeof value.fields !== "object" || value.fields === null || Array.isArray(value.fields))) {
        return fail("`fields` должен быть объектом");
    }

    return {
        id: value.id,
        title: value.title,
        fields: (value.fields as Record<string, unknown>) ?? {},
        text: value.text,
    };
}

export function readTaskFile(path: string): Task {
    let text: string;
    try {
        text = readFileSync(path, "utf8");
    } catch {
        throw new UserError(`Файл задачи не найден: ${path}`);
    }
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (error) {
        throw new UserError(`Файл задачи ${path} — невалидный JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    return parseTask(raw, path);
}

/** Кладёт задачу на диск и возвращает путь — его же получает скилл аргументом. */
export function writeTaskFile(task: Task): string {
    const path = taskPath(task.id);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(task, null, 2)}\n`, "utf8");
    return path;
}
