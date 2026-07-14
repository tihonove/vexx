import { describe, expect, it } from "vitest";

import type { ILogger } from "../../../../platform/log/common/logger.ts";
import type { IGutterChangeDecoration } from "../../../../editor/common/model/gutterChangeDecoration.ts";
import { flushMicrotasks } from "../../../../../TestUtils/timing.ts";

import { ExtensionHost } from "./extensionHost.ts";
import type { ICommandService } from "../../../api/common/commandService.ts";
import type { IEditorDecorationsService } from "../../../api/common/editorDecorationsService.ts";
import type { IEditorOptionsService } from "../../../api/common/editorOptionsService.ts";
import type { IFileDecorationsService } from "../../../api/common/fileDecorationsService.ts";
import type { IThemeColorResolver } from "../../../api/common/themeColorResolver.ts";
import { createInProcessChannelPair } from "../common/inProcessChannelPair.ts";
import { RpcEndpoint } from "../common/rpcProtocol.ts";

// Детерминированный in-process тест decoration-хендлеров host'а: вместо форка
// subprocess'а гоняем `installHostHandlers` на in-process RPC-паре и шлём
// нотификации сами. Так покрытие хендлеров стабильно (один воркер, без гонок
// subprocess-RPC), и легко пробить guard-ветки/пути очистки.

const NOOP_EDITOR_OPTIONS = {
    getActiveEditorOptions: () => null,
    setActiveEditorOptions: () => undefined,
    getActiveEditorFilePath: () => null,
    getActiveEditorMeta: () => ({ fileName: null, languageId: null, isDirty: false }),
    onActiveEditorChanged: () => ({ dispose: () => undefined }),
} as unknown as IEditorOptionsService;

const NOOP_COMMANDS = {
    execute: () => undefined,
    registerProxy: () => ({ dispose: () => undefined }),
} as unknown as ICommandService;

function makeLogger(): { logger: ILogger; lines: string[] } {
    const lines: string[] = [];
    const log = (level: string) => (msg: string) => lines.push(`${level}:${msg}`);
    const logger = {
        trace: log("trace"),
        debug: log("debug"),
        info: log("info"),
        warn: log("warn"),
        error: log("error"),
        isEnabled: () => true,
    } as unknown as ILogger;
    return { logger, lines };
}

function makeHost(colors: Record<string, number>) {
    const editorCalls: { fileName: string; decorations: readonly IGutterChangeDecoration[] }[] = [];
    const fileCalls: { path: string; color?: number; badge?: string }[][] = [];
    const editorDecorations: IEditorDecorationsService = {
        setGutterChangeDecorations: (fileName, decorations) => editorCalls.push({ fileName, decorations }),
    };
    const fileDecorations: IFileDecorationsService = {
        setFileDecorations: (entries) => fileCalls.push([...entries]),
    };
    const themeListeners: (() => void)[] = [];
    const themeColorResolver: IThemeColorResolver = {
        resolve: (id) => colors[id],
        onDidChange: (cb) => {
            themeListeners.push(cb);
            return { dispose: () => undefined };
        },
    };
    const configListeners: ((keys: string[]) => void)[] = [];
    const configuration = {
        getSnapshot: () => ({ some: "config" }),
        getWorkspaceFolders: () => [],
        onDidChange: (cb: (keys: string[]) => void) => {
            configListeners.push(cb);
            return { dispose: () => undefined };
        },
    };
    const { logger, lines } = makeLogger();

    const host = new ExtensionHost(NOOP_EDITOR_OPTIONS, NOOP_COMMANDS, {
        logger,
        editorDecorations,
        fileDecorations,
        themeColorResolver,
        configuration,
    });

    const [a, b] = createInProcessChannelPair();
    const hostRpc = new RpcEndpoint(a);
    const peer = new RpcEndpoint(b);
    (host as unknown as { installHostHandlers(rpc: RpcEndpoint): void }).installHostHandlers(hostRpc);

    const configChanges: unknown[] = [];
    peer.handleNotification("workspace.configurationChanged", (p) => configChanges.push(p));

    return {
        peer,
        editorCalls,
        fileCalls,
        logLines: lines,
        configChanges,
        fireTheme: () => themeListeners.forEach((cb) => cb()),
        fireConfig: (keys: string[]) => configListeners.forEach((cb) => cb(keys)),
        latestEditor: (file: string) => editorCalls.filter((c) => c.fileName === file).at(-1),
    };
}

const range = (line: number) => ({ start: { line, character: 0 }, end: { line, character: 0 } });

