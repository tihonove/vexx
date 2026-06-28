import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { SashElement } from "./SashElement.ts";

/** Default/reset width of the left panel (file explorer), in columns. */
const DEFAULT_LEFT_WIDTH = 30;
/** Minimum left-panel width — fits the "  EXPLORER" title without clipping. */
const MIN_LEFT_WIDTH = 12;
/** Minimum width left for the center (editor) so a wide sidebar can't starve it. */
const MIN_CENTER_WIDTH = 20;

export class WorkbenchLayoutElement extends TUIElement {
    private leftPanel: TUIElement | null = null;
    private centerContent: TUIElement | null = null;
    private rightPanel: TUIElement | null = null;
    private bottomPanel: TUIElement | null = null;

    private leftPanelVisible = true;
    private leftPanelWidth = DEFAULT_LEFT_WIDTH;

    // Draggable divider between the left panel and the editor.
    private sash = new SashElement();

    public constructor() {
        super();
        this.sash.setParent(this);
        this.sash.onDrag = (boundaryScreenX) => {
            // Translate the absolute boundary column to a panel width and clamp it.
            this.leftPanelWidth = this.clampWidth(boundaryScreenX - this.globalPosition.x);
            this.markDirty();
        };
    }

    public setLeftPanel(element: TUIElement | null): void {
        if (this.leftPanel) {
            this.leftPanel.setParent(null);
        }
        this.leftPanel = element;
        if (element) {
            element.setParent(this);
        }
    }

    public setCenterContent(element: TUIElement | null): void {
        if (this.centerContent) {
            this.centerContent.setParent(null);
        }
        this.centerContent = element;
        if (element) {
            element.setParent(this);
        }
    }

    public setLeftPanelVisible(visible: boolean): void {
        this.leftPanelVisible = visible;
    }

    public getLeftPanelVisible(): boolean {
        return this.leftPanelVisible;
    }

    public setLeftPanelWidth(width: number): void {
        // Context-free lower clamp; the upper bound depends on the container and is
        // enforced in performLayout (and by clampWidth for interactive changes).
        this.leftPanelWidth = Math.max(MIN_LEFT_WIDTH, Math.round(width));
    }

    public getLeftPanelWidth(): number {
        return this.leftPanelWidth;
    }

    /** Grow/shrink the left panel by `delta` columns, clamped to the current container. */
    public nudgeLeftPanelWidth(delta: number): void {
        this.leftPanelWidth = this.clampWidth(this.leftPanelWidth + delta);
        this.markDirty();
    }

    /** Restore the left panel to its default width. */
    public resetLeftPanelWidth(): void {
        this.leftPanelWidth = DEFAULT_LEFT_WIDTH;
        this.markDirty();
    }

    public getLeftPanel(): TUIElement | null {
        return this.leftPanel;
    }

    public getCenterContent(): TUIElement | null {
        return this.centerContent;
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [];
        const showLeft = this.leftPanel !== null && this.leftPanelVisible;
        if (this.leftPanel && this.leftPanelVisible) {
            children.push(this.leftPanel);
        }
        if (this.centerContent) {
            children.push(this.centerContent);
        }
        // Sash is added last so it sits on top of the center content at the boundary
        // column for hit-testing. Only present while the left panel is shown.
        if (showLeft) {
            children.push(this.sash);
        }
        return children;
    }

    private clampWidth(width: number): number {
        return this.clampWidthTo(width, this.layoutSize.width);
    }

    private clampWidthTo(width: number, containerWidth: number): number {
        const maxLeft = Math.max(MIN_LEFT_WIDTH, containerWidth - MIN_CENTER_WIDTH);
        const clamped = Math.max(MIN_LEFT_WIDTH, Math.min(Math.round(width), maxLeft));
        // Never exceed the container itself (degenerate, very narrow terminals).
        return Math.min(clamped, containerWidth);
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        const showLeft = this.leftPanel !== null && this.leftPanelVisible;
        // Display-only clamp — does NOT mutate leftPanelWidth, so the absolute width is
        // preserved across terminal resizes (a temporary shrink doesn't shrink it forever).
        const leftWidth = showLeft ? this.clampWidthTo(this.leftPanelWidth, containerSize.width) : 0;
        const centerWidth = Math.max(0, containerSize.width - leftWidth);

        if (showLeft && this.leftPanel) {
            const leftSize = new Size(leftWidth, containerSize.height);
            this.leftPanel.localPosition = new Offset(0, 0);
            this.leftPanel.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
            this.leftPanel.performLayout(BoxConstraints.tight(leftSize));
        }

        if (this.centerContent) {
            const centerSize = new Size(centerWidth, containerSize.height);
            this.centerContent.localPosition = new Offset(leftWidth, 0);
            this.centerContent.globalPosition = new Point(this.globalPosition.x + leftWidth, this.globalPosition.y);
            this.centerContent.performLayout(BoxConstraints.tight(centerSize));
        }

        if (showLeft) {
            // 1-column hit target sitting on the boundary between the panel and editor.
            // Must be laid out explicitly, otherwise its lazy layoutSize would report a
            // stale 80×24 box at (0,0) and break hit-testing.
            this.sash.localPosition = new Offset(leftWidth, 0);
            this.sash.globalPosition = new Point(this.globalPosition.x + leftWidth, this.globalPosition.y);
            this.sash.performLayout(BoxConstraints.tight(new Size(1, containerSize.height)));
        }

        return containerSize;
    }

    public render(context: RenderContext): void {
        if (this.leftPanel && this.leftPanelVisible) {
            const leftOffset = new Offset(this.leftPanel.localPosition.dx, this.leftPanel.localPosition.dy);
            const leftClip = new Rect(this.leftPanel.globalPosition, this.leftPanel.layoutSize);
            this.leftPanel.render(context.withOffset(leftOffset).withClip(leftClip));
        }

        if (this.centerContent) {
            const centerOffset = new Offset(this.centerContent.localPosition.dx, this.centerContent.localPosition.dy);
            const centerClip = new Rect(this.centerContent.globalPosition, this.centerContent.layoutSize);
            this.centerContent.render(context.withOffset(centerOffset).withClip(centerClip));
        }
        // The sash is invisible — intentionally not rendered.
    }
}
