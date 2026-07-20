// Витрина состояния на :7777 — HTML + JSON + две кнопки.
//
// Она ничего не решает и не считает: только показывает то, что вывели agents.ts и history.ts.
// Кнопка «Тик сейчас» будит цикл демона; кнопка STOP — аварийный тормоз.
import { createServer, type Server } from "node:http";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";

import { listAgents } from "./agents.ts";
import type { AgentsConfig } from "./config.ts";
import { tail } from "./history.ts";
import { RUNS_DIR, STOP_FILE } from "./paths.ts";

export interface DashboardDeps {
    getConfig: () => AgentsConfig;
    /** Возвращает false, если тик уже идёт — тогда отвечаем 409, а не ставим второй в очередь. */
    requestTick: () => boolean;
    isTicking: () => boolean;
    lastTickAt: () => string | undefined;
}

export function isStopped(): boolean {
    return existsSync(STOP_FILE);
}

export function setStopped(stopped: boolean): void {
    mkdirSync(RUNS_DIR, { recursive: true });
    if (stopped) writeFileSync(STOP_FILE, `${new Date().toISOString()}\n`, "utf8");
    else if (existsSync(STOP_FILE)) rmSync(STOP_FILE);
}

async function buildState(deps: DashboardDeps) {
    const config = deps.getConfig();
    return {
        stopped: isStopped(),
        dryRun: config.dryRun,
        ticking: deps.isTicking(),
        lastTickAt: deps.lastTickAt(),
        limits: config.limits,
        agents: await listAgents(),
        history: tail(40).reverse(),
    };
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown): void {
    const text = JSON.stringify(body, null, 2);
    response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    response.end(text);
}

export function createDashboard(deps: DashboardDeps): Server {
    return createServer((request, response) => {
        void (async () => {
            const url = new URL(request.url ?? "/", "http://localhost");
            try {
                if (request.method === "POST" && url.pathname === "/api/tick") {
                    if (!deps.requestTick()) {
                        json(response, 409, { error: "тик уже идёт" });
                        return;
                    }
                    json(response, 202, { queued: true });
                    return;
                }
                if (request.method === "POST" && url.pathname === "/api/stop") {
                    const next = !isStopped();
                    setStopped(next);
                    json(response, 200, { stopped: next });
                    return;
                }
                if (url.pathname === "/api/state") {
                    json(response, 200, await buildState(deps));
                    return;
                }
                if (url.pathname === "/") {
                    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
                    response.end(PAGE);
                    return;
                }
                json(response, 404, { error: "not found" });
            } catch (error) {
                json(response, 500, { error: error instanceof Error ? error.message : String(error) });
            }
        })();
    });
}

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>vexx agents</title>
<style>
  body { font: 14px/1.5 ui-monospace, monospace; margin: 2rem; background: #111; color: #ddd; }
  h1 { font-size: 1.1rem; margin: 0 0 1rem; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 2rem; }
  th, td { text-align: left; padding: .35rem .6rem; border-bottom: 1px solid #333; }
  th { color: #888; font-weight: normal; }
  button { font: inherit; padding: .4rem .9rem; margin-right: .5rem; cursor: pointer;
           background: #222; color: #ddd; border: 1px solid #444; border-radius: 4px; }
  button:hover { background: #2c2c2c; }
  .bad { color: #e06c75; } .good { color: #98c379; } .warn { color: #e5c07b; }
  pre { background: #181818; padding: .8rem; overflow-x: auto; border-radius: 4px; }
</style>
<h1>vexx agents</h1>
<div>
  <button id="tick">Тик сейчас</button>
  <button id="stop">STOP</button>
  <span id="mode"></span>
</div>
<h2>Агенты</h2>
<table id="agents"><thead><tr>
  <th>имя<th>статус<th>idle, мин<th>возраст, мин<th>жив<th>worktree
</tr></thead><tbody></tbody></table>
<h2>История</h2>
<pre id="history"></pre>
<script>
const el = id => document.getElementById(id);
async function refresh() {
  const state = await (await fetch("/api/state")).json();
  el("mode").textContent =
    (state.stopped ? "ОСТАНОВЛЕНО" : "работает") +
    (state.dryRun ? " · dry-run" : "") +
    (state.ticking ? " · тик идёт" : "") +
    (state.lastTickAt ? " · последний тик " + state.lastTickAt : "");
  el("mode").className = state.stopped ? "bad" : "good";
  el("agents").tBodies[0].innerHTML = state.agents.map(a =>
    "<tr><td>" + a.name + "<td>" + a.status + (a.state ? " / " + a.state : "") +
    "<td>" + (a.idleMin ?? "—") + "<td>" + a.ageMin +
    "<td>" + (a.alive ? "да" : "<span class=bad>нет</span>") +
    "<td>" + a.worktree + "</tr>").join("") ||
    "<tr><td colspan=6>никого</td></tr>";
  el("history").textContent = state.history.map(e => JSON.stringify(e)).join("\\n") || "пусто";
}
el("tick").onclick = async () => {
  const r = await fetch("/api/tick", { method: "POST" });
  if (r.status === 409) alert("Тик уже идёт");
  refresh();
};
el("stop").onclick = async () => { await fetch("/api/stop", { method: "POST" }); refresh(); };
refresh();
setInterval(refresh, 5000);
</script>
`;