describe("ExtensionHost decoration handlers (in-process, deterministic)", () => {
    it("gutter: create/set/dispose, non-gutter игнор, пустой набор чистит, смена темы пере-push'ит", async () => {
        const MOD = 0x0000ff;
        const h = makeHost({ "editorGutter.modifiedBackground": MOD, "editor.background": 0x1e1e1e });

        // Битые параметры — ранний выход без throw (guard-ветки).
        h.peer.notify("window.createTextEditorDecorationType", { key: "nope" });
        h.peer.notify("editor.setDecorations", { key: 5, fileName: 42 });
        h.peer.notify("window.disposeTextEditorDecorationType", { key: "nope" });
        await flushMicrotasks(10);

        // gutter-тип (overviewRulerColor) + не-gutter тип (без него — игнорируется).
        // Типы регистрируем и ждём доставки ДО setDecorations (иначе тип ещё не в реестре).
        h.peer.notify("window.createTextEditorDecorationType", {
            key: 1,
            options: { overviewRulerColor: { $themeColor: "editorGutter.modifiedBackground" }, isWholeLine: true },
        });
        h.peer.notify("window.createTextEditorDecorationType", {
            key: 2,
            options: { backgroundColor: { $themeColor: "editor.background" } },
        });
        // options не-объект → трактуется как {} (не gutter).
        h.peer.notify("window.createTextEditorDecorationType", { key: 9, options: "not-an-object" });
        await flushMicrotasks(10);

        h.peer.notify("editor.setDecorations", { key: 1, fileName: "/a.ts", ranges: [range(1)] });
        h.peer.notify("editor.setDecorations", { key: 2, fileName: "/a.ts", ranges: [range(0)] });
        await flushMicrotasks(10);

        // dispose типа, которого нет ни в одном файле (key 9) — файл /a.ts есть, но без key 9.
        h.peer.notify("window.disposeTextEditorDecorationType", { key: 9 });
        await flushMicrotasks(10);

        const decos = h.latestEditor("/a.ts")!.decorations;
        expect(decos).toHaveLength(1);
        expect(decos[0].color).toBe(MOD);
        expect(decos[0].range.start.line).toBe(1);

        // Смена темы → пере-push держимых декораций.
        const before = h.editorCalls.length;
        h.fireTheme();
        await flushMicrotasks(10);
        expect(h.editorCalls.length).toBeGreaterThan(before);

        // Пустой набор → снятие баров.
        h.peer.notify("editor.setDecorations", { key: 1, fileName: "/a.ts", ranges: [] });
        await flushMicrotasks(10);
        expect(h.latestEditor("/a.ts")!.decorations).toEqual([]);

        // dispose типа → гасит его декорации.
        h.peer.notify("editor.setDecorations", { key: 1, fileName: "/a.ts", ranges: [range(2)] });
        await flushMicrotasks(10);
        h.peer.notify("window.disposeTextEditorDecorationType", { key: 1 });
        await flushMicrotasks(10);
        expect(h.latestEditor("/a.ts")!.decorations).toEqual([]);
    });

    it("файловые декорации: badge/colorId по отдельности, не-объект, non-file и битый uri, снятие", async () => {
        const FILE = 0x112233;
        const h = makeHost({ "gitDecoration.modifiedResourceForeground": FILE });

        h.peer.notify("window.fileDecorationsChanged", {
            decorations: [
                null, // не-объект → пропуск (parseWireFileDecorations)
                { uri: "file:///both.md", badge: "M", colorId: "gitDecoration.modifiedResourceForeground" },
                { uri: "file:///badge.md", badge: "A" }, // только badge (colorId undefined)
                { uri: "file:///color.md", colorId: "gitDecoration.modifiedResourceForeground" }, // только colorId (badge undefined)
                { uri: "untitled:scratch", badge: "U" }, // не file:// → fileUriToPath возвращает как есть
                { uri: "file:///%E0%A4%A", badge: "D" }, // битый percent-encoding → catch в fileUriToPath
            ],
        });
        await flushMicrotasks(10);
        const entries = h.fileCalls.at(-1)!;
        expect(entries).toContainEqual({ path: "/both.md", color: FILE, badge: "M" });
        expect(entries).toContainEqual({ path: "/badge.md", badge: "A" }); // без color
        expect(entries).toContainEqual({ path: "/color.md", color: FILE }); // без badge
        expect(entries).toContainEqual({ path: "untitled:scratch", badge: "U" }); // non-file uri — как есть
        expect(entries).toContainEqual({ path: "/%E0%A4%A", badge: "D" }); // битый uri → rest из catch

        // Голый uri (без badge/colorId) → снятие.
        h.peer.notify("window.fileDecorationsChanged", { decorations: [{ uri: "file:///both.md" }] });
        await flushMicrotasks(10);
        expect(h.fileCalls.at(-1)!.some((e) => e.path === "/both.md")).toBe(false);
    });

    it("window.showMessage маршрутизирует severity в логгер; конфиг-изменение шлёт в subprocess", async () => {
        const h = makeHost({});
        h.peer.notify("window.showMessage", { severity: "error", message: "boom" });
        h.peer.notify("window.showMessage", { severity: "warn", message: "careful" });
        h.peer.notify("window.showMessage", { severity: "info", message: 7 });
        await flushMicrotasks(10);
        expect(h.logLines).toEqual(["error:[extension] boom", "warn:[extension] careful", "info:[extension] 7"]);

        h.fireConfig(["git.enabled"]);
        await flushMicrotasks(10);
        expect(h.configChanges.at(-1)).toEqual({ configuration: { some: "config" }, affectedKeys: ["git.enabled"] });
    });
});
