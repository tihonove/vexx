import { Point } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";

export class TextBlockElement extends TUIElement implements IScrollable {
    public contentHeight: number;
    public scrollTop = 0;
    private lines: string[];

    public constructor(lineCount: number) {
        super();
        this.contentHeight = lineCount;
        this.lines = [];
        for (let i = 0; i < lineCount; i++) {
            this.lines.push(`Line ${String(i + 1).padStart(3, "0")}`);
        }

        this.addEventListener("keypress", (event) => {
            if (event.key === "ArrowDown") {
                this.scrollDown();
            } else if (event.key === "ArrowUp") {
                this.scrollUp();
            }
        });
    }

    public scrollDown(): void {
        const maxScroll = Math.max(0, this.contentHeight - this.size.height);
        this.scrollTop = Math.min(maxScroll, this.scrollTop + 1);
    }

    public scrollUp(): void {
        this.scrollTop = Math.max(0, this.scrollTop - 1);
    }

    public render(context: RenderContext): void {
        const { dx: ox, dy: oy } = context.offset;
        const visibleLines = this.size.height;
        const visibleCols = this.size.width;

        for (let screenY = 0; screenY < visibleLines; screenY++) {
            const lineIndex = this.scrollTop + screenY;
            const lineContent = lineIndex < this.lines.length ? this.lines[lineIndex] : "";

            for (let screenX = 0; screenX < visibleCols; screenX++) {
                const char = screenX < lineContent.length ? lineContent[screenX] : " ";
                context.canvas.setCell(new Point(ox + screenX, oy + screenY), { char });
            }
        }
    }
}
