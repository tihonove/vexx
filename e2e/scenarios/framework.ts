import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { GridSnapshot } from "../../src/Rendering/GridSnapshot.ts";
import type { FileDecorationEntry } from "../../src/Inspector/protocol.ts";
import { HeadlessSession } from "../helpers/headlessSession.ts";
import { saveScreenshot } from "../helpers/renderScreenshot.ts";

// ── Screenshot scenarios ────────────────────────────────────────────────────
// A scenario is the demo code for a visual feature: it launches the real editor
// headless, drives it (open files, send keys), and captures named screenshots.
// One `*.scenario.ts` file per feature/flow lives next to this module. Two
// consumers share `runScenario`: `generate.ts` (npm run screenshots → PNGs for a
// PR) and `scenarios.test.ts` (CI, keeps scenarios from rotting).

const here = fileURLToPath(new URL(".", import.meta.url));
const scenariosDir = here;
/** Repo root — scenarios open paths relative to it and run with it as cwd. */
export const repoRoot = resolve(here, "..", "..");

/** Driver handed to a scenario's `run` — the editor plus a `capture` verb. */
export interface ScenarioDriver {
    /** Inject a key by DSL name (`"a"`, `"Enter"`, `"Ctrl+P"`). */
    sendKey(name: string): Promise<void>;
    /** Inject literal text as a single paste. */
    sendText(text: string): Promise<void>;
    /** Resize the virtual terminal. */
    resize(cols: number, rows: number): Promise<void>;
    /** Apply file-tree status decorations (name colour + letter badge) by absolute path. */
    setFileDecorations(entries: FileDecorationEntry[]): Promise<void>;
    /** Poll the screen until `predicate(text)` holds; returns the matching frame. */
    waitForText(
        predicate: (text: string) => boolean,
        opts?: { timeoutMs?: number; intervalMs?: number },
    ): Promise<GridSnapshot>;
    /** Capture the current screen. */
    captureFrame(): Promise<GridSnapshot>;
    /** Capture and save `screenshots/<scenario>-<shot>.png`; returns the path. */
    capture(shot: string): Promise<string>;
}

export interface ScenarioSpec {
    /** Kebab-case id; prefixes every screenshot file. */
    name: string;
    /** Human-readable title for the screenshots index. */
    title?: string;
    /** Files/dirs the editor opens (a dir becomes the workspace folder). */
    open?: string[];
    cols?: number;
    rows?: number;
    env?: Record<string, string>;
    run(driver: ScenarioDriver): Promise<void>;
}

/** One captured screenshot with its metadata. */
export interface CapturedShot {
    scenario: string;
    shot: string;
    title: string;
    path: string;
}

/** Identity helper — gives a scenario file its typed `default` export. */
export function defineScenario(spec: ScenarioSpec): ScenarioSpec {
    return spec;
}

/**
 * Launch the real binary headless, run the scenario, capture its screenshots,
 * and tear the session down. Returns the shots it produced.
 */
export async function runScenario(spec: ScenarioSpec): Promise<CapturedShot[]> {
    const session = await HeadlessSession.start({
        args: spec.open ?? [],
        cwd: repoRoot,
        ...(spec.cols !== undefined ? { cols: spec.cols } : {}),
        ...(spec.rows !== undefined ? { rows: spec.rows } : {}),
        ...(spec.env !== undefined ? { env: spec.env } : {}),
    });
    const shots: CapturedShot[] = [];
    const driver: ScenarioDriver = {
        sendKey: (name) => session.sendKey(name),
        sendText: (text) => session.sendText(text),
        resize: (cols, rows) => session.resize(cols, rows),
        setFileDecorations: (entries) => session.setFileDecorations(entries),
        waitForText: (predicate, opts) => session.waitForText(predicate, opts),
        captureFrame: () => session.captureFrame(),
        capture: async (shot) => {
            const frame = await session.captureFrame();
            const path = saveScreenshot(`${spec.name}-${shot}`, frame);
            shots.push({ scenario: spec.name, shot, title: spec.title ?? spec.name, path });
            return path;
        },
    };
    try {
        await spec.run(driver);
    } finally {
        await session.dispose();
    }
    return shots;
}

/** Discover and import every `*.scenario.ts` in this directory (sorted by name). */
export async function loadScenarios(): Promise<ScenarioSpec[]> {
    const files = readdirSync(scenariosDir)
        .filter((f) => f.endsWith(".scenario.ts"))
        .sort();
    const specs: ScenarioSpec[] = [];
    for (const file of files) {
        const mod = (await import(pathToFileURL(resolve(scenariosDir, file)).href)) as { default?: ScenarioSpec };
        if (mod.default !== undefined) specs.push(mod.default);
    }
    return specs;
}
