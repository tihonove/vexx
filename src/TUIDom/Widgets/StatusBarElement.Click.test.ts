import { describe, expect, it } from "vitest";

import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { TUIMouseEvent } from "../Events/TUIMouseEvent.ts";

import { StatusBarElement, type StatusBarItem } from "./StatusBarElement.ts";

const WIDTH = 40;

function createBar(items: StatusBarItem[]): StatusBarElement {
    const bar = new StatusBarElement();
    bar.setItems(items);
    bar.performLayout(BoxConstraints.tight(new Size(WIDTH, 1)));
    return bar;
}

function click(bar: StatusBarElement, localX: number): void {
    bar.dispatchEvent(new TUIMouseEvent("click", { button: "left", screenX: localX, screenY: 0, localX, localY: 0 }));
}

describe("StatusBarElement — clicks", () => {
    it("клик по левому айтему зовёт его onClick", () => {
        let clicked = 0;
        // paddingX=1: "env" занимает x 1..3.
        const bar = createBar([{ text: "env", onClick: () => clicked++ }]);
        click(bar, 1);
        click(bar, 3);
        expect(clicked).toBe(2);
    });

    it("клик по паддингу и за пределами айтемов инертен", () => {
        let clicked = 0;
        const bar = createBar([{ text: "env", onClick: () => clicked++ }]);
        click(bar, 0); // левый паддинг
        click(bar, 4); // сразу за текстом
        click(bar, 20); // пустая середина
        expect(clicked).toBe(0);
    });

    it("разделитель между айтемами инертен, соседи различаются", () => {
        const hits: string[] = [];
        // "aa" x 1..2, разделитель x 3..4, "bb" x 5..6.
        const bar = createBar([
            { text: "aa", onClick: () => hits.push("aa") },
            { text: "bb", onClick: () => hits.push("bb") },
        ]);
        click(bar, 2);
        click(bar, 3);
        click(bar, 4);
        click(bar, 5);
        expect(hits).toEqual(["aa", "bb"]);
    });

    it("правые айтемы кликабельны по своим координатам", () => {
        const hits: string[] = [];
        // right = "Ln 1  UTF-8": длина 11, rightStart = 40-1-11 = 28.
        // "Ln 1" x 28..31, sep 32..33, "UTF-8" x 34..38.
        const bar = createBar([
            { text: "Ln 1", align: "right", onClick: () => hits.push("ln") },
            { text: "UTF-8", align: "right", onClick: () => hits.push("enc") },
        ]);
        click(bar, 28); // первая ячейка "Ln 1"
        click(bar, 33); // разделитель
        click(bar, 34); // первая ячейка "UTF-8"
        click(bar, 38); // последняя ячейка "UTF-8"
        click(bar, 39); // правый паддинг
        expect(hits).toEqual(["ln", "enc", "enc"]);
    });

    it("айтем без onClick инертен, но не мешает соседям", () => {
        const hits: string[] = [];
        const bar = createBar([
            { text: "plain", align: "right" },
            { text: "go", align: "right", onClick: () => hits.push("go") },
        ]);
        // right = "plain  go": rightStart = 40-1-9 = 30; "plain" 30..34, "go" 37..38.
        click(bar, 31);
        click(bar, 37);
        expect(hits).toEqual(["go"]);
    });

    it("правый айтем, перекрытый левой стороной, не ловит клики (левая побеждает)", () => {
        const hits: string[] = [];
        const narrow = new StatusBarElement();
        // width 10, left "abcdef" x 1..6; right "zz" стартовал бы с 7, но
        // если left длиннее — рендер его прячет; проверяем зону перекрытия.
        narrow.setItems([
            { text: "abcdefgh", onClick: () => hits.push("left") },
            { text: "zz", align: "right", onClick: () => hits.push("right") },
        ]);
        narrow.performLayout(BoxConstraints.tight(new Size(10, 1)));
        // rightStart = 10-1-2 = 7 — внутри left (1..8). Кликаем 7: рендер тут
        // рисует left, значит и хит должен уйти левому.
        narrow.dispatchEvent(
            new TUIMouseEvent("click", { button: "left", screenX: 7, screenY: 0, localX: 7, localY: 0 }),
        );
        expect(hits).toEqual(["left"]);
    });
});
