import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent, TUIEvent } from "../TerminalBackend/KeyEvent.ts";

export class RenderContext {
    public readonly canvas: TerminalScreen;
    public readonly offset: Offset;

    public constructor(canvas: TerminalScreen, offset: Offset = new Offset(0, 0)) {
        this.canvas = canvas;
        this.offset = offset;
    }

    public withOffset(extra: Offset): RenderContext {
        return new RenderContext(this.canvas, new Offset(this.offset.dx + extra.dx, this.offset.dy + extra.dy));
    }
}

export type KeyboardEventType = "keypress" | "keydown" | "keyup";

export class TUIElement {
    private _size: Size = new Size(80, 24);

    public dirty = false;
    public layoutStyle: unknown = undefined;
    public layoutState: unknown = undefined;

    // Coordinate system
    public localPosition: Offset = new Offset(0, 0);
    public globalPosition: Point = new Point(0, 0);
    public isLayoutDirty = true;
    protected _parent: TUIElement | null = null;
    protected root: TUIElement | null = null;

    private eventListeners: Record<KeyboardEventType, ((event: KeyPressEvent) => void)[]> = {
        keypress: [],
        keydown: [],
        keyup: [],
    };

    /**
     * Lazy evaluation: if isDirty, performs layout with default constraints.
     * Otherwise returns cached size.
     */
    public get size(): Size {
        if (this.isLayoutDirty) {
            const constraints = BoxConstraints.loose(this._size);
            this.performLayout(constraints);
        }
        return this._size;
    }

    /**
     * Returns the cached size without triggering layout.
     * Protected — use by subclasses in performLayout to avoid recursion.
     */
    protected getCachedSize(): Size {
        return this._size;
    }

    public emit(event: TUIEvent): void {
        const listeners = this.eventListeners[event.type];
        for (const listener of listeners) {
            listener(event);
        }
    }

    public addEventListener(event: KeyboardEventType, handler: (event: KeyPressEvent) => void): void {
        this.eventListeners[event].push(handler);
    }

    public removeEventListener(event: KeyboardEventType, handler: (event: KeyPressEvent) => void): void {
        const listeners = this.eventListeners[event];
        const index = listeners.indexOf(handler);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }

    /**
     * Marks this element and ancestors as dirty.
     * Call this when layout-affecting properties change.
     */
    public markDirty(): void {
        this.isLayoutDirty = true;
        if (this._parent) {
            this._parent.markDirty();
        }
    }

    /**
     * Sets parent reference for dirty propagation and root reference propagation.
     * Called by parent elements when adding children.
     */
    public setParent(parent: TUIElement | null): void {
        this._parent = parent;
        // Propagate root from parent to child
        if (parent) {
            this.root = parent.root;
        } else {
            this.root = null;
        }
    }

    /**
     * Returns the root element of the hierarchy.
     */
    public getRoot(): TUIElement | null {
        return this.root;
    }

    /**
     * Sets this element as the root (used for testing and by BodyElement).
     */
    public setAsRoot(): void {
        this.root = this;
    }

    /**
     * Performs layout and returns the calculated size.
     * Does NOT set this.size anymore — caller must handle the returned value.
     * Caller should set this._size from outside (TuiApplication or parent element).
     */
    public performLayout(constraints: BoxConstraints): Size {
        const resultSize = constraints.constrain(this._size);
        this._size = resultSize;
        this.isLayoutDirty = false;
        return resultSize;
    }

    public render(_context: RenderContext): void {
        // Base implementation does nothing.
        // Subclasses override to draw themselves.
    }
}
