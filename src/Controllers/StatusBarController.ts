import { token } from "../Common/DiContainer.ts";
import { DisplayLine } from "../Common/DisplayLine.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { getEncodingInfo } from "../Editor/Encoding.ts";
import { EndOfLine } from "../Editor/EndOfLine.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { StatusBarItem } from "../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import type { CommandRegistry } from "./CommandRegistry.ts";
import { CommandRegistryDIToken } from "./CommandRegistry.ts";
import { LanguageServiceDIToken } from "./CoreTokens.ts";
import type { EditorController } from "./EditorController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import type { IController } from "./IController.ts";
import type { TerminalEnvironmentService } from "./TerminalEnvironment/TerminalEnvironmentService.ts";
import { TerminalEnvironmentServiceDIToken } from "./TerminalEnvironment/TerminalEnvironmentService.ts";

export const StatusBarControllerDIToken = token<StatusBarController>("StatusBarController");

export class StatusBarController extends Disposable implements IController {
    public static dependencies = [
        EditorGroupControllerDIToken,
        ThemeServiceDIToken,
        TerminalEnvironmentServiceDIToken,
        LanguageServiceDIToken,
        CommandRegistryDIToken,
    ] as const;

    public readonly view: StatusBarElement;
    private editorGroupController: EditorGroupController;
    private terminalEnv: TerminalEnvironmentService;
    private languageService: ILanguageService;
    private commands: CommandRegistry;
    private chordHint: string | null = null;
    private cursorSubscription: IDisposable | null = null;
    private languageSubscription: IDisposable | null = null;
    private eolSubscription: IDisposable | null = null;
    private encodingSubscription: IDisposable | null = null;

    public constructor(
        editorGroupController: EditorGroupController,
        themeService: ThemeService,
        terminalEnv: TerminalEnvironmentService,
        languageService: ILanguageService,
        commands: CommandRegistry,
    ) {
        super();
        this.editorGroupController = editorGroupController;
        this.terminalEnv = terminalEnv;
        this.languageService = languageService;
        this.commands = commands;
        this.view = new StatusBarElement();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
        this.register(
            this.terminalEnv.onDidChange(() => {
                this.update();
            }),
        );
        this.register(
            this.editorGroupController.onActiveEditorChanged((editor) => {
                this.bindEditorListeners(editor);
                this.update();
            }),
        );
        this.register({ dispose: () => this.cursorSubscription?.dispose() });
        this.register({ dispose: () => this.languageSubscription?.dispose() });
        this.register({ dispose: () => this.eolSubscription?.dispose() });
        this.register({ dispose: () => this.encodingSubscription?.dispose() });
    }

    public mount(): void {
        // Pick up an editor that became active before this subscription existed.
        this.bindEditorListeners(this.editorGroupController.getActiveEditor());
        this.update();
    }

    /**
     * Re-points the per-editor listeners at the currently active editor so the
     * Ln/Col and language indicators track it live. Disposes the previous ones.
     */
    private bindEditorListeners(editor: EditorController | null): void {
        this.cursorSubscription?.dispose();
        this.cursorSubscription =
            editor?.onDidChangeCursorPosition(() => {
                this.update();
            }) ?? null;
        this.languageSubscription?.dispose();
        this.languageSubscription =
            editor?.onDidChangeLanguage(() => {
                this.update();
            }) ?? null;
        this.eolSubscription?.dispose();
        this.eolSubscription =
            editor?.onDidChangeEol(() => {
                this.update();
            }) ?? null;
        this.encodingSubscription?.dispose();
        this.encodingSubscription =
            editor?.onDidChangeEncoding(() => {
                this.update();
            }) ?? null;
    }

    public async activate(): Promise<void> {
        // Nothing needed
    }

    private applyTheme(theme: WorkbenchTheme): void {
        const bg = theme.getRequiredColor("statusBar.background");
        const fg = theme.getRequiredColor("statusBar.foreground");
        this.view.style = { fg, bg };
    }

