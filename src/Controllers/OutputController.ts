import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { ILogService, LogEntry } from "../Common/Logging/ILogService.ts";
import { ILogServiceDIToken } from "../Common/Logging/ILogServiceDIToken.ts";
import type { RingBufferSink } from "../Common/Logging/sinks/RingBufferSink.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { DropdownElement } from "../TUIDom/Widgets/DropdownElement.ts";
import type { OverlayLayer } from "../TUIDom/Widgets/OverlayLayer.ts";
import { OutputViewElement } from "../TUIDom/Widgets/OutputViewElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { applyScrollBarTheme } from "./applyScrollBarTheme.ts";
import { RingBufferSinkDIToken } from "./Modules/LoggingModule.ts";
import { OUTPUT_VIEW_ID, type PanelController, PanelControllerDIToken } from "./PanelController.ts";

export const OutputControllerDIToken = token<OutputController>("OutputController");

/**
 * Наполняет вкладку OUTPUT нижней {@link PanelController Panel} логами из
 * in-memory {@link RingBufferSink}: скроллируемый {@link OutputViewElement} с
 * live-tail плюс селектор канала ({@link DropdownElement}) в шапке панели.
 * Headless (как {@link ProblemsController}/{@link TerminalController}) — своего
 * `view` нет, UI это виджеты, вкидываемые в панель. Live-tail — подписка на
 * `logService.onDidAppend`, отфильтрованная по активному каналу.
 */
export class OutputController extends Disposable {
    public static dependencies = [
        RingBufferSinkDIToken,
        ILogServiceDIToken,
        PanelControllerDIToken,
        ThemeServiceDIToken,
    ] as const;

    /** The log view — injected into the Output panel view. */
    public readonly view: OutputViewElement;
    /** The channel selector — injected as the Output view's header control. */
    public readonly dropdown: DropdownElement;

    private ringBuffer: RingBufferSink;
    private panel: PanelController;
    private content: ScrollBarDecorator;
    private activeChannel: string | null = null;

    public constructor(
        ringBuffer: RingBufferSink,
        logService: ILogService,
        panel: PanelController,
        themeService: ThemeService,
    ) {
        super();
        this.ringBuffer = ringBuffer;
        this.panel = panel;
        this.view = new OutputViewElement();
        this.content = new ScrollBarDecorator(this.view);
        this.dropdown = new DropdownElement();
        this.dropdown.placeholder = "Select channel";
        this.dropdown.onChange = (channel) => {
            this.setChannel(channel);
        };

        this.register(
            logService.onDidAppend((entry) => {
                this.onAppend(entry);
            }),
        );
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
        this.applyTheme(themeService.theme);
    }

    public mount(): void {
        this.refreshChannels();
        const channels = this.ringBuffer.getChannels();
        if (this.activeChannel === null && channels.length > 0) {
            this.setChannel(channels[0]);
        }
        this.panel.view.setViewContent(OUTPUT_VIEW_ID, this.content);
        this.panel.view.setViewHeaderControl(OUTPUT_VIEW_ID, this.dropdown);
    }

    /** Wires the overlay layer the channel dropdown opens its list into (called by AppController). */
    public setOverlayLayer(overlay: OverlayLayer): void {
        this.dropdown.setOverlayLayer(overlay);
    }

    /** Focuses the log view (used by the "Toggle Output" command). */
    public focus(): void {
        this.view.focus();
    }

    /** Clears the active channel's buffer and the view (the "Clear Output" command). */
    public clear(): void {
        if (this.activeChannel !== null) this.ringBuffer.clear(this.activeChannel);
        this.view.clear();
    }

    private setChannel(channel: string): void {
        this.activeChannel = channel;
        this.dropdown.value = channel; // no-op onChange (programmatic set)
        this.view.setEntries(this.ringBuffer.getEntries(channel));
    }

    private onAppend(entry: LogEntry): void {
        // A channel first seen at runtime must show up in the selector.
        if (!this.dropdown.options.some((option) => option.value === entry.channel)) {
            this.refreshChannels();
            if (this.activeChannel === null) {
                this.setChannel(entry.channel);
                return;
            }
        }
        if (entry.channel === this.activeChannel) this.view.appendEntry(entry);
    }

    private refreshChannels(): void {
        this.dropdown.options = this.ringBuffer.getChannels().map((channel) => ({ value: channel, label: channel }));
    }

    private applyTheme(theme: WorkbenchTheme): void {
        this.view.fg = theme.getRequiredColor("editor.foreground");
        this.view.bg = theme.getRequiredColor("panel.background");
        this.view.timeFg = theme.getRequiredColor("panelTitle.inactiveForeground");
        this.view.levelColors = {
            trace: theme.getRequiredColor("panelTitle.inactiveForeground"),
            debug: theme.getRequiredColor("panelTitle.inactiveForeground"),
            info: theme.getRequiredColor("editorInfo.foreground"),
            warn: theme.getRequiredColor("editorWarning.foreground"),
            error: theme.getRequiredColor("editorError.foreground"),
        };
        this.view.markDirty();
        this.dropdown.applyTheme(theme);
        applyScrollBarTheme(this.content, theme, "panel.background");
    }
}
