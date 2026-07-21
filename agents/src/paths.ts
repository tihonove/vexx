// Пути машинерии. Всё, что она пишет, лежит в .agents-runs/ (в .gitignore),
// worktrees агентов — в .claude/worktrees/ по конвенции AGENTS.md.
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Корень репозитория: agents/src/paths.ts → agents/ → корень. */
export const REPO_ROOT = resolve(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

export const RUNS_DIR = join(REPO_ROOT, ".agents-runs");
export const TASKS_DIR = join(RUNS_DIR, "tasks");
export const HISTORY_FILE = join(RUNS_DIR, "history.jsonl");
export const STOP_FILE = join(RUNS_DIR, "STOP");
export const WORKTREES_DIR = join(REPO_ROOT, ".claude", "worktrees");

export function worktreePath(name: string): string {
    return join(WORKTREES_DIR, name);
}

export function taskPath(name: string): string {
    return join(TASKS_DIR, `${name}.json`);
}

/**
 * Кодирование cwd в имя каталога сессий: на дефис заменяются и слэши, и ТОЧКИ.
 * Из-за пропущенных точек `/workspaces/vexx/.claude/...` превращался в
 * `-workspaces-vexx-.claude-...` вместо `-workspaces-vexx--claude-...`, файл не находился,
 * и `idleMin` всегда был null — то есть весь heartbeat молча не работал.
 */
export function encodeProjectDir(cwd: string): string {
    return cwd.replaceAll(/[/.]/g, "-");
}

/**
 * Файл сессии лежит в ~/.claude/projects/<закодированный cwd>/<sessionId>.jsonl.
 * Это недокументированная деталь раскладки, но она — единственный источник «когда агент
 * последний раз дышал», и получается бесплатно, без инструментирования.
 */
export function sessionFile(cwd: string, sessionId: string): string {
    return join(homedir(), ".claude", "projects", encodeProjectDir(cwd), `${sessionId}.jsonl`);
}
