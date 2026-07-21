// Ключ агента и поиск его сессии.
//
// Ключ — единственный идентификатор в системе: из пары (роль, аргумент) он выводится
// детерминированно, а из него — имя агента и путь его worktree. Ничего не хранится:
// связка «задача ↔ агент» ВИДНА в имени каталога.
//
// Сессию адресуем не по id, а по каталогу. Так вышло не от красоты: проверено, что
// `--bg` игнорирует `--session-id` и при `--resume` чеканит новый id, то есть предсказать
// id фонового агента нельзя в принципе. Зато каждый запуск кладёт свой <uuid>.jsonl в
// каталог сессий своего cwd — и самый свежий файл там и есть текущая сессия агента.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { sessionDir } from "./paths.ts";

/** Ключ становится именем каталога, поэтому он обязан быть безопасным для пути. */
export const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function agentKey(role: string, arg?: string): string {
    const suffix = (arg ?? "").trim();
    const key = suffix ? `${role}-${suffix}` : role;
    if (!KEY_RE.test(key)) {
        throw new Error(`Аргумент "${suffix}" даёт небезопасный ключ "${key}": ожидались буквы, цифры, точка, дефис`);
    }
    return key;
}

/** Чистая часть выбора сессии — на ней всё и тестируется. */
export function pickLatest(files: { name: string; mtimeMs: number }[]): string | undefined {
    let best: { name: string; mtimeMs: number } | undefined;
    for (const file of files) {
        if (!file.name.endsWith(".jsonl")) continue;
        if (!best || file.mtimeMs > best.mtimeMs) best = file;
    }
    return best && best.name.slice(0, -".jsonl".length);
}

/**
 * Текущая сессия агента, работающего в этом каталоге, или undefined, если он ещё не
 * запускался. Каталога нет — это не ошибка, а нормальный «ещё никого не было».
 */
export function findSession(cwd: string): string | undefined {
    const dir = sessionDir(cwd);
    let names: string[];
    try {
        names = readdirSync(dir);
    } catch {
        return undefined;
    }
    const files: { name: string; mtimeMs: number }[] = [];
    for (const name of names) {
        try {
            files.push({ name, mtimeMs: statSync(join(dir, name)).mtimeMs });
        } catch {
            continue;
        }
    }
    return pickLatest(files);
}
