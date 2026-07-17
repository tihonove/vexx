import { describe, expect, it } from "vitest";

import { parseTasksJson } from "./TasksJsonLoader.ts";

describe("parseTasksJson", () => {
    it("parses a shell task with an inline command", () => {
        const tasks = parseTasksJson(`{
            "version": "2.0.0",
            "tasks": [
                { "label": "build", "type": "shell", "command": "tsc -p .", "group": "build" }
            ]
        }`);
        expect(tasks).toEqual([{ label: "build", type: "shell", command: "tsc -p .", group: "build" }]);
    });

    it("tolerates comments and trailing commas (JSONC)", () => {
        const tasks = parseTasksJson(`{
            // build config
            "tasks": [
                { "label": "t", "command": "make", "type": "process", "args": ["-j4"], },
            ],
        }`);
        expect(tasks).toEqual([{ label: "t", type: "process", command: "make", args: ["-j4"] }]);
    });

    it("keeps the problemMatcher ref verbatim (named or inline)", () => {
        const tasks = parseTasksJson(`{
            "tasks": [
                { "label": "a", "command": "tsc", "problemMatcher": "$tsc" }
            ]
        }`);
        expect(tasks[0].problemMatcher).toBe("$tsc");
    });

    it("normalizes group object to its kind and reads options", () => {
        const tasks = parseTasksJson(`{
            "tasks": [
                {
                    "label": "test", "command": "vitest",
                    "group": { "kind": "test", "isDefault": true },
                    "options": { "cwd": "packages/app", "env": { "CI": "1" } }
                }
            ]
        }`);
        expect(tasks[0].group).toBe("test");
        expect(tasks[0].options).toEqual({ cwd: "packages/app", env: { CI: "1" } });
    });

    it("synthesizes `npm run <script>` for type: npm tasks", () => {
        const tasks = parseTasksJson(`{
            "tasks": [
                { "label": "npm lint", "type": "npm", "script": "lint", "problemMatcher": ["$eslint-stylish"] }
            ]
        }`);
        expect(tasks).toEqual([
            { label: "npm lint", type: "shell", command: "npm run lint", problemMatcher: ["$eslint-stylish"] },
        ]);
    });

    it("accepts legacy taskName as the label", () => {
        const tasks = parseTasksJson(`{ "tasks": [ { "taskName": "old", "command": "x" } ] }`);
        expect(tasks[0].label).toBe("old");
    });

    it("defaults type to shell", () => {
        const tasks = parseTasksJson(`{ "tasks": [ { "label": "a", "command": "x" } ] }`);
        expect(tasks[0].type).toBe("shell");
    });

    it("skips entries without a label or command", () => {
        const tasks = parseTasksJson(`{
            "tasks": [
                { "label": "no-command" },
                { "command": "no-label" },
                { "label": "ok", "command": "x" }
            ]
        }`);
        expect(tasks).toHaveLength(1);
        expect(tasks[0].label).toBe("ok");
    });

    it("returns [] on malformed or empty input", () => {
        expect(parseTasksJson("not json")).toEqual([]);
        expect(parseTasksJson("{}")).toEqual([]);
        expect(parseTasksJson(`{ "tasks": "nope" }`)).toEqual([]);
    });
});
