import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GridSnapshot } from "../tuidom/rendering/gridSnapshot.ts";
import type { NodeSnapshot } from "../tuidom/inspector/protocol.ts";

import { HeadlessSession } from "./helpers/headlessSession.ts";

// Общая обвязка пробных (тестировочных) e2e-прогонов по PR #197.
// Живёт отдельно от `e2e/helpers/`, чтобы не мешаться с продуктовыми хелперами.

const here = fileURLToPath(new URL(".", import.meta.url));
export const repoRoot = resolve(here, "..");
export const fixturePath = resolve(here, "fixtures", "sample.ts");

/** Кейбинды, нужные пробам: команд без дефолтного шортката тут большинство. */
export const PROBE_KEYBINDINGS: readonly { key: string; command: string }[] = [
    { key: "alt+u", command: "workbench.action.output.toggleOutput" },
    { key: "alt+j", command: "workbench.action.output.show.extensions" },
    { key: "alt+b", command: "workbench.action.output.show.bootstrap" },
    { key: "alt+y", command: "workbench.action.output.show.extensions.host.stderr" },
    { key: "alt+r", command: "workbench.action.files.toggleActiveEditorReadonlyInSession" },
    { key: "alt+n", command: "workbench.action.editor.toggleEOL" },
    { key: "alt+w", command: "editor.action.trimTrailingWhitespace" },
    { key: "alt+q", command: "workbench.action.editor.changeEncoding" },
    { key: "alt+t", command: "workbench.action.terminal.toggleTerminal" },
];

export interface ProbeSession {
    session: HeadlessSession;
    userDataDir: string;
    dispose(): Promise<void>;
}

export interface StartProbeOptions {
    args?: string[];
    cols?: number;
    rows?: number;
    /** Переиспользовать существующий user-data-dir (проба персиста сессии). */
    userDataDir?: string;
    /** Не удалять user-data-dir при dispose (нужно для перезапуска). */
    keepUserData?: boolean;
    keybindings?: readonly { key: string; command: string }[];
}

/** Запускает настоящий SEA-бинарь в hermetic user-data-dir с пробными кейбиндами. */
export async function startProbe(options: StartProbeOptions = {}): Promise<ProbeSession> {
    const userDataDir = options.userDataDir ?? mkdtempSync(join(tmpdir(), "vexx-probe-"));
    const userDir = join(userDataDir, "user-data", "User");
    mkdirSync(userDir, { recursive: true });
    writeFileSync(join(userDir, "keybindings.json"), JSON.stringify(options.keybindings ?? PROBE_KEYBINDINGS, null, 2));

    const session = await HeadlessSession.start({
        args: [`--user-data-dir=${userDataDir}`, ...(options.args ?? [repoRoot, fixturePath])],
        cwd: repoRoot,
        ...(options.cols !== undefined ? { cols: options.cols } : {}),
        ...(options.rows !== undefined ? { rows: options.rows } : {}),
    });

    return {
        session,
        userDataDir,
        dispose: async () => {
            await session.dispose();
            if (options.keepUserData !== true) removeTempDir(userDataDir);
        },
    };
}

/**
 * Удаляет временный каталог, переживая Windows.
 *
 * `dispose()` завершает процесс редактора, но Windows отдаёт хендлы не мгновенно
 * — и `rmSync` падает с `EPERM`, роняя тест на ровном месте (`force: true` тут не
 * помогает, он про «не ругаться на отсутствующий путь»). `maxRetries`/`retryDelay`
 * — штатный ответ Node ровно на этот класс ошибок.
 *
 * Если не вышло и после ретраев — не падаем: это `tmpdir()`, его подчистит
 * система, а тест про уборку ничего не утверждает.
 */
export function removeTempDir(dir: string): void {
    try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
        // best-effort: временный каталог не стоит упавшего теста
    }
}

