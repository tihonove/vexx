import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { getFileIcon } from "../../Common/FileIcons.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { BoxElement } from "./BoxElement.ts";
import { EditorGroupElement } from "./EditorGroupElement.ts";

function layoutGroup(group: EditorGroupElement, width = 40, height = 10): void {
    group.globalPosition = new Point(0, 0);
    group.performLayout(BoxConstraints.tight(new Size(width, height)));
}

function renderGroup(
    group: EditorGroupElement,
    width = 40,
    height = 10,
): MockTerminalBackend {
    const size = new Size(width, height);
    const backend = new MockTerminalBackend(size);
    const termScreen = new TerminalScreen(size);
    group.globalPosition = new Point(0, 0);
    group.performLayout(BoxConstraints.tight(size));
    group.render(new RenderContext(termScreen));
    termScreen.flush(backend);
    return backend;
}

describe("EditorGroupElement", () => {
    describe("layout", () => {
        it("tab strip occupies 1 row at the top", () => {
            const group = new EditorGroupElement();
            layoutGroup(group, 40, 10);

            expect(group.tabStrip.localPosition.dy).toBe(0);
            expect(group.tabStrip.layoutSize.height).toBe(1);
            expect(group.tabStrip.layoutSize.width).toBe(40);
        });

        it("content occupies remaining height below tab strip", () => {
            const group = new EditorGroupElement();
            const content = new BoxElement();
            group.setContent(content);
            layoutGroup(group, 40, 10);

            expect(content.localPosition.dy).toBe(1);
            expect(content.layoutSize.height).toBe(9);
            expect(content.layoutSize.width).toBe(40);
        });

        it("content global position accounts for tab strip", () => {
            const group = new EditorGroupElement();
            const content = new BoxElement();
            group.setContent(content);
            layoutGroup(group, 40, 10);

            expect(content.globalPosition.y).toBe(1);
        });

        it("works without content", () => {
            const group = new EditorGroupElement();
            layoutGroup(group, 40, 10);
            // No error thrown
            expect(group.tabStrip.layoutSize.width).toBe(40);
        });
    });

    describe("children", () => {
        it("includes tab strip when no content", () => {
            const group = new EditorGroupElement();
            expect(group.getChildren()).toHaveLength(1);
            expect(group.getChildren()[0]).toBe(group.tabStrip);
        });

        it("includes tab strip and content", () => {
            const group = new EditorGroupElement();
            const content = new BoxElement();
            group.setContent(content);
            expect(group.getChildren()).toHaveLength(2);
        });
    });

    describe("setContent", () => {
        it("replaces content element", () => {
            const group = new EditorGroupElement();
            const content1 = new BoxElement();
            const content2 = new BoxElement();

            group.setContent(content1);
            expect(group.getContent()).toBe(content1);

            group.setContent(content2);
            expect(group.getContent()).toBe(content2);
        });

        it("unparents old content", () => {
            const group = new EditorGroupElement();
            const content1 = new BoxElement();
            const content2 = new BoxElement();

            group.setContent(content1);
            group.setContent(content2);

            expect(content1.getParent()).toBeNull();
        });

        it("setContent(null) removes content", () => {
            const group = new EditorGroupElement();
            const content = new BoxElement();

            group.setContent(content);
            group.setContent(null);

            expect(group.getContent()).toBeNull();
            expect(group.getChildren()).toHaveLength(1);
        });
    });

    describe("rendering", () => {
        it("renders tab strip on first row", () => {
            const group = new EditorGroupElement();
            const tsIcon = getFileIcon("file.ts");
            group.tabStrip.setTabs([
                { label: "file.ts", icon: tsIcon.icon, iconColor: tsIcon.color, isModified: false },
            ]);
            group.tabStrip.activeIndex = 0;

            const backend = renderGroup(group, 40, 10);
            const firstRow = backend.getTextAt(new Point(0, 0), 40);
            expect(firstRow).toContain("file.ts");
        });

        it("renders content below tab strip", () => {
            const group = new EditorGroupElement();
            const content = new BoxElement();
            group.setContent(content);

            const backend = renderGroup(group, 10, 5);
            // BoxElement renders borders, check content area starts at row 1
            const row1 = backend.getTextAt(new Point(0, 1), 10);
            expect(row1.length).toBe(10);
        });
    });
});
