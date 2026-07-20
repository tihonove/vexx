// Журнал оркестрации: append-only JSONL.
//
// Здесь живут ФАКТЫ — спавн, отказ по лимиту, kill, начало и конец тика. Суждения
// оркестратора («даю до 20:00 на флейк») сюда не пишутся: им место в комментарии issue,
// иначе о них узнает только этот файл, а не человек и не следующий тик.
//
// Журнал же — единственный источник счётчика спавнов за час: демон не держит его в памяти,
// поэтому его перезапуск не обнуляет rate limit.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { HISTORY_FILE } from "./paths.ts";

export type HistoryEvent =
    | { at: string; kind: "tick-start"; trigger: "schedule" | "manual" }
    | { at: string; kind: "tick-end"; ok: boolean; summary: string; durationMs: number }
    | { at: string; kind: "spawn"; name: string; skill: string; agentId?: string }
    | { at: string; kind: "spawn-refused"; name: string; skill: string; reason: string }
    | { at: string; kind: "kill"; name: string; agentId: string }
    | { at: string; kind: "error"; message: string };

export function append(event: HistoryEvent, file = HISTORY_FILE): void {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
}

export function readAll(file = HISTORY_FILE): HistoryEvent[] {
    let text: string;
    try {
        text = readFileSync(file, "utf8");
    } catch {
        return [];
    }
    return parseLines(text);
}

/** Битую строку пропускаем молча: журнал — диагностика, он не должен ронять демон. */
export function parseLines(text: string): HistoryEvent[] {
    const events: HistoryEvent[] = [];
    for (const line of text.split("\n")) {
        if (line.trim().length === 0) continue;
        try {
            events.push(JSON.parse(line) as HistoryEvent);
        } catch {
            continue;
        }
    }
    return events;
}

/** Чистая функция — на ней и тестируется rate limit. */
export function countSpawnsSince(events: HistoryEvent[], since: Date): number {
    return events.filter(event => event.kind === "spawn" && Date.parse(event.at) >= since.getTime()).length;
}

export function tail(count: number, file = HISTORY_FILE): HistoryEvent[] {
    const events = readAll(file);
    return events.slice(Math.max(0, events.length - count));
}
