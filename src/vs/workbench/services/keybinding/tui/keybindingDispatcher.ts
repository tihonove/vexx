import { Disposable } from "../../../../base/common/lifecycle.ts";
import type { TUIKeyboardEvent } from "../../../../base/tui/events/tuiKeyboardEvent.ts";
import type { BodyElement } from "../../../../base/tui/bodyElement.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commands.ts";
import type { ContextKeyService } from "../../../../platform/contextkey/common/contextKeyService.ts";
import type { Keybinding, KeybindingRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import { formatKeybinding, parseChord } from "../../../../platform/keybinding/common/keybindingsRegistry.ts";
import type { CommandTrigger, ModifierReleaseArmory } from "../../../../platform/keybinding/common/modifierReleaseArmory.ts";
import type { ILogger } from "../../../../platform/log/common/logger.ts";
import type { IUserKeybindingRule } from "../../../../platform/keybinding/node/keybindingsService.ts";
import type { TerminalEnvironmentService } from "../../../terminalEnvironment/terminalEnvironmentService.ts";

// How long to wait for the next chord part before cancelling (matches VS Code).
const CHORD_TIMEOUT_MS = 5000;

// How long the "… is not a command" status message lingers after a broken chord.
const CHORD_NOT_FOUND_MS = 4000;

// Context keys that reflect WHAT IS FOCUSED (set from `activeElement` in updateContextKeys).
// A keybinding whose `when` names one of these is scoped to the focused input/list/editor —
// e.g. clipboard / undo / cursor commands that edit the focused widget. While a capturing overlay
// (quickpick, dialog, menu) owns the keyboard, only such focus-scoped commands may run; everything
// else (workbench/navigation commands, which carry no focus-scoped `when`) is suppressed so a
// shortcut can't act on a panel behind the still-visible overlay. See dispatchKey.
const FOCUS_SCOPED_CONTEXT_KEYS = ["inputWidgetFocus", "textInputFocus", "listFocus"] as const;

function isFocusScopedWhen(when: string | undefined): boolean {
    return when !== undefined && FOCUS_SCOPED_CONTEXT_KEYS.some((key) => when.includes(key));
}

// Modifier keys that arrive as standalone keydowns (Kitty protocol). They must
// not break or advance an in-progress chord.
const modifierKeyNames = new Set(["Control", "Shift", "Alt", "Meta", "Hyper", "Super", "AltGraph", "CapsLock"]);

function isModifierKey(key: string): boolean {
    return modifierKeyNames.has(key);
}

/**
 * A CSI-u encoded key (`ESC [ <code>[;<mods>] u`). A key only arrives in this form when the
 * Kitty keyboard protocol / xterm modifyOtherKeys is actually engaged — so receiving one is
 * proof of `extended-keys` support, even behind tmux where the capability probe can't confirm.
 */
// eslint-disable-next-line no-control-regex
const CSI_U_KEY_RAW = /^\x1b\[[0-9;:]*u$/;

function eventToKeybinding(event: TUIKeyboardEvent): Keybinding {
    return {
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
    };
}

interface IKeybindingDispatcherDeps {
    readonly keybindings: KeybindingRegistry;
    readonly commands: CommandRegistry;
    readonly contextKeys: ContextKeyService;
    readonly armory: ModifierReleaseArmory;
    readonly terminalEnv: TerminalEnvironmentService;
    readonly logger: ILogger;
    /** Пишет chord-подсказку в статус-бар (null — снять). */
    setChordHint(hint: string | null): void;
    /** Пересчитать context keys прямо перед резолвом клавиши. */
    onBeforeDispatch(): void;
}

/**
 * Клавиатурный диспетчер воркбенча: подписывается на key-события корневого
 * элемента, резолвит их через реестр биндингов и исполняет команды. Владеет
 * всей механикой аккордов (двухшаговые сочетания, таймауты, «(…) is not a
 * command», проглатывание парного keypress) и модальностью клавиатуры при
 * открытом overlay. Аналог связки abstractKeybindingService +
 * workbench keybinding service у vscode, ужатый до нужд vexx.
 */
export class KeybindingDispatcher extends Disposable {
    private chordTimer: ReturnType<typeof setTimeout> | null = null;
    private notFoundTimer: ReturnType<typeof setTimeout> | null = null;
    private swallowNextKeyPress = false;
    private view: BodyElement | null = null;

    public constructor(private readonly deps: IKeybindingDispatcherDeps) {
        super();
        this.register({
            dispose: () => {
                this.clearChordTimeout();
                this.clearNotFoundTimer();
            },
        });
    }

    /**
     * Подписывает диспетчер на key-события корневого элемента. Capture-фаза
     * перехватывает продолжение аккорда до фокусного виджета; bubble-фаза
     * обрабатывает обычные биндинги и старты аккордов.
     */
    public mount(view: BodyElement): void {
        this.view = view;
        view.addEventListener("keydown", this.handleKeyDownCapture, { capture: true });
        view.addEventListener("keypress", this.handleKeyPressCapture, { capture: true });
        view.addEventListener("keydown", this.handleKeyDown);
        view.addEventListener("keyup", this.handleKeyUp);
    }

    /**
     * Applies user `keybindings.json` rules. A `-command` rule unbinds (the exact key, or all
     * bindings for the command if no key); other rules add a binding that wins over defaults.
     * `when` may reference tier / cap_* / mode_* / os.
     */
    public applyUserKeybindings(rules: readonly IUserKeybindingRule[]): void {
        for (const rule of rules) {
            if (rule.command.startsWith("-")) {
                const commandId = rule.command.slice(1);
                this.deps.keybindings.removeBindings(commandId, rule.key ? parseChord(rule.key) : undefined);
            } else {
                this.register(this.deps.keybindings.register(parseChord(rule.key), rule.command, rule.when));
            }
        }
    }

    public cancelPendingChord(): void {
        if (this.deps.keybindings.pendingLength > 0) {
            this.deps.logger.debug("chord cancelled (focus change / timeout)");
        }
        this.clearChordTimeout();
        this.clearNotFoundTimer();
        this.deps.keybindings.resetPending();
        this.swallowNextKeyPress = false;
        this.deps.setChordHint(null);
    }

    // Capture phase: while a chord is in progress, intercept the next key
    // before it reaches the focused widget and swallow it entirely — so the
    // continuation key never leaks into the editor, matched or not.
    private handleKeyDownCapture = (event: TUIKeyboardEvent): void => {
        this.observeExtendedKeys(event);
        if (this.deps.keybindings.pendingLength === 0) return; // not in a chord — let the bubble handler run
        if (isModifierKey(event.key)) return; // holding a modifier must not break the chord
        event.preventDefault();
        event.stopImmediatePropagation();
        this.dispatchKey(event);
    };

    /**
     * Promote the terminal tier off `legacy` the moment a CSI-u key actually arrives — the only
     * reliable extended-keys signal behind tmux, which drops the startup capability probe.
     */
    private observeExtendedKeys(event: TUIKeyboardEvent): void {
        if (this.deps.terminalEnv.hasCapability("extended-keys")) return;
        if (CSI_U_KEY_RAW.test(event.raw)) this.deps.terminalEnv.noteExtendedKeysObserved();
    }

    private handleKeyPressCapture = (event: TUIKeyboardEvent): void => {
        if (!this.swallowNextKeyPress) return;
        this.swallowNextKeyPress = false;
        event.preventDefault();
        event.stopImmediatePropagation();
    };

    // Bubble phase: only reached when no chord is pending (otherwise the capture
    // handler stops propagation). Handles ordinary bindings and chord starts.
    private handleKeyDown = (event: TUIKeyboardEvent): void => {
        if (this.dispatchKey(event)) {
            event.preventDefault();
        }
    };

    // Отпускание модификатора завершает «hold-сессии» команд (MRU-переключение
    // вкладок и т.п.) через ModifierReleaseArmory. Какой именно модификатор ждать,
    // решает сама команда по своему аккорду — здесь только маршрутизация keyup.
    // Требует Kitty keyboard protocol с event types: только он присылает keyup для
    // одиночного модификатора.
    private handleKeyUp = (event: TUIKeyboardEvent): void => {
        this.deps.armory.fireRelease(event.key);
    };

    /**
     * Resolves a key against the keybinding registry and applies the outcome
     * (run command, enter/cancel chord mode, update the status-bar hint).
     * Returns true if the key was consumed (caller should preventDefault).
     */
    private dispatchKey(event: TUIKeyboardEvent): boolean {
        const { keybindings, commands, contextKeys, armory, logger } = this.deps;
        this.deps.onBeforeDispatch();
        this.clearChordTimeout();
        this.clearNotFoundTimer();
        this.swallowNextKeyPress = false;
        const pendingBefore = keybindings.pendingLength;
        // Capture the chord prefix BEFORE resolving (resolveKey clears it on a break).
        const prefix = pendingBefore > 0 ? keybindings.getPendingChord(contextKeys) : [];
        const res = keybindings.resolveKey(event, contextKeys);

        logger.debug("keydown", {
            key: event.key,
            code: event.code,
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey,
            meta: event.metaKey,
            pendingBefore,
            result: res.kind,
            commandId: res.kind === "command" ? res.commandId : undefined,
            chord: res.kind === "chord" ? formatKeybinding(res.chord) : undefined,
        });

        // Keyboard modality, symmetric to the pointer path (OverlayLayer.elementFromPoint stops a
        // click landing behind a modal). While a quickpick / dialog / menu owns the keyboard, only
        // commands scoped to the focused input/list/editor (their `when` names a focus context key
        // — e.g. clipboard / undo inside the quickpick query) may run. Workbench/navigation commands
        // are suppressed so a shortcut can't act on a panel behind the still-visible overlay.
        const overlayCaptures = this.view?.overlayLayer.hasKeyboardCapturingOverlay() ?? false;

        if (res.kind === "chord") {
            if (overlayCaptures) {
                // No new chord may start while an overlay owns the keyboard.
                keybindings.resetPending();
                this.deps.setChordHint(null);
                return false;
            }
            // Prefix key of a chord — swallow its keypress and wait for the next.
            this.swallowNextKeyPress = true;
            this.deps.setChordHint(`(${formatKeybinding(res.chord)}) was pressed. Waiting for next key…`);
            this.startChordTimeout();
            return true;
        }

        // A continuation key (command or none) ends chord mode; its keypress
        // must be swallowed too so a broken chord does not leak into the editor.
        const wasInChord = pendingBefore > 0;
        if (wasInChord) this.swallowNextKeyPress = true;

        if (res.kind === "command" && commands.has(res.commandId)) {
            if (overlayCaptures && !isFocusScopedWhen(res.when)) {
                // A workbench/navigation shortcut fired while an overlay owns the keyboard:
                // swallow it (no preventDefault) instead of acting behind the overlay.
                this.deps.setChordHint(null);
                return false;
            }
            this.deps.setChordHint(null);
            // Даём команде контекст модификаторов аккорда: команды с «hold-сессией»
            // (MRU-вкладки) взводят коммит на отпускание удерживающего модификатора
            // именно по ним. Через контекст, а не позиционный аргумент — чтобы не
            // конфликтовать с командами, у которых есть свои аргументы.
            const trigger: CommandTrigger = {
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
            };
            armory.withTrigger(trigger, () => commands.execute(res.commandId));
            // A key that would otherwise be TYPED into the editor still emits a paired
            // keypress (preventDefault on keydown does not suppress it — only
            // swallowNextKeyPress does). When such a key ran a command over a text input
            // (e.g. Enter → acceptSelectedSuggestion), swallow the keypress so it does
            // not also insert a newline/character behind the command. Gated on
            // textInputFocus to keep inputs/lists/find untouched.
            const wouldType =
                event.key === "Enter" ||
                (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey);
            if (wouldType && contextKeys.get("textInputFocus") === true) {
                this.swallowNextKeyPress = true;
            }
            return true;
        }

        if (wasInChord) {
            // Broken chord: report the unmatched combination, like VS Code.
            const combo = formatKeybinding([...prefix, eventToKeybinding(event)]);
            this.showChordNotFound(combo);
            return true; // consumed (no command, no leak)
        }

        this.deps.setChordHint(null);
        return false;
    }

    private showChordNotFound(combo: string): void {
        this.deps.setChordHint(`(${combo}) is not a command`);
        this.notFoundTimer = setTimeout(() => {
            this.notFoundTimer = null;
            this.deps.setChordHint(null);
        }, CHORD_NOT_FOUND_MS);
    }

    private clearNotFoundTimer(): void {
        if (this.notFoundTimer !== null) {
            clearTimeout(this.notFoundTimer);
            this.notFoundTimer = null;
        }
    }

    private startChordTimeout(): void {
        this.chordTimer = setTimeout(() => {
            this.chordTimer = null;
            this.deps.keybindings.resetPending();
            this.swallowNextKeyPress = false;
            this.deps.setChordHint(null);
        }, CHORD_TIMEOUT_MS);
    }

    private clearChordTimeout(): void {
        if (this.chordTimer !== null) {
            clearTimeout(this.chordTimer);
            this.chordTimer = null;
        }
    }
}
