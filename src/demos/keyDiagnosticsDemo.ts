/**
 * Key Diagnostics Demo — full input-pipeline tracer for debugging keys across
 * environments (local vs ssh vs tmux).
 *
 * Usage: npx tsx src/demos/keyDiagnosticsDemo.ts
 *
 * Enables EXACTLY what the real vexx backend enables (Kitty keyboard protocol +
 * xterm modifyOtherKeys + bracketed paste), then for every keypress prints the
 * whole chain so you can see where a key gets lost:
 *
 *   raw bytes → tokens (with Kitty eventType) → KeyPressEvent → binding string →
 *   which builtin command it matches (+ its `when` gate)
 *
 * Press keys (Ctrl+Tab, Ctrl+Shift+L, …). Ctrl+C to exit.
 */

import { fileSaveAction } from "../vs/workbench/contrib/files/tui/fileActions.ts";
import { findAction } from "../vs/editor/contrib/find/tui/findActions.ts";
import { quickOpenAction, showCommandsAction } from "../vs/workbench/contrib/quickaccess/tui/quickOpenActions.ts";
import {
    closeActiveEditorAction,
    nextEditorInGroupAction,
    previousEditorInGroupAction,
} from "../vs/workbench/tui/parts/editor/tabActions.ts";
import type { CommandAction } from "../vs/platform/commands/common/commandAction.ts";
import { formatKeybinding, type Keybinding } from "../vs/platform/keybinding/common/keybindingsRegistry.ts";
import {
    detectBaseModes,
    detectExtendedKeysHint,
    detectKittyGraphicsHint,
    detectTruecolor,
    emptyCapabilities,
    resolveTier,
} from "../vs/workbench/terminalEnvironment/terminalEnvironmentModel.ts";
import type { KeyPressEvent } from "../vs/tui/input/keyEvent.ts";
import { KeyInputParser } from "../vs/tui/input/keyInputParser.ts";
import { tokenize } from "../vs/tui/input/tokenize.ts";

import { addCleanup, isCtrlC, stdin, stdout, writeDirect } from "./demoSetup.ts";

// ── Replicate the rest of vexx's input modes (demoSetup already did Kitty + raw mode) ──
const MODIFY_OTHER_KEYS_ENABLE = "\x1b[>4;2m";
const MODIFY_OTHER_KEYS_DISABLE = "\x1b[>4;0m";
const BRACKETED_PASTE_ENABLE = "\x1b[?2004h";
const BRACKETED_PASTE_DISABLE = "\x1b[?2004l";
writeDirect(MODIFY_OTHER_KEYS_ENABLE);
writeDirect(BRACKETED_PASTE_ENABLE);
addCleanup(() => {
    writeDirect(MODIFY_OTHER_KEYS_DISABLE);
    writeDirect(BRACKETED_PASTE_DISABLE);
});

