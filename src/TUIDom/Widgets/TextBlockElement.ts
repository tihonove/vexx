import { DisplayLine } from "../../Common/DisplayLine.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import type { IContentSized } from "./IScrollable.ts";

export class TextBlockElement extends TUIElement implements IContentSized {
    public contentHeight: number;
    public contentWidth: number;
    private lines: string[];

    public constructor(lineCount: number) {
        super();
        this.contentHeight = lineCount;
        this.lines = [];
        for (let i = 0; i < lineCount; i++) {
            this.lines.push(`Line ${String(i + 1).padStart(3, "0")}`);
        }
        this.contentWidth = this.lines.reduce((max, l) => Math.max(max, new DisplayLine(l).displayWidth), 0);
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return this.contentWidth;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.contentWidth;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return this.contentHeight;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.contentHeight;
    }

    public render(context: RenderContext): void {
        const width = this.layoutSize.width;

        for (let y = 0; y < this.contentHeight; y++) {
            const lineContent = y < this.lines.length ? this.lines[y] : "";
            context.drawText(0, y, lineContent, undefined, { maxWidth: width });
        }
    }
}
