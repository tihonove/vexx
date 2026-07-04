import { describe, expect, it } from "vitest";

import { MockTerminalBackend } from "../Backend/MockTerminalBackend.ts";
import { Size } from "../Common/GeometryPromitives.ts";

import type { TUIElement } from "./TUIElement.ts";
import { BodyElement } from "./Widgets/BodyElement.ts";
import { BoxElement } from "./Widgets/BoxElement.ts";
import { VStackElement } from "./Widgets/VStackElement.ts";

import { TuiApplication } from "./TuiApplication.ts";

// Одно физическое нажатие = keydown + синтезированный keypress. Цель keypress
// закрепляется за целью его keydown: если обработчик keydown сменил фокус
// (закрытие оверлея с restoreFocus), парный keypress не должен уйти новому
// владельцу фокуса (иначе Enter по пункту меню тут же активирует строку дерева).
describe("TuiApplication — keypress follows its keydown target", () => {
    function setup(): {
        backend: MockTerminalBackend;
        app: TuiApplication;
        first: TUIElement;
        second: TUIElement;
        events: string[];
    } {
        const backend = new MockTerminalBackend(new Size(20, 6));
        const app = new TuiApplication(backend);

        const first = new BoxElement();
        const second = new BoxElement();
        first.tabIndex = 0;
        second.tabIndex = 0;

        const stack = new VStackElement();
        stack.addChild(first, { width: "stretch", height: 3 });
        stack.addChild(second, { width: "stretch", height: 3 });

        const body = new BodyElement();
        body.setContent(stack);
        app.root = body;
        app.run();

        const events: string[] = [];
        for (const [name, element] of [
            ["first", first],
            ["second", second],
        ] as const) {
            element.addEventListener("keydown", () => events.push(`${name}:keydown`));
            element.addEventListener("keypress", () => events.push(`${name}:keypress`));
        }

        return { backend, app, first, second, events };
    }

    it("delivers keydown and keypress to the focused element in the normal case", () => {
        const { backend, first, events } = setup();
        first.focus();

        backend.sendKey("x");

        expect(events).toEqual(["first:keydown", "first:keypress"]);
    });

    it("keeps the keypress on the keydown target when the keydown handler moves focus", () => {
        const { backend, app, first, second, events } = setup();
        first.addEventListener("keydown", () => {
            second.focus();
        });
        first.focus();

        backend.sendKey("Enter");

        // Парный keypress ушёл прежней цели, а не новому владельцу фокуса.
        expect(events).toEqual(["first:keydown", "first:keypress"]);
        expect(app.focusManager?.activeElement).toBe(second);

        // Следующее нажатие — уже полностью новому владельцу.
        backend.sendKey("x");
        expect(events.slice(2)).toEqual(["second:keydown", "second:keypress"]);
    });
});
