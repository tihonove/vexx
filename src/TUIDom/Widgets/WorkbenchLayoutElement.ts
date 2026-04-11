import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export class WorkbenchLayoutElement extends TUIElement {
    private leftPanel: TUIElement | null = null;
    private centerContent: TUIElement | null = null;
    private rightPanel: TUIElement | null = null;
    private bottomPanel: TUIElement | null = null;

    private leftPanelVisible = true;
    private leftPanelWidth = 30;

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
        this.leftPanelWidth = width;
    }

    public getLeftPanelWidth(): number {
        return this.leftPanelWidth;
    }

    public getLeftPanel(): TUIElement | null {
        return this.leftPanel;
    }

    public getCenterContent(): TUIElement | null {
        return this.centerContent;
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [];
        if (this.leftPanel && this.leftPanelVisible) {
            children.push(this.leftPanel);
        }
        if (this.centerContent) {
            children.push(this.centerContent);
        }
        return children;
    }

    public performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);

        const showLeft = this.leftPanel !== null && this.leftPanelVisible;
        const leftWidth = showLeft ? Math.min(this.leftPanelWidth, containerSize.width) : 0;
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
    }
}