// ── Colors ──
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const gray = (s: string) => `\x1b[90m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ── Builtin bindings to resolve against (the ones we care about while debugging) ──
interface ResolvedBinding {
    id: string;
    kb: Keybinding;
    when: string | undefined;
}

/** Flatten an action's primary + alternative bindings into plain Keybindings (+ when). */
function actionBindings(action: CommandAction): ResolvedBinding[] {
    const out: ResolvedBinding[] = [];
    const entries = [action.keybinding, ...(action.keybindings ?? [])].filter((e) => e != null);
    for (const entry of entries) {
        let kb: Keybinding | undefined;
        let when = action.when;
        if (Array.isArray(entry)) {
            kb = entry[0]; // chord — match on its first part for this demo
        } else if ("keys" in entry) {
            const keys = entry.keys;
            kb = Array.isArray(keys) ? keys[0] : keys;
            when = [action.when, entry.when].filter(Boolean).join(" && ") || undefined;
        } else {
            kb = entry;
        }
        out.push({ id: action.id, kb, when });
    }
    return out;
}

const BINDINGS: ResolvedBinding[] = [
    nextEditorInGroupAction,
    previousEditorInGroupAction,
    closeActiveEditorAction,
    fileSaveAction,
    findAction,
    quickOpenAction,
    showCommandsAction,
].flatMap(actionBindings);

function eventToKeybinding(e: KeyPressEvent): Keybinding {
    return { key: e.key, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey };
}

/** Same shape as KeybindingRegistry.matchesBinding (mods exact + key case-insensitive). */
function matches(e: KeyPressEvent, b: Keybinding): boolean {
    return (
        e.ctrlKey === b.ctrlKey &&
        e.shiftKey === b.shiftKey &&
        e.altKey === b.altKey &&
        e.metaKey === b.metaKey &&
        e.key.toLowerCase() === b.key.toLowerCase()
    );
}

// ── Helpers ──
const hex = (s: string) => Array.from(s, (c) => "0x" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(" ");

function mods(e: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }): string {
    return (
        [e.ctrlKey && "Ctrl", e.shiftKey && "Shift", e.altKey && "Alt", e.metaKey && "Meta"]
            .filter(Boolean)
            .join("+") || "—"
    );
}

function describeToken(t: ReturnType<typeof tokenize>[number]): string {
    if (t.kind === "csi-u") {
        return `csi-u  codepoint=${t.codepoint} key=${t.key} eventType=${t.eventType} mods=${mods(t)}`;
    }
    if (t.kind === "csi-tilde")
        return `csi-tilde number=${t.number} key=${t.key} eventType=${t.eventType} mods=${mods(t)}`;
    if (t.kind === "csi-letter")
        return `csi-letter ${t.finalByte} key=${t.key} eventType=${t.eventType} mods=${mods(t)}`;
    if (t.kind === "ctrl-char") return `ctrl-char letter=${t.letter}`;
    if (t.kind === "char") return `char '${t.char}'`;
    if (t.kind === "special-key") return `special-key ${t.key}`;
    if (t.kind === "esc-char") return `esc-char '${t.char}'`;
    return t.kind;
}

// ── Environment snapshot ──
function printEnv(): void {
    const caps = emptyCapabilities();
    caps["extended-keys"] = detectExtendedKeysHint();
    caps["kitty-graphics"] = detectKittyGraphicsHint();
    caps.truecolor = detectTruecolor();
    const tier = resolveTier(caps);
    const modesSet = [...detectBaseModes()];
    if (process.env.TMUX) modesSet.push("tmux");
    stdout.write(bold("⌨  Key Diagnostics") + " (Kitty + modifyOtherKeys + bracketed paste enabled)\r\n");
    stdout.write(
        gray(
            `  env: TERM=${process.env.TERM ?? ""} TMUX=${process.env.TMUX ? "yes" : "no"} ` +
                `SSH=${process.env.SSH_CONNECTION ? "yes" : "no"} KITTY_WINDOW_ID=${process.env.KITTY_WINDOW_ID ?? "(empty)"}`,
        ) + "\r\n",
    );
    stdout.write(
        gray(`  startup tier=`) +
            yellow(tier) +
            gray(`  modes=[${[...new Set(modesSet)].join(", ")}]  (csi-u arriving at runtime ⇒ extended-keys)`) +
            "\r\n",
    );
    stdout.write(gray("  Press keys — Ctrl+Tab, Ctrl+Shift+L, paste… Ctrl+C to exit.\r\n\r\n"));
}

printEnv();

const parser = new KeyInputParser();
let sawCsiU = false;

stdin.on("data", (chunk: string) => {
    stdout.write(cyan("⬢ raw ") + gray(hex(chunk)) + "\r\n");

    for (const t of tokenize(chunk)) {
        stdout.write("    " + gray("token  ") + describeToken(t) + "\r\n");
    }

    const streams = parser.parseWithMouse(chunk);
    for (const text of streams.paste) {
        stdout.write("    " + green("PASTE ") + JSON.stringify(text) + "\r\n");
    }

    for (const e of streams.keys) {
        if (e.type === "keypress" && isCtrlC(e.ctrlKey, e.key)) process.exit(0);

        const line = `${e.type.padEnd(8)} key=${e.key.padEnd(10)} code=${(e.code || "").padEnd(12)} mods=${mods(e)}`;
        stdout.write("    event  " + line + "\r\n");

        if (e.type !== "keydown") continue;

        const isCsiU = e.raw.charCodeAt(0) === 0x1b && /^\[[0-9;:]*u$/.test(e.raw.slice(1));
        if (isCsiU && !sawCsiU) {
            sawCsiU = true;
            stdout.write(
                "    " + green("→ CSI-u key seen — extended-keys confirmed; vexx would upgrade tier to csi-u") + "\r\n",
            );
        }

        const binding = formatKeybinding([eventToKeybinding(e)]);
        const hits = BINDINGS.filter((b) => matches(e, b.kb));
        if (hits.length === 0) {
            stdout.write("    " + gray(`binding ${binding} → (no builtin match in the demo's set)`) + "\r\n");
        } else {
            for (const h of hits) {
                stdout.write(
                    "    " +
                        green(`binding ${binding} → ${h.id}`) +
                        (h.when ? yellow(`  when: ${h.when}`) : "") +
                        "\r\n",
                );
            }
            stdout.write(
                "    " +
                    red(
                        "⚠ matched — if this does nothing in vexx, the `when` gate above is false (e.g. need ≥2 tabs)",
                    ) +
                    "\r\n",
            );
        }
    }
    stdout.write("\r\n");
});
