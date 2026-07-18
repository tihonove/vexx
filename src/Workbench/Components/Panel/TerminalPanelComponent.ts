import { token } from "../../../Common/DiContainer.ts";
import { Disposable } from "../../../Common/Disposable.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../../Theme/ThemeTokens.ts";
import { TerminalViewElement } from "../../../TUIDom/Widgets/Terminal/TerminalViewElement.ts";
import type { PanelService } from "../../Services/PanelService.ts";
import { PanelServiceDIToken } from "../../Services/PanelService.ts";
import type { ITerminalInstance, TerminalService } from "../../Services/Terminal/TerminalService.ts";
import { TERMINAL_VIEW_ID, TerminalServiceDIToken } from "../../Services/Terminal/TerminalService.ts";
import { getTerminalViewStyles } from "../../Styles/defaultStyles.ts";

export const TerminalPanelComponentDIToken = token<TerminalPanelComponent>("TerminalPanelComponent");

/**
 * View-владелец встроенного терминала: по каждому инстансу {@link TerminalService}
 * строит `TerminalViewElement`, вкидывает виджет активного инстанса в
 * TERMINAL-вкладку (через {@link PanelService.setViewContent}) и красит виджеты
 * темой (`getTerminalViewStyles`).
 *
 * Не наследник `Component`: собственного корневого контрола нет — UI компонента
 * это НЕСКОЛЬКО виджетов, попадающих в панель по одному через PanelService.
 * ВАЖНО: у TUIElement нет unmount-хуков, поэтому компонент обязан сам
 * dispose'ить виджеты — при закрытии инстанса и при своём dispose().
 */
export class TerminalPanelComponent extends Disposable {
    public static dependencies = [TerminalServiceDIToken, PanelServiceDIToken, ThemeServiceDIToken] as const;

    private widgets = new Map<number, TerminalViewElement>();
    private activeWidget: TerminalViewElement | null = null;

    public constructor(
        terminalService: TerminalService,
        private readonly panelService: PanelService,
        private readonly themeService: ThemeService,
    ) {
        super();
        this.register(
            terminalService.onDidOpenInstance((instance) => {
                this.handleOpen(instance);
            }),
        );
        this.register(
            terminalService.onDidCloseInstance((instance) => {
                this.handleClose(instance);
            }),
        );
        this.register(
            terminalService.onDidChangeActiveInstance((instance) => {
                this.handleActiveChange(instance);
            }),
        );
        this.register(
            terminalService.onDidRequestFocus(() => {
                this.activeWidget?.focus();
            }),
        );
        // onThemeChange файрит немедленно с текущей темой; на этот момент виджетов
        // ещё нет — свежие красятся при создании (handleOpen), открытые — здесь.
        this.register(
            this.themeService.onThemeChange((theme) => {
                for (const widget of this.widgets.values()) widget.setStyles(getTerminalViewStyles(theme));
            }),
        );
        // Инстансы, созданные до компонента (сервис резолвится первым в том же модуле).
        for (const instance of terminalService.getInstances()) this.handleOpen(instance);
        this.handleActiveChange(terminalService.getActiveInstance());

        // Виджеты обязаны быть dispose'нуты (подписки на surface): и оставшиеся
        // при закрытии приложения — здесь, и по одному — в handleClose.
        this.register({
            dispose: () => {
                for (const widget of this.widgets.values()) widget.dispose();
                this.widgets.clear();
            },
        });
    }

    private handleOpen(instance: ITerminalInstance): void {
        const widget = new TerminalViewElement(instance.session);
        widget.setStyles(getTerminalViewStyles(this.themeService.theme));
        this.widgets.set(instance.id, widget);
    }

    private handleClose(instance: ITerminalInstance): void {
        const widget = this.widgets.get(instance.id);
        /* v8 ignore start -- defensive: сервис файрит close только для инстанса, чей open компонент уже видел */
        if (widget === undefined) return;
        /* v8 ignore stop */
        widget.dispose();
        this.widgets.delete(instance.id);
    }

    /** Вкидывает виджет активного инстанса в TERMINAL-вкладку (null → placeholder). */
    private handleActiveChange(instance: ITerminalInstance | null): void {
        if (instance === null) {
            this.activeWidget = null;
        } else {
            const widget = this.widgets.get(instance.id);
            /* v8 ignore start -- defensive: onDidOpenInstance всегда предшествует смене активного */
            if (widget === undefined) return;
            /* v8 ignore stop */
            this.activeWidget = widget;
        }
        this.panelService.setViewContent(TERMINAL_VIEW_ID, this.activeWidget);
    }
}
