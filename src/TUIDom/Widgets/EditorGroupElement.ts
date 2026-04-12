import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { EditorTabStripElement } from "./EditorTabStripElement.ts";

export class EditorGroupElement extends TUIElement {
    public readonly tabStrip: EditorTabStripElement;
    private content: TUIElement | null = null;

    public constructor() {
        super();
        this.tabStrip = new EditorTabStripElement();
        this.tabStrip.setParent(this);
    }

    public getContent(): TUIElement | null {
        return this.content;
    }

    public setContent(element: TUIElement | null): void {
        if (this.content) {
            this.content.setParent(null);
        }
        this.content = element;
        if (this.content) {
            this.content.setParent(this);
        }
        this.markDirty();
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [this.tabStrip];
        if (this.content) children.push(this.content);
        return children;
    }

    // ─── Layout ───

    public override performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);
        const tabStripHeight = 1;

        // Tab strip: 1 row at top
        this.tabStrip.localPosition = new Offset(0, 0);
        this.tabStrip.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.tabStrip.performLayout(BoxConstraints.tight(new Size(containerSize.width, tabStripHeight)));

        // Content: remaining height
        if (this.content) {
            const contentHeight = Math.max(0, containerSize.height - tabStripHeight);
            this.content.localPosition = new Offset(0, tabStripHeight);
            this.content.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y + tabStripHeight);
            this.content.performLayout(BoxConstraints.tight(new Size(containerSize.width, contentHeight)));
        }

        return containerSize;
    }

    // ─── Render ───

    public override render(context: RenderContext): void {
        // Tab strip
        this.tabStrip.render(context.withOffset(this.tabStrip.localPosition));

        // Content
        if (this.content) {
            const contentOffset = new Offset(this.content.localPosition.dx, this.content.localPosition.dy);
            const contentClip = new Rect(this.content.globalPosition, this.content.layoutSize);
            this.content.render(context.withOffset(contentOffset).withClip(contentClip));
        }
    }
}
