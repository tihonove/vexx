import { describe, expect, it } from "vitest";

import { UserError } from "./gh.ts";
import { countSpawnsSince, parseLines } from "./history.ts";
import { parseTask } from "./task.ts";

const valid = { id: "issue-136", title: "Go To Definition", fields: { issue: 136 }, text: "Постановка" };

describe("parseTask", () => {
    it("принимает корректную задачу", () => {
        expect(parseTask(valid)).toEqual(valid);
    });

    it("подставляет пустые fields", () => {
        expect(parseTask({ ...valid, fields: undefined }).fields).toEqual({});
    });

    it("требует непустой text — это единственное, что увидит агент", () => {
        expect(() => parseTask({ ...valid, text: "   " })).toThrow(UserError);
    });

    it("не пускает id, опасный для пути", () => {
        for (const id of ["../escape", "a/b", "", ".hidden"]) {
            expect(() => parseTask({ ...valid, id })).toThrow(UserError);
        }
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
