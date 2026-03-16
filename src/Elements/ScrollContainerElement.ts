import { Offset, Size } from "../Common/GeometryPromitives.ts";
import type { TUIEvent } from "../TerminalBackend/KeyEvent.ts";
import type { IScrollable } from "./IScrollable.ts";
import { renderScrollBar } from "./ScrollBarRenderer.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

export class ScrollContainerElement extends TUIElement {
    private child: TUIElement & IScrollable;

    public constructor(child: TUIElement & IScrollable) {
        super();
        this.child = child;
    }

    public getChild(): TUIElement & IScrollable {
        return this.child;
    }

    public performLayout(): void {
        this.child.size = new Size(this.size.width - 1, this.size.height);
        this.child.performLayout();
    }

    public render(context: RenderContext): void {
        this.child.render(context);

        renderScrollBar(
            context,
            this.size.width - 1,
            this.size.height,
            this.child.contentHeight,
            this.child.scrollTop,
            this.size.height,
        );
    }

    public override emit(event: TUIEvent): void {
        super.emit(event);
        this.child.emit(event);
    }
}
