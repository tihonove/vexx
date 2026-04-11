import { describe, expect, it } from "vitest";

import { BoxConstraints, Offset, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TUIElement } from "../TUIElement.ts";

import { WorkbenchLayoutElement } from "./WorkbenchLayoutElement.ts";

function createPanel(): TUIElement {
    return new TUIElement();
}

describe("WorkbenchLayoutElement", () => {
    describe("layout with left panel visible", () => {
        it("positions left panel at (0,0) with configured width", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelWidth(25);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));

            expect(leftPanel.layoutSize).toEqual(new Size(25, 24));
            expect(leftPanel.localPosition).toEqual(new Offset(0, 0));
            expect(leftPanel.globalPosition).toEqual(new Point(0, 0));
        });

        it("positions center content after left panel", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelWidth(25);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));

            expect(center.layoutSize).toEqual(new Size(55, 24));
            expect(center.localPosition).toEqual(new Offset(25, 0));
            expect(center.globalPosition).toEqual(new Point(25, 0));
        });

        it("respects parent globalPosition", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelWidth(30);

            layout.globalPosition = new Point(0, 1);
            layout.performLayout(BoxConstraints.tight(new Size(80, 22)));

            expect(leftPanel.globalPosition).toEqual(new Point(0, 1));
            expect(center.globalPosition).toEqual(new Point(30, 1));
        });
    });

    describe("layout with left panel hidden", () => {
        it("center content takes full width when left panel hidden", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelVisible(false);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));

            expect(center.layoutSize).toEqual(new Size(80, 24));
            expect(center.localPosition).toEqual(new Offset(0, 0));
            expect(center.globalPosition).toEqual(new Point(0, 0));
        });

        it("does not layout hidden left panel", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelVisible(false);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));

            expect(leftPanel.isLayoutDirty).toBe(true);
        });
    });

    describe("toggle visibility", () => {
        it("toggling left panel visibility changes layout", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelWidth(30);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));
            expect(center.layoutSize.width).toBe(50);

            layout.setLeftPanelVisible(false);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));
            expect(center.layoutSize.width).toBe(80);

            layout.setLeftPanelVisible(true);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));
            expect(center.layoutSize.width).toBe(50);
        });
    });

    describe("without left panel", () => {
        it("center content takes full width when no left panel set", () => {
            const layout = new WorkbenchLayoutElement();
            const center = createPanel();

            layout.setCenterContent(center);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));

            expect(center.layoutSize).toEqual(new Size(80, 24));
            expect(center.localPosition).toEqual(new Offset(0, 0));
        });
    });

    describe("getChildren", () => {
        it("returns both panels when left panel is visible", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);

            expect(layout.getChildren()).toEqual([leftPanel, center]);
        });

        it("returns only center when left panel is hidden", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelVisible(false);

            expect(layout.getChildren()).toEqual([center]);
        });

        it("returns empty array when nothing is set", () => {
            const layout = new WorkbenchLayoutElement();

            expect(layout.getChildren()).toEqual([]);
        });

        it("returns only center when no left panel set", () => {
            const layout = new WorkbenchLayoutElement();
            const center = createPanel();

            layout.setCenterContent(center);

            expect(layout.getChildren()).toEqual([center]);
        });
    });

    describe("setLeftPanel replaces previous panel", () => {
        it("replaces left panel and unparents old one", () => {
            const layout = new WorkbenchLayoutElement();
            const panel1 = createPanel();
            const panel2 = createPanel();

            layout.setLeftPanel(panel1);
            expect(panel1.getParent()).toBe(layout);

            layout.setLeftPanel(panel2);
            expect(panel1.getParent()).toBeNull();
            expect(panel2.getParent()).toBe(layout);
        });
    });

    describe("left panel width clamped to container width", () => {
        it("clamps left panel width to container width", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            const center = createPanel();

            layout.setLeftPanel(leftPanel);
            layout.setCenterContent(center);
            layout.setLeftPanelWidth(100);

            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(new Size(80, 24)));

            expect(leftPanel.layoutSize.width).toBe(80);
            expect(center.layoutSize.width).toBe(0);
        });
    });

    describe("default values", () => {
        it("left panel is visible by default", () => {
            const layout = new WorkbenchLayoutElement();
            expect(layout.getLeftPanelVisible()).toBe(true);
        });

        it("default left panel width is 30", () => {
            const layout = new WorkbenchLayoutElement();
            expect(layout.getLeftPanelWidth()).toBe(30);
        });
    });
});
