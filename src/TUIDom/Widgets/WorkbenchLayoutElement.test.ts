import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { WorkbenchLayoutElement } from "./WorkbenchLayoutElement.ts";

function createPanel(): TUIElement {
    return new TUIElement();
}

/** A panel that paints a single marker char at its top-left, so we can assert it was rendered. */
class MarkerPanel extends TUIElement {
    public constructor(private readonly marker: string) {
        super();
    }

    public override render(context: RenderContext): void {
        context.setCell(0, 0, { char: this.marker, fg: 0, bg: 0 });
    }
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

    describe("setCenterContent replaces previous content", () => {
        it("replaces center content and unparents old one", () => {
            const layout = new WorkbenchLayoutElement();
            const center1 = createPanel();
            const center2 = createPanel();

            layout.setCenterContent(center1);
            expect(center1.getParent()).toBe(layout);

            layout.setCenterContent(center2);
            expect(center1.getParent()).toBeNull();
            expect(center2.getParent()).toBe(layout);
            expect(layout.getCenterContent()).toBe(center2);
        });

        it("clears center content when set to null and unparents the old one", () => {
            const layout = new WorkbenchLayoutElement();
            const center = createPanel();

            layout.setCenterContent(center);
            layout.setCenterContent(null);

            expect(center.getParent()).toBeNull();
            expect(layout.getCenterContent()).toBeNull();
        });
    });

    describe("accessors", () => {
        it("getLeftPanel returns the configured left panel", () => {
            const layout = new WorkbenchLayoutElement();
            const leftPanel = createPanel();
            expect(layout.getLeftPanel()).toBeNull();

            layout.setLeftPanel(leftPanel);
            expect(layout.getLeftPanel()).toBe(leftPanel);
        });

        it("getCenterContent returns the configured center content", () => {
            const layout = new WorkbenchLayoutElement();
            const center = createPanel();
            expect(layout.getCenterContent()).toBeNull();

            layout.setCenterContent(center);
            expect(layout.getCenterContent()).toBe(center);
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

    describe("layout edge cases", () => {
        it("lays out the left panel even when no center content is set (line 82 false branch)", () => {
            const layout = new WorkbenchLayoutElement();
            const left = createPanel();

            layout.setLeftPanel(left);
            layout.setLeftPanelWidth(20);
            layout.globalPosition = new Point(0, 0);

            expect(() => layout.performLayout(BoxConstraints.tight(new Size(40, 10)))).not.toThrow();
            expect(left.layoutSize).toEqual(new Size(20, 10));
        });

        it("setLeftPanel(null) clears the panel without re-parenting (line 18 false branch)", () => {
            const layout = new WorkbenchLayoutElement();
            const left = createPanel();

            layout.setLeftPanel(left);
            expect(left.getParent()).toBe(layout);

            layout.setLeftPanel(null);
            expect(left.getParent()).toBeNull();
            expect(layout.getLeftPanel()).toBeNull();
        });
    });

    describe("render", () => {
        function renderLayout(layout: WorkbenchLayoutElement, size: Size): MockTerminalBackend {
            const backend = new MockTerminalBackend(size);
            const termScreen = new TerminalScreen(size);
            layout.globalPosition = new Point(0, 0);
            layout.performLayout(BoxConstraints.tight(size));
            layout.render(new RenderContext(termScreen, new Offset(0, 0), new Rect(new Point(0, 0), size)));
            termScreen.flush(backend);
            return backend;
        }

        it("renders the left panel and center content through the pipeline (lines 92-103)", () => {
            const layout = new WorkbenchLayoutElement();
            layout.setLeftPanel(new MarkerPanel("L"));
            layout.setCenterContent(new MarkerPanel("C"));
            layout.setLeftPanelWidth(10);

            const backend = renderLayout(layout, new Size(30, 5));

            expect(backend.getTextAt(new Point(0, 0), 1)).toBe("L"); // left panel at x=0
            expect(backend.getTextAt(new Point(10, 0), 1)).toBe("C"); // center after left panel
        });

        it("renders only the left panel when there is no center content (line 99 false branch)", () => {
            const layout = new WorkbenchLayoutElement();
            layout.setLeftPanel(new MarkerPanel("L"));
            layout.setLeftPanelWidth(10);

            const backend = renderLayout(layout, new Size(30, 5));

            expect(backend.getTextAt(new Point(0, 0), 1)).toBe("L");
        });

        it("skips the hidden left panel and renders center at the origin (line 99)", () => {
            const layout = new WorkbenchLayoutElement();
            layout.setLeftPanel(new MarkerPanel("L"));
            layout.setCenterContent(new MarkerPanel("C"));
            layout.setLeftPanelVisible(false);

            const backend = renderLayout(layout, new Size(30, 5));

            // Left panel suppressed; center occupies x=0.
            expect(backend.getTextAt(new Point(0, 0), 1)).toBe("C");
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
