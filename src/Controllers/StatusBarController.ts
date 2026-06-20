import { token } from "../Common/DiContainer.ts";
import { DisplayLine } from "../Common/DisplayLine.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { StatusBarItem } from "../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

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
    ] as const;

    public readonly view: StatusBarElement;
    private editorGroupController: EditorGroupController;
    private terminalEnv: TerminalEnvironmentService;
    private chordHint: string | null = null;
    private cursorSubscription: IDisposable | null = null;

    public constructor(
        editorGroupController: EditorGroupController,
        themeService: ThemeService,
        terminalEnv: TerminalEnvironmentService,
    ) {
        super();
        this.editorGroupController = editorGroupController;
        this.terminalEnv = terminalEnv;
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
                this.bindCursorListener(editor);
                this.update();
            }),
        );
        this.register({ dispose: () => this.cursorSubscription?.dispose() });
    }

    public mount(): void {
        // Pick up an editor that became active before this subscription existed.
        this.bindCursorListener(this.editorGroupController.getActiveEditor());
        this.update();
    }

    /**
     * Re-points the cursor-position listener at the currently active editor so
     * the Ln/Col indicator tracks the live cursor. Disposes the previous one.
     */
    private bindCursorListener(editor: EditorController | null): void {
        this.cursorSubscription?.dispose();
        this.cursorSubscription = editor?.onDidChangeCursorPosition(() => this.update()) ?? null;
    }

    public async activate(): Promise<void> {
        // Nothing needed
    }

    private applyTheme(theme: WorkbenchTheme): void {
        const bg = theme.getColorOrDefault("statusBar.background", packRgb(0, 122, 204));
        const fg = theme.getColorOrDefault("statusBar.foreground", packRgb(255, 255, 255));
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

        this.view.setItems(items);
    }

    /**
     * VSCode-style "Ln X, Col Y" for the primary cursor, or null when there is
     * no active editor. The column is the tab-expanded display column (matching
     * the rendered cursor), 1-based like the line.
     */
    private cursorPositionText(editor: EditorController | null): string | null {
        if (editor === null) return null;
        const viewState = editor.viewState;
        const active = viewState.selections[0]?.active;
        if (active === undefined) return null;
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
