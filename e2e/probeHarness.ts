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
            if (options.keepUserData !== true) rmSync(userDataDir, { recursive: true, force: true });
        },
    };
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
