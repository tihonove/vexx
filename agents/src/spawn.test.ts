import { describe, expect, it } from "vitest";

import { AGENT_NAME_RE, skillPrompt } from "./agents.ts";
import { countSpawnsSince, parseLines } from "./history.ts";

describe("skillPrompt", () => {
    it("собирает промпт из имени скилла и аргументов", () => {
        expect(skillPrompt("implement", "136")).toBe("/implement 136");
    });

    it("не оставляет висящий пробел, если аргументов нет", () => {
        expect(skillPrompt("orchestrate", "")).toBe("/orchestrate");
        expect(skillPrompt("orchestrate", "   ")).toBe("/orchestrate");
    });
});

describe("AGENT_NAME_RE", () => {
    it("пропускает нормальные имена агентов", () => {
        for (const name of ["issue-136", "probe_1", "a.b"]) expect(AGENT_NAME_RE.test(name)).toBe(true);
    });

    it("не пускает имена, опасные для пути", () => {
        for (const name of ["../escape", "a/b", "", ".hidden"]) expect(AGENT_NAME_RE.test(name)).toBe(false);
    });
});

describe("history", () => {
    it("пропускает битые строки, а не падает", () => {
        const text = ['{"at":"2026-07-20T20:00:00Z","kind":"spawn","name":"a","skill":"implement"}', "мусор", ""].join("\n");
        expect(parseLines(text)).toHaveLength(1);
    });

    it("считает только спавны и только свежие", () => {
        const events = parseLines(
            [
                '{"at":"2026-07-20T20:30:00Z","kind":"spawn","name":"a","skill":"implement"}',
                '{"at":"2026-07-20T19:00:00Z","kind":"spawn","name":"b","skill":"implement"}',
                '{"at":"2026-07-20T20:40:00Z","kind":"spawn-refused","name":"c","skill":"implement","reason":"x"}',
            ].join("\n"),
        );
        expect(countSpawnsSince(events, new Date("2026-07-20T20:00:00Z"))).toBe(1);
    });
});
