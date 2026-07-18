import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import type { IStateService } from "../../Configuration/IStateService.ts";
import type { WorkbenchLayoutElement } from "../../TUIDom/Widgets/WorkbenchLayoutElement.ts";

import type { ContextKeyService } from "./ContextKeyService.ts";
import { ContextKeyServiceDIToken } from "./ContextKeyService.ts";
import { StateServiceDIToken } from "./CoreTokens.ts";
import type { PanelService } from "./PanelService.ts";
import { PanelServiceDIToken } from "./PanelService.ts";
import {
    PANEL_HEIGHT_STATE,
    PANEL_VISIBLE_STATE,
    SIDEBAR_VISIBLE_STATE,
    SIDEBAR_WIDTH_STATE,
} from "./StateKeys.ts";

export const LayoutServiceDIToken = token<LayoutService>("LayoutService");

/**
 * Логика workbench-layout'а: видимость/ширина сайдбара, видимость нижней панели
 * и персист layout-состояния через {@link IStateService} (write-through по
 * `onDidChangeLayout` — drag сэша и команды).
 *
 * Сам контрол `WorkbenchLayoutElement` остаётся у владельца корневой view
 * (`WorkbenchComponent`) и приходит через late-init шов {@link attachLayout} —
 * TUIDom про DI/StateService не знает, сервис читает/пишет элемент через его
 * публичные геттеры/сеттеры.
 *
 * Истина видимости панели — {@link PanelService}: команды зовут
 * {@link setPanelVisible} → `PanelService.setVisible`, а layout и контекст-ключ
 * `panelVisible` следуют за `onDidChangeVisibility` (подписка в конструкторе).
 */
export class LayoutService extends Disposable {
    public static dependencies = [StateServiceDIToken, PanelServiceDIToken, ContextKeyServiceDIToken] as const;

    private layout: WorkbenchLayoutElement | null = null;
    /** Пока идёт restore, сеттеры элемента фаерят `onDidChangeLayout` — глушим авто-capture. */
    private restoring = false;

    public constructor(
        private readonly state: IStateService,
        private readonly panelService: PanelService,
        private readonly contextKeys: ContextKeyService,
    ) {
        super();
        // Видимость панели живёт в PanelService; layout и контекст-ключ следуют за ней.
        this.register(
            this.panelService.onDidChangeVisibility((visible) => {
                this.layout?.setBottomPanelVisible(visible);
                this.layout?.markDirty();
                this.contextKeys.set("panelVisible", visible);
            }),
        );
    }

    /**
     * Прикрепляет layout-элемент (зовёт владелец view сразу после его создания)
     * и вешает write-through: любое пользовательское изменение layout'а
     * (drag сэша, команда) снимается в стор.
     */
    public attachLayout(layout: WorkbenchLayoutElement): void {
        this.layout = layout;
        layout.onDidChangeLayout = () => {
            this.captureLayout();
        };
    }

    /**
     * Применяет сохранённый layout к элементу через его публичные сеттеры и
     * синхронизирует истину видимости панели в {@link PanelService} (иначе
     * первый toggle после рестора отработал бы вхолостую). Зовётся до первого
     * кадра (из `mount()` владельца).
     */
    public restoreLayout(): void {
        const layout = this.requireLayout();
        this.restoring = true;
        try {
            layout.setLeftPanelWidth(this.state.get(SIDEBAR_WIDTH_STATE));
            layout.setLeftPanelVisible(this.state.get(SIDEBAR_VISIBLE_STATE));
            layout.setBottomPanelHeight(this.state.get(PANEL_HEIGHT_STATE));
            layout.setBottomPanelVisible(this.state.get(PANEL_VISIBLE_STATE));
            layout.markDirty();
        } finally {
            this.restoring = false;
        }
        this.panelService.setVisible(layout.getBottomPanelVisible());
    }

    /** Снимает текущий layout из элемента в стор (write-through). No-op во время restore. */
    public captureLayout(): void {
        if (this.restoring) return;
        const layout = this.requireLayout();
        this.state.store(SIDEBAR_WIDTH_STATE, layout.getLeftPanelWidth());
        this.state.store(SIDEBAR_VISIBLE_STATE, layout.getLeftPanelVisible());
        this.state.store(PANEL_HEIGHT_STATE, layout.getBottomPanelHeight());
        this.state.store(PANEL_VISIBLE_STATE, layout.getBottomPanelVisible());
    }

    // ── Сайдбар ─────────────────────────────────────────────────────────────

    public isSidebarVisible(): boolean {
        return this.requireLayout().getLeftPanelVisible();
    }

    public setSidebarVisible(visible: boolean): void {
        const layout = this.requireLayout();
        layout.setLeftPanelVisible(visible);
        layout.markDirty();
    }

    public toggleSidebar(): void {
        this.setSidebarVisible(!this.isSidebarVisible());
    }

    /** Grow/shrink the sidebar by `delta` columns, clamped by the layout element. */
    public nudgeSidebarWidth(delta: number): void {
        this.requireLayout().nudgeLeftPanelWidth(delta);
    }

    /** Restore the sidebar to its default width. */
    public resetSidebarWidth(): void {
        this.requireLayout().resetLeftPanelWidth();
    }

    // ── Нижняя панель ───────────────────────────────────────────────────────

    public isPanelVisible(): boolean {
        return this.requireLayout().getBottomPanelVisible();
    }

    /**
     * Shows/hides the bottom Panel. Истина видимости — {@link PanelService};
     * layout и контекст-ключ `panelVisible` следуют за ней через подписку
     * `onDidChangeVisibility` (см. конструктор).
     */
    public setPanelVisible(visible: boolean): void {
        this.panelService.setVisible(visible);
    }

    private requireLayout(): WorkbenchLayoutElement {
        if (this.layout === null) {
            throw new Error("LayoutService: layout is not attached (attachLayout must be called first)");
        }
        return this.layout;
    }
}
