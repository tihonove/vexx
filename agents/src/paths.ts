// Пути машинерии. Всё, что она пишет, лежит в .agents-runs/ (в .gitignore),
// worktrees агентов — в .claude/worktrees/ по конвенции AGENTS.md.
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Корень репозитория: agents/src/paths.ts → agents/ → корень. */
export const REPO_ROOT = resolve(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

export const RUNS_DIR = join(REPO_ROOT, ".agents-runs");
export const HISTORY_FILE = join(RUNS_DIR, "history.jsonl");
export const STOP_FILE = join(RUNS_DIR, "STOP");
/** Заметки агентов между запусками: файлы пишут они сами, машинерия сюда не лезет. */
export const STATE_DIR = join(RUNS_DIR, "state");
export const WORKTREES_DIR = join(REPO_ROOT, ".claude", "worktrees");

export function worktreePath(key: string): string {
    return join(WORKTREES_DIR, key);
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
 * Каталог сессий рабочей директории: ~/.claude/projects/<закодированный cwd>/.
 * Недокументированная деталь раскладки, но на ней держатся две вещи, которые иначе
 * пришлось бы хранить самим: «когда агент последний раз дышал» и «какая у него сессия».
 */
export function sessionDir(cwd: string): string {
    return join(homedir(), ".claude", "projects", encodeProjectDir(cwd));
}

export function sessionFile(cwd: string, sessionId: string): string {
    return join(sessionDir(cwd), `${sessionId}.jsonl`);
}
