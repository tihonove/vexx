import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { StatusBarItem } from "../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

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
    }

    public mount(): void {
        // Initial update
        this.update();
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

        if (activeEditor?.fileName) {
            items.push({ text: activeEditor.fileName });
        }

        if (activeEditor?.isModified) {
            items.push({ text: "[Modified]" });
        }

        this.view.setItems(items);
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
