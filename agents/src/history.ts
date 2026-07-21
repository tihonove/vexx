// Журнал запусков: append-only JSONL.
//
// Пишется ровно в одном месте — в launch.ts, через который проходит любой запуск агента.
// Поэтому мимо журнала запустить никого нельзя, и на вопрос «когда и кто дёрнул эту роль»
// он отвечает всегда: за это отвечают поля trigger (откуда пришёл запуск) и by (кто дёрнул).
//
// Полная командная строка пишется намеренно: любой запуск можно скопировать отсюда
// и повторить руками.
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { HISTORY_FILE } from "./paths.ts";

/** Откуда пришёл запрос на запуск. */
export type Trigger = "schedule" | "mcp" | "cli" | "dashboard";

/** Что случилось с сессией: завели новую или продолжили прежнюю. */
export type SessionAction = "create" | "resume" | "fresh";

export type HistoryEvent =
    | {
          at: string;
          kind: "launch";
          role: string;
          arg: string;
          key: string;
          session: SessionAction;
          trigger: Trigger;
          by: string;
          cwd: string;
          base?: string;
          cmd: string;
      }
    | { at: string; kind: "finish"; key: string; ok: boolean; durationMs: number; summary: string }
    | { at: string; kind: "stop"; key: string; agentId: string; by: string }
    | { at: string; kind: "error"; message: string; key?: string };

export function append(event: HistoryEvent, file = HISTORY_FILE): void {
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
}

/** Битую строку пропускаем молча: журнал — диагностика, он не должен ронять сервер. */
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

export function readAll(file = HISTORY_FILE): HistoryEvent[] {
    try {
        return parseLines(readFileSync(file, "utf8"));
    } catch {
        return [];
    }
}

export function tail(count: number, file = HISTORY_FILE): HistoryEvent[] {
    const events = readAll(file);
    return events.slice(Math.max(0, events.length - count));
}
