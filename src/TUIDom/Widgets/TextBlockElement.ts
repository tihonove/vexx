import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IScrollable } from "./IScrollable.ts";

export class TextBlockElement extends TUIElement implements IScrollable {
    public contentHeight: number;
    public contentWidth: number;
    public scrollTop = 0;
    public scrollLeft = 0;
    private lines: string[];

    public constructor(lineCount: number) {
        super();
        this.contentHeight = lineCount;
        this.lines = [];
        for (let i = 0; i < lineCount; i++) {
            this.lines.push(`Line ${String(i + 1).padStart(3, "0")}`);
        }
        this.contentWidth = this.lines.reduce((max, l) => Math.max(max, l.length), 0);

        this.addEventListener("keypress", (event) => {
            if (event.key === "ArrowDown") {
                this.scrollDown();
            } else if (event.key === "ArrowUp") {
                this.scrollUp();
            }
        });
    }

    public scrollDown(): void {
        const maxScroll = Math.max(0, this.contentHeight - this.layoutSize.height);
        this.scrollTop = Math.min(maxScroll, this.scrollTop + 1);
    }

    public scrollUp(): void {
        this.scrollTop = Math.max(0, this.scrollTop - 1);
    }

    public render(context: RenderContext): void {
        const width = this.layoutSize.width;

        for (let y = 0; y < this.contentHeight; y++) {
            const lineContent = y < this.lines.length ? this.lines[y] : "";

            for (let x = 0; x < width; x++) {
                const char = x < lineContent.length ? lineContent[x] : " ";
                context.setCell(x, y, { char });
            }
        }
    }
}
