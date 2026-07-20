import { Disposable } from "../../../../../../tuidom/common/disposable.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import type { IWorkbenchContribution } from "../../../common/iWorkbenchContribution.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";
import { EditorServiceDIToken } from "../../../services/editor/browser/editorService.ts";

import type { PanelComponent } from "./panelComponent.ts";
import { PanelComponentDIToken } from "./panelComponent.ts";
import type { PanelService } from "./panelService.ts";
import { PanelServiceDIToken } from "./panelService.ts";

export const PanelFocusContributionDIToken = token<PanelFocusContribution>("PanelFocusContribution");

/**
 * Возвращает фокус редактору, когда контент панели уходит со сцены: панель
 * скрыли или переключили вкладку, а фокус остался на виджете, которого больше
 * не видно (`PanelContainerElement.getChildren()` его уже не отдаёт, но
 * FocusManager по-прежнему считает активным — и клавиатура уходит туда).
 * Так же ведёт себя VS Code: скрытие панели возвращает клавиатуру в редактор.
 *
 * Фокус сначала снимается, потом отдаётся редактору: даже без открытого
 * редактора невидимый виджет ввод больше не получает.
 */
export class PanelFocusContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [PanelServiceDIToken, PanelComponentDIToken, EditorServiceDIToken] as const;

    public constructor(
        panelService: PanelService,
        private readonly panelComponent: PanelComponent,
        private readonly editorService: EditorService,
    ) {
        super();
        this.register(
            panelService.onDidChangeVisibility((visible) => {
                if (!visible) this.releaseFocusFromPanel();
            }),
        );
        this.register(
            panelService.onDidChangeActiveView(() => {
                this.releaseFocusFromPanel();
            }),
        );
    }

    /** Если фокус лежит внутри поддерева панели — снять его и отдать редактору. */
    private releaseFocusFromPanel(): void {
        const panelView = this.panelComponent.view;
        const focusManager = panelView.getRoot()?.focusManager ?? null;
        if (focusManager === null) return;
        const active = focusManager.activeElement;
        if (active === null) return;
        if (!active.getAncestorPath().includes(panelView)) return;
        focusManager.setFocus(null);
        this.editorService.focusEditor();
    }
}
