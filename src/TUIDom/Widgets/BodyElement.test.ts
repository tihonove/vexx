import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../../Backend/MockTerminalBackend.ts";
import { BoxConstraints, Point, Size } from "../../Common/GeometryPromitives.ts";
import { TerminalScreen } from "../../Rendering/TerminalScreen.ts";
import { expectScreen, screen } from "../../TestUtils/expectScreen.ts";
import { RenderContext } from "../TUIElement.ts";

import { BodyElement } from "./BodyElement.ts";
import { BoxElement } from "./BoxElement.ts";
import { MenuBarElement } from "./MenuBarElement.ts";
import { StatusBarElement } from "./StatusBarElement.ts";
import { VStackElement } from "./VStackElement.ts";

describe("BodyElement root reference", () => {
    it("BodyElement initializes root pointing to itself", () => {
        const body = new BodyElement();
        expect(body.getRoot()).toBe(body);
    });

    it("content element receives root reference from BodyElement", () => {
        const body = new BodyElement();
        const content = new BoxElement();

        body.setContent(content);

        expect(content.getRoot()).toBe(body);
    });

    it("ContextMenuLayer receives root reference from BodyElement", () => {
        const body = new BodyElement();

        expect(body.contextMenuLayer.getRoot()).toBe(body);
    });

    it("nested elements in VStack all receive the same root", () => {
        const body = new BodyElement();
        const vstack = new VStackElement();
        const box1 = new BoxElement();
        const box2 = new BoxElement();

        body.setContent(vstack);
        vstack.addChild(box1, { width: "fill", height: 5 });
        vstack.addChild(box2, { width: "fill", height: 5 });

        expect(vstack.getRoot()).toBe(body);
        expect(box1.getRoot()).toBe(body);
        expect(box2.getRoot()).toBe(body);
    });

    it("items added to ContextMenuLayer receive root reference", () => {
        const body = new BodyElement();
        const popup = new BoxElement();

        body.contextMenuLayer.addItem(popup, new Point(5, 5), true);

        expect(popup.getRoot()).toBe(body);
    });

    it("multiple nested VStacks preserve root reference throughout hierarchy", () => {
        const body = new BodyElement();
        const vstack1 = new VStackElement();
        const vstack2 = new VStackElement();
        const leaf = new BoxElement();

        body.setContent(vstack1);
        vstack1.addChild(vstack2, { width: "fill", height: 10 });
        vstack2.addChild(leaf, { width: "fill", height: 5 });

        expect(vstack1.getRoot()).toBe(body);
        expect(vstack2.getRoot()).toBe(body);
        expect(leaf.getRoot()).toBe(body);
    });
});

describe("BodyElement menuBar integration", () => {
    function layoutBody(body: BodyElement, width = 40, height = 20): void {
        body.globalPosition = new Point(0, 0);
        body.performLayout(BoxConstraints.tight(new Size(width, height)));
    }

    it("menuBar receives root reference from BodyElement", () => {
        const body = new BodyElement();
        const menuBar = new MenuBarElement([{ label: "File", entries: [] }]);

        body.setMenuBar(menuBar);

        expect(menuBar.getRoot()).toBe(body);
    });

    it("content positioned at y=1 when menuBar is set", () => {
        const body = new BodyElement();
        const menuBar = new MenuBarElement([{ label: "File", entries: [] }]);
        const content = new BoxElement();

        body.setMenuBar(menuBar);
        body.setContent(content);
        layoutBody(body);

        expect(content.localPosition.dy).toBe(1);
        expect(content.globalPosition.y).toBe(1);
    });

    it("content height reduced by 1 when menuBar is set", () => {
        const body = new BodyElement();
        const menuBar = new MenuBarElement([{ label: "File", entries: [] }]);
        const content = new BoxElement();

        body.setMenuBar(menuBar);
        body.setContent(content);
        layoutBody(body, 40, 20);

        expect(content.size.width).toBe(40);
        expect(content.size.height).toBe(19);
    });

    it("content at y=0 and full height without menuBar", () => {
        const body = new BodyElement();
        const content = new BoxElement();

        body.setContent(content);
        layoutBody(body, 40, 20);

        expect(content.localPosition.dy).toBe(0);
        expect(content.globalPosition.y).toBe(0);
        expect(content.size.height).toBe(20);
    });

    it("menuBar receives full body size for layout", () => {
        const body = new BodyElement();
        const menuBar = new MenuBarElement([{ label: "File", entries: [] }]);

        body.setMenuBar(menuBar);
        layoutBody(body, 40, 20);

        expect(menuBar.size.width).toBe(40);
        expect(menuBar.size.height).toBe(20);
    });
});

describe("BodyElement statusBar integration", () => {
    function layoutBody(body: BodyElement, width = 40, height = 20): void {
        body.globalPosition = new Point(0, 0);
        body.performLayout(BoxConstraints.tight(new Size(width, height)));
    }

    it("statusBar receives root reference from BodyElement", () => {
        const body = new BodyElement();
        const statusBar = new StatusBarElement();

        body.setStatusBar(statusBar);

        expect(statusBar.getRoot()).toBe(body);
    });

    it("statusBar positioned at bottom row", () => {
        const body = new BodyElement();
        const statusBar = new StatusBarElement();

        body.setStatusBar(statusBar);
        layoutBody(body, 40, 20);

        expect(statusBar.localPosition.dy).toBe(19);
        expect(statusBar.globalPosition.y).toBe(19);
    });

    it("content height reduced by 1 when statusBar is set", () => {
        const body = new BodyElement();
        const statusBar = new StatusBarElement();
        const content = new BoxElement();

        body.setStatusBar(statusBar);
        body.setContent(content);
        layoutBody(body, 40, 20);

        expect(content.size.width).toBe(40);
        expect(content.size.height).toBe(19);
    });

    it("content height reduced by 2 with both menuBar and statusBar", () => {
        const body = new BodyElement();
        const menuBar = new MenuBarElement([{ label: "File", entries: [] }]);
        const statusBar = new StatusBarElement();
        const content = new BoxElement();

        body.setMenuBar(menuBar);
        body.setStatusBar(statusBar);
        body.setContent(content);
        layoutBody(body, 40, 20);

        expect(content.localPosition.dy).toBe(1);
        expect(content.size.height).toBe(18);
        expect(statusBar.localPosition.dy).toBe(19);
    });

    it("statusBar included in getChildren", () => {
        const body = new BodyElement();
        const statusBar = new StatusBarElement();

        body.setStatusBar(statusBar);

        const children = body.getChildren();
        expect(children).toContain(statusBar);
    });

    it("statusBar has full width", () => {
        const body = new BodyElement();
        const statusBar = new StatusBarElement();

        body.setStatusBar(statusBar);
        layoutBody(body, 40, 20);

        expect(statusBar.size.width).toBe(40);
        expect(statusBar.size.height).toBe(1);
    });
});
