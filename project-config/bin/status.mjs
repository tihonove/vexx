#!/usr/bin/env node
// Состояние задачи на доске проекта — читать и менять.
//
// Состояния живут ТОЛЬКО в колонках Project v2 (поле Status). Лейблы для этого не
// используются: два источника правды разъехались бы на первой же ошибке.
//
// Скрипт намеренно БЕЗ ЗАВИСИМОСТЕЙ и запускается голым node: агенты работают в свежих
// worktree, где `node_modules` нет и ставить его ради одной команды незачем.
//
//   node project-config/bin/status.mjs get 175
//   node project-config/bin/status.mjs set 175 Implementing
//   node project-config/bin/status.mjs list "To implement"
//   node project-config/bin/status.mjs list Implementing --json
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG = join(dirname(dirname(fileURLToPath(import.meta.url))), "config.jsonc");

function loadProject() {
    // Грубая чистка JSONC: нам нужны только owner и number, полноценный парсер сюда
    // тащить нельзя — это стоило бы зависимости.
    const text = readFileSync(CONFIG, "utf8").replace(/^\s*\/\/.*$/gm, "");
    const config = JSON.parse(text);
    if (!config.project?.owner || !config.project?.number) {
        throw new Error(`В ${CONFIG} нет project.owner / project.number`);
    }
    return config.project;
}

function gh(args) {
    return execFileSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function ghJson(args) {
    return JSON.parse(gh(args));
}

function items({ owner, number }) {
    return ghJson(["project", "item-list", String(number), "--owner", owner, "--format", "json", "--limit", "500"]).items;
}

function findItem(project, issue) {
    const item = items(project).find(candidate => candidate.content?.number === issue);
    if (!item) throw new Error(`Issue #${issue} нет на доске проекта #${project.number}`);
    return item;
}

function statusField(project) {
    const fields = ghJson([
        "project",
        "field-list",
        String(project.number),
        "--owner",
        project.owner,
        "--format",
        "json",
    ]).fields;
    const field = fields.find(candidate => candidate.name === "Status");
    if (!field) throw new Error("В проекте нет поля Status");
    return field;
}

function setStatus(project, issue, statusName) {
    const item = findItem(project, issue);
    if (item.status === statusName) return `#${issue}: уже ${statusName}`;

    const field = statusField(project);
    const option = field.options?.find(candidate => candidate.name.toLowerCase() === statusName.toLowerCase());
    if (!option) {
        const known = (field.options ?? []).map(candidate => candidate.name).join(" | ");
        throw new Error(`Неизвестное состояние "${statusName}". На доске есть: ${known}`);
    }
    const projectId = ghJson(["project", "view", String(project.number), "--owner", project.owner, "--format", "json"]).id;
    gh([
        "project",
        "item-edit",
        "--project-id",
        projectId,
        "--id",
        item.id,
        "--field-id",
        field.id,
        "--single-select-option-id",
        option.id,
    ]);
    return `#${issue}: ${item.status ?? "—"} → ${option.name}`;
}

const USAGE = `Использование: node project-config/bin/status.mjs <команда>

  get <issue>              текущее состояние задачи
  set <issue> <состояние>  перевести задачу в состояние
  list <состояние> [--json] задачи в этом состоянии
`;

function main(argv) {
    const json = argv.includes("--json");
    const [command, first, ...rest] = argv.filter(arg => arg !== "--json");
    const project = loadProject();

    if (command === "get") {
        const item = findItem(project, Number(first));
        console.log(json ? JSON.stringify({ issue: Number(first), status: item.status ?? null }) : (item.status ?? "—"));
        return 0;
    }
    if (command === "set") {
        if (!first || rest.length === 0) throw new Error(`set требует номер и состояние.\n\n${USAGE}`);
        console.log(setStatus(project, Number(first), rest.join(" ")));
        return 0;
    }
    if (command === "list") {
        if (!first) throw new Error(`list требует состояние.\n\n${USAGE}`);
        const wanted = [first, ...rest].join(" ").toLowerCase();
        const found = items(project)
            .filter(item => (item.status ?? "").toLowerCase() === wanted)
            .map(item => ({ issue: item.content?.number, title: item.content?.title, url: item.content?.url }))
            .filter(item => item.issue !== undefined);
        console.log(json ? JSON.stringify(found, null, 2) : found.map(item => `#${item.issue}  ${item.title}`).join("\n"));
        return 0;
    }
    console.error(USAGE);
    return 2;
}

try {
    process.exit(main(process.argv.slice(2)));
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
