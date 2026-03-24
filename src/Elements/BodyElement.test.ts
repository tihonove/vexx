import { describe, it, expect } from "vitest";

import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Point, Size } from "../Common/GeometryPromitives.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";
import { expectScreen, screen } from "../TestUtils/expectScreen.ts";

import { BodyElement } from "./BodyElement.ts";
import { BoxElement } from "./BoxElement.ts";
import { VStackElement } from "./VStackElement.ts";
import { RenderContext } from "./TUIElement.ts";

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
