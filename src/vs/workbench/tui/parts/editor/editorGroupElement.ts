import { BoxConstraints, Offset, Point, Rect, Size } from "../../../../base/common/geometry.ts";
import { RenderContext, TUIElement } from "../../../../base/tui/tuiElement.ts";

import { EditorTabStripElement } from "./editorTabStripElement.ts";
import { OverlayLayer } from "../../../../base/tui/ui/contextview/overlayLayer.ts";

export class EditorGroupElement extends TUIElement {
    public readonly tabStrip: EditorTabStripElement;
    private content: TUIElement | null = null;
    private readonly overlayLayerValue: OverlayLayer;

    public constructor() {
        super();
        this.tabStrip = new EditorTabStripElement();
        this.tabStrip.setParent(this);
        this.overlayLayerValue = new OverlayLayer();
        this.overlayLayerValue.setParent(this);
    }

    /**
     * Local overlay layer sitting on top of the editor content — hosts the find
     * widget (and any future editor-group overlay). Positions are relative to the
     * group; the layer clips its items to the group bounds.
     */
    public get overlayLayer(): OverlayLayer {
        return this.overlayLayerValue;
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
        // Overlay layer last → hit-tested first (clicks on the find widget win
        // over the editor underneath; clicks elsewhere fall through to content).
        children.push(this.overlayLayerValue);
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

        // Overlay layer covers the whole group (tab strip + content); item
        // positions are relative to the group's top-left.
        this.overlayLayerValue.localPosition = new Offset(0, 0);
        this.overlayLayerValue.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
        this.overlayLayerValue.performLayout(BoxConstraints.tight(containerSize));

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
        } else {
            const resolved = this.resolvedStyle;
            const { width, height } = this.layoutSize;
            const tabStripHeight = 1;
            for (let y = tabStripHeight; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    context.setCell(x, y, { char: " ", fg: resolved.fg, bg: resolved.bg });
                }
            }
        }

        // Overlay layer (find widget, …) — rendered last, on top of the content.
        this.overlayLayerValue.render(context);
    }
}