    /**
     * Sets (or clears, with null) a transient hint shown while a chord is in
     * progress, e.g. "(Ctrl+K) was pressed. Waiting for next key…".
     */
    public setChordHint(text: string | null): void {
        this.chordHint = text;
        this.update();
    }

    public update(): void {
        const items: StatusBarItem[] = [];

        items.push({ text: this.terminalEnvSegment() });

        if (this.chordHint !== null) {
            items.push({ text: this.chordHint });
        }

        const activeEditor = this.editorGroupController.getActiveEditor();
        const position = this.cursorPositionText(activeEditor);
        if (position !== null) {
            items.push({ text: position, align: "right" });
        }

        // Правые элементы рендерятся в порядке массива, как в VS Code:
        // Ln/Col · Encoding · EOL · Language (Spaces добавится между Ln/Col и
        // Encoding). Encoding и EOL кликабельны — открывают свои пикеры.
        const encoding = this.encodingSegment(activeEditor);
        if (encoding !== null) {
            items.push({
                text: encoding,
                align: "right",
                onClick: () => void this.commands.execute("workbench.action.editor.changeEncoding"),
            });
        }

        const eol = this.eolSegment(activeEditor);
        if (eol !== null) {
            items.push({
                text: eol,
                align: "right",
                onClick: () => void this.commands.execute("workbench.action.editor.changeEOL"),
            });
        }

        const language = this.languageSegment(activeEditor);
        if (language !== null) {
            items.push({ text: language, align: "right" });
        }

        this.view.setItems(items);
    }

    /**
     * VS Code-style encoding indicator: the short status label of the active
     * editor's disk encoding ("UTF-8", "Windows 1251"). Null without an active
     * editor; unknown ids (defensive) fall back to the raw id.
     */
    private encodingSegment(editor: EditorController | null): string | null {
        if (editor === null) return null;
        const info = getEncodingInfo(editor.encoding);
        /* v8 ignore start -- defensive: editor.encoding всегда табличный id (setEncoding валидирует, decodeBuffer возвращает элементы SUPPORTED_ENCODINGS) */
        if (info === undefined) return editor.encoding;
        /* v8 ignore stop */
        return info.statusLabel;
    }

    /** VS Code-style end-of-line indicator: "LF" or "CRLF". */
    private eolSegment(editor: EditorController | null): string | null {
        if (editor === null) return null;
        return editor.eol === EndOfLine.CRLF ? "CRLF" : "LF";
    }

    /**
     * VS Code-style language indicator for the active editor: the language
     * display name ("TypeScript"), falling back to the raw language id when
     * the language has no registered alias. Null without an active editor.
     */
    private languageSegment(editor: EditorController | null): string | null {
        if (editor === null) return null;
        const languageId = editor.languageId;
        return this.languageService.getLanguageDisplayName(languageId) ?? languageId;
    }

    /**
     * VSCode-style "Ln X, Col Y" for the primary cursor, or null when there is
     * no active editor. The column is the tab-expanded display column (matching
     * the rendered cursor), 1-based like the line.
     */
    private cursorPositionText(editor: EditorController | null): string | null {
        if (editor === null) return null;
        const viewState = editor.viewState;
        if (viewState.selections.length === 0) return null;
        const active = viewState.selections[0].active;
        const lineContent = viewState.document.getLineContent(active.line);
        const column = new DisplayLine(lineContent, viewState.tabSize).offsetToColumn(active.character);
        return `Ln ${active.line + 1}, Col ${column + 1}`;
    }

    /**
     * Compact terminal-environment indicator: the tier, plus any active modes
     * beyond the implicit `local` (e.g. "kitty", "csi-u · ssh,tmux"). Nudges the
     * user toward a more capable terminal by surfacing the current tier.
     */
    private terminalEnvSegment(): string {
        const modes = [...this.terminalEnv.getActiveModes()].filter((m) => m !== "local").sort();
        const suffix = modes.length > 0 ? ` · ${modes.join(",")}` : "";
        return `${this.terminalEnv.tier}${suffix}`;
    }
}
