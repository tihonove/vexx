import { describe, expect, it, vi } from "vitest";

import { TuiApplication } from "../Application/TuiApplication.ts";
import { Point, Size } from "../Common/GeometryPromitives.ts";
import { BodyElement } from "../Elements/BodyElement.ts";
import { RenderContext, TUIElement } from "../Elements/TUIElement.ts";
import { VStackElement } from "../Elements/VStackElement.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import type { TUIFocusEvent } from "../Events/TUIFocusEvent.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { MockTerminalBackend } from "../TerminalBackend/MockTerminalBackend.ts";

const FOCUSED_BG = packRgb(0, 120, 215);
const DEFAULT_BG = packRgb(40, 40, 40);

class FocusableBox extends TUIElement {
    public bg = DEFAULT_BG;

    public constructor() {
        super();
        this.tabIndex = 0;

        this.addEventListener("focus", () => {
            this.bg = FOCUSED_BG;
        });
        this.addEventListener("blur", () => {
            this.bg = DEFAULT_BG;
        });
    }

    public render(context: RenderContext): void {
        const w = this.size.width;
        const h = this.size.height;
        const { dx: ox, dy: oy } = context.offset;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                context.canvas.setCell(new Point(ox + x, oy + y), {
                    char: " ",
                    bg: this.bg,
                });
            }
        }
    }
}

function setupApp(boxCount: number): {
    backend: MockTerminalBackend;
    app: TuiApplication;
    boxes: FocusableBox[];
    body: BodyElement;
} {
    const backend = new MockTerminalBackend(new Size(20, boxCount * 3));
    const app = new TuiApplication(backend);

    const body = new BodyElement();
    const stack = new VStackElement();

    const boxes: FocusableBox[] = [];
    for (let i = 0; i < boxCount; i++) {
        const box = new FocusableBox();
        stack.addChild(box, { width: "fill", height: 3 });
        boxes.push(box);
    }

    body.setContent(stack);
    app.root = body;
    app.run();

    return { backend, app, boxes, body };
}

describe("Focus integration: Tab cycling through TuiApplication", () => {
    it("Tab focuses the first focusable element", () => {
        const { backend, boxes } = setupApp(3);

        expect(boxes[0].isFocused).toBe(false);
        backend.sendKey("Tab");
        expect(boxes[0].isFocused).toBe(true);
    });

    it("Tab cycles through all focusable elements", () => {
        const { backend, boxes } = setupApp(3);

        backend.sendKey("Tab");
        expect(boxes[0].isFocused).toBe(true);

        backend.sendKey("Tab");
        expect(boxes[0].isFocused).toBe(false);
        expect(boxes[1].isFocused).toBe(true);

        backend.sendKey("Tab");
        expect(boxes[1].isFocused).toBe(false);
        expect(boxes[2].isFocused).toBe(true);
    });

    it("Tab wraps around to first element", () => {
        const { backend, boxes } = setupApp(3);

        backend.sendKey("Tab");
        backend.sendKey("Tab");
        backend.sendKey("Tab"); // at box[2]
        expect(boxes[2].isFocused).toBe(true);

        backend.sendKey("Tab"); // wraps to box[0]
        expect(boxes[0].isFocused).toBe(true);
        expect(boxes[2].isFocused).toBe(false);
    });

    it("Shift+Tab cycles backward", () => {
        const { backend, boxes } = setupApp(3);

        // Start at first
        backend.sendKey("Tab");
        expect(boxes[0].isFocused).toBe(true);

        // Shift+Tab wraps to last
        backend.sendKey("Shift+Tab");
        expect(boxes[2].isFocused).toBe(true);
    });

    it("focus/blur events change box background color", () => {
        const { backend, boxes } = setupApp(2);

        // Initially all default bg
        expect(boxes[0].bg).toBe(DEFAULT_BG);
        expect(boxes[1].bg).toBe(DEFAULT_BG);

        // Tab into first box
        backend.sendKey("Tab");
        expect(boxes[0].bg).toBe(FOCUSED_BG);
        expect(boxes[1].bg).toBe(DEFAULT_BG);

        // Tab into second box
        backend.sendKey("Tab");
        expect(boxes[0].bg).toBe(DEFAULT_BG);
        expect(boxes[1].bg).toBe(FOCUSED_BG);
    });

    it("focused box renders with correct background color on screen", () => {
        const { backend, boxes } = setupApp(2);

        backend.sendKey("Tab");

        // First box (rows 0-2) should have FOCUSED_BG
        expect(backend.getBgAt(new Point(0, 0))).toBe(FOCUSED_BG);
        expect(backend.getBgAt(new Point(0, 1))).toBe(FOCUSED_BG);

        // Second box (rows 3-5) should have DEFAULT_BG
        expect(backend.getBgAt(new Point(0, 3))).toBe(DEFAULT_BG);
    });

    it("elements with tabIndex = -1 are skipped during Tab cycling", () => {
        const backend = new MockTerminalBackend(new Size(20, 12));
        const app = new TuiApplication(backend);

        const body = new BodyElement();
        const stack = new VStackElement();

        const box1 = new FocusableBox();
        stack.addChild(box1, { width: "fill", height: 3 });

        const nonFocusable = new FocusableBox();
        nonFocusable.tabIndex = -1; // not focusable
        stack.addChild(nonFocusable, { width: "fill", height: 3 });

        const box3 = new FocusableBox();
        stack.addChild(box3, { width: "fill", height: 3 });

        body.setContent(stack);
        app.root = body;
        app.run();

        backend.sendKey("Tab");
        expect(box1.isFocused).toBe(true);

        backend.sendKey("Tab");
        expect(nonFocusable.isFocused).toBe(false);
        expect(box3.isFocused).toBe(true);
    });

    it("preventDefault on Tab keydown prevents focus cycling", () => {
        const { backend, boxes, body } = setupApp(2);

        // Add capture listener on body that prevents Tab
        body.addEventListener(
            "keydown",
            (e) => {
                if ((e as any).key === "Tab") {
                    e.preventDefault();
                }
            },
            { capture: true },
        );

        backend.sendKey("Tab");
        // Focus should NOT have changed because we prevented default
        expect(boxes[0].isFocused).toBe(false);
        expect(boxes[1].isFocused).toBe(false);
    });

    it("keyboard events dispatched through focused element's ancestor chain", () => {
        const { backend, boxes } = setupApp(2);
        const log: string[] = [];

        boxes[0].addEventListener("keydown", (e) => {
            if ((e as any).key !== "Tab") {
                log.push("box0-" + (e as any).key);
            }
        });
        boxes[1].addEventListener("keydown", (e) => {
            if ((e as any).key !== "Tab") {
                log.push("box1-" + (e as any).key);
            }
        });

        // Focus box 0
        backend.sendKey("Tab");

        // Send a key — should reach box 0 only
        backend.sendKey("a");
        expect(log).toEqual(["box0-a"]);

        // Focus box 1
        backend.sendKey("Tab");
        log.length = 0;

        // Send a key — should reach box 1 only
        backend.sendKey("b");
        expect(log).toEqual(["box1-b"]);
    });
});
