import { beforeEach, describe, expect, it } from "vitest";

import { FocusManager } from "../../../../../../tuidom/dom/events/focusManager.ts";
import { TUIElement } from "../../../../../../tuidom/dom/tuiElement.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";

import type { PanelComponent } from "./panelComponent.ts";
import { PanelFocusContribution } from "./panelFocusContribution.ts";
import { PanelService } from "./panelService.ts";

class ContainerElement extends TUIElement {
    private children: TUIElement[] = [];

    public addChild(child: TUIElement): void {
        child.setParent(this);
        this.children.push(child);
    }

    public override getChildren(): readonly TUIElement[] {
        return this.children;
    }
}

class FakeEditorService {
    public focusCalls = 0;
    public focusEditor(): void {
        this.focusCalls++;
    }
}

interface ISetup {
    panelService: PanelService;
    editor: FakeEditorService;
    focusManager: FocusManager;
    /** Виджет внутри поддерева панели. */
    inPanel: TUIElement;
    /** Виджет вне панели (редактор и т.п.). */
    outside: TUIElement;
    contribution: PanelFocusContribution;
}

/**
 * Собираем минимальное дерево `root → [panelView → inPanel, outside]` с живым
 * FocusManager: contribution смотрит именно на реальные родительские связи.
 */
function setup(): ISetup {
    const root = new ContainerElement();
    root.setAsRoot();
    const focusManager = new FocusManager(root);
    root.focusManager = focusManager;

    const panelView = new ContainerElement();
    const inPanel = new ContainerElement();
    panelView.addChild(inPanel);
    const outside = new ContainerElement();
    root.addChild(panelView);
    root.addChild(outside);

    const panelService = new PanelService();
    panelService.addView({ id: "problems", title: "PROBLEMS" });
    panelService.addView({ id: "terminal", title: "TERMINAL" });
    const editor = new FakeEditorService();
    const contribution = new PanelFocusContribution(
        panelService,
        { view: panelView } as unknown as PanelComponent,
        editor as unknown as EditorService,
    );
    return { panelService, editor, focusManager, inPanel, outside, contribution };
}

describe("PanelFocusContribution", () => {
    let s: ISetup;

    beforeEach(() => {
        s = setup();
    });

    it("на скрытии панели снимает фокус с её виджета и отдаёт его редактору", () => {
        s.panelService.setVisible(true);
        s.focusManager.setFocus(s.inPanel);

        s.panelService.setVisible(false);

        expect(s.focusManager.activeElement).toBeNull();
        expect(s.editor.focusCalls).toBe(1);
    });

    it("не трогает фокус, если он лежит вне панели", () => {
        s.panelService.setVisible(true);
        s.focusManager.setFocus(s.outside);

        s.panelService.setVisible(false);

        expect(s.focusManager.activeElement).toBe(s.outside);
        expect(s.editor.focusCalls).toBe(0);
    });

    it("не трогает фокус на показе панели", () => {
        s.focusManager.setFocus(s.outside);

        s.panelService.setVisible(true);

        expect(s.focusManager.activeElement).toBe(s.outside);
        expect(s.editor.focusCalls).toBe(0);
    });

    it("на смене активной вкладки уводит фокус из панели в редактор", () => {
        s.panelService.setVisible(true);
        s.focusManager.setFocus(s.inPanel);

        s.panelService.setActiveView("terminal");

        expect(s.focusManager.activeElement).toBeNull();
        expect(s.editor.focusCalls).toBe(1);
    });

    it("без фокуса вообще ничего не делает", () => {
        s.panelService.setVisible(true);

        s.panelService.setVisible(false);

        expect(s.editor.focusCalls).toBe(0);
    });

    it("после dispose на события не реагирует", () => {
        s.panelService.setVisible(true);
        s.focusManager.setFocus(s.inPanel);
        s.contribution.dispose();

        s.panelService.setVisible(false);

        expect(s.focusManager.activeElement).toBe(s.inPanel);
        expect(s.editor.focusCalls).toBe(0);
    });
});