/** Плоский текст кадра (как `frameToText`, но с сохранением trailing-пробелов не нужно). */
export function frameText(frame: GridSnapshot): string {
    const lines: string[] = [];
    for (let y = 0; y < frame.rows; y++) {
        let line = "";
        for (let x = 0; x < frame.cols; x++) line += frame.cells[y * frame.cols + x].char;
        lines.push(line.replace(/\s+$/u, ""));
    }
    return lines.join("\n");
}

/** Одна строка кадра по индексу. */
export function frameLine(frame: GridSnapshot, y: number): string {
    let line = "";
    for (let x = 0; x < frame.cols; x++) line += frame.cells[y * frame.cols + x].char;
    return line;
}

/** Печатный дамп кадра с номерами строк — для отладки упавшей пробы. */
export function dumpFrame(frame: GridSnapshot): string {
    const lines: string[] = [];
    for (let y = 0; y < frame.rows; y++) lines.push(`${String(y).padStart(2, " ")}|${frameLine(frame, y)}`);
    return lines.join("\n");
}

export function nodeOfType(root: NodeSnapshot | null, type: string): NodeSnapshot | null {
    return findAll(root, (n) => n.type === type)[0] ?? null;
}

export function findAll(root: NodeSnapshot | null, predicate: (n: NodeSnapshot) => boolean): NodeSnapshot[] {
    const out: NodeSnapshot[] = [];
    const visit = (node: NodeSnapshot): void => {
        if (predicate(node)) out.push(node);
        for (const child of node.children) visit(child);
    };
    if (root !== null) visit(root);
    return out;
}

/** Элемент, у которого стоит `focused` (в снимке их может быть несколько по пути). */
export function focusedLeaf(root: NodeSnapshot | null): NodeSnapshot | null {
    const focused = findAll(root, (n) => n.focused);
    return focused.length > 0 ? focused[focused.length - 1] : null;
}

/** Путь типов от корня до узла — чтобы понять, где именно живёт фокус. */
export function pathToNode(root: NodeSnapshot | null, target: NodeSnapshot): string[] {
    const path: string[] = [];
    const visit = (node: NodeSnapshot, acc: string[]): boolean => {
        const next = [...acc, node.type];
        if (node.nodeId === target.nodeId) {
            path.push(...next);
            return true;
        }
        for (const child of node.children) if (visit(child, next)) return true;
        return false;
    };
    if (root !== null) visit(root, []);
    return path;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Заголовки вкладок нижней панели в порядке регистрации. */
export const PANEL_TABS = ["PROBLEMS", "OUTPUT", "TERMINAL"] as const;

/**
 * Точка для клика по вкладке нижней панели. Считается из `box` самого
 * `PanelContainerElement`, а не сканированием кадра: вкладки рисуются прямо в
 * контейнере (своих элементов у них нет), но геометрия детерминированная —
 * отступ 1, паддинг 1 с каждой стороны, строка табов вторая сверху (см.
 * `TAB_INDENT` / `TAB_PAD` / `TAB_ROW` в `tuidom/ui/panel/panelContainerElement.ts`).
 *
 * Именно ради этого хелпера: сканирование текста кадра ломалось на медленном
 * Windows-раннере — если панель не успевала отрисоваться, координата уезжала в
 * произвольное место экрана и клик попадал в файловое дерево.
 */
export function panelTabPoint(root: NodeSnapshot | null, title: (typeof PANEL_TABS)[number]): { x: number; y: number } {
    const panel = nodeOfType(root, "PanelContainerElement");
    if (panel === null) throw new Error("PanelContainerElement не найден — панель не открыта?");
    const index = PANEL_TABS.indexOf(title);
    let x = panel.box.x + 1; // TAB_INDENT
    for (let i = 0; i < index; i++) x += PANEL_TABS[i].length + 2; // TAB_PAD * 2
    return { x: x + 1 + Math.floor(title.length / 2), y: panel.box.y + 1 }; // TAB_ROW
}
