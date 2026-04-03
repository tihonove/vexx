import { BoxConstraints, Offset, Point, Rect, Size } from "../Common/GeometryPromitives.ts";
import type { CellPatch } from "../Rendering/Grid.ts";
import { TerminalScreen } from "../Rendering/TerminalScreen.ts";

import type { FocusManager } from "./Events/FocusManager.ts";
import { EventPhase, TUIEventBase } from "./Events/TUIEventBase.ts";
import type { TUIFocusEvent } from "./Events/TUIFocusEvent.ts";
import { TUIKeyboardEvent } from "./Events/TUIKeyboardEvent.ts";
import { querySelector, querySelectorAll } from "./TUISelector.ts";

const MAX_COORD = 100_000;
const INFINITE_CLIP = new Rect(new Point(0, 0), new Size(MAX_COORD, MAX_COORD));

export class RenderContext {
    public readonly canvas: TerminalScreen;
    public readonly offset: Offset;
    public readonly clipRect: Rect;

    public constructor(canvas: TerminalScreen, offset: Offset = new Offset(0, 0), clipRect: Rect = INFINITE_CLIP) {
        this.canvas = canvas;
        this.offset = offset;
        this.clipRect = clipRect;
    }

    public withOffset(extra: Offset): RenderContext {
        return new RenderContext(
            this.canvas,
            new Offset(this.offset.dx + extra.dx, this.offset.dy + extra.dy),
            this.clipRect,
        );
    }

    public withClip(rect: Rect): RenderContext {
        return new RenderContext(this.canvas, this.offset, this.clipRect.intersect(rect));
    }

    public setCell(x: number, y: number, cell: CellPatch): void {
        const screenX = x + this.offset.dx;
        const screenY = y + this.offset.dy;
        if (!this.clipRect.containsPoint(new Point(screenX, screenY))) return;
        this.canvas.setCell(new Point(screenX, screenY), cell);
    }

    public setCursorPosition(x: number, y: number): void {
        const screenX = x + this.offset.dx;
        const screenY = y + this.offset.dy;
        if (!this.clipRect.containsPoint(new Point(screenX, screenY))) return;
        this.canvas.setCursorPosition(new Point(screenX, screenY));
    }
}

export interface AddEventListenerOptions {
    capture?: boolean;
}

export interface TUIElementEventMap {
    keydown: TUIKeyboardEvent;
    keyup: TUIKeyboardEvent;
    keypress: TUIKeyboardEvent;
    focus: TUIFocusEvent;
    blur: TUIFocusEvent;
}

interface ListenerEntry {
    handler: (event: TUIEventBase) => void;
    capture: boolean;
}

export class TUIElement {
    private allocatedSize: Size = new Size(80, 24);

    public dirty = false;
    public layoutStyle: unknown = undefined;
    public layoutState: unknown = undefined;

    // Identity
    public id: string | undefined = undefined;
    public role: string | undefined = undefined;

    // Focus support
    public tabIndex = -1;

    // Coordinate system
    public localPosition: Offset = new Offset(0, 0);
    public globalPosition: Point = new Point(0, 0);
    public isLayoutDirty = true;
    protected _parent: TUIElement | null = null;
    protected root: TUIElement | null = null;

    // Callback invoked when markDirty reaches the root — used by TuiApplication to schedule a render
    private requestRenderCallback: (() => void) | null = null;

    // Focus manager — set only on root element
    public focusManager: FocusManager | null = null;

    // Event listener storage — supports any event type + capture flag
    private _listeners = new Map<string, ListenerEntry[]>();

    /**
     * Allocated visible area on screen, set by parent container via performLayout().
     * Lazy fallback: if layout is dirty, triggers performLayout with loose constraints.
     */
    public get layoutSize(): Size {
        if (this.isLayoutDirty) {
            const constraints = BoxConstraints.loose(this.allocatedSize);
            this.performLayout(constraints);
        }
        return this.allocatedSize;
    }

    public get isFocused(): boolean {
        const fm = this.root?.focusManager ?? null;
        return fm !== null && fm.activeElement === this;
    }

    public getParent(): TUIElement | null {
        return this._parent;
    }

    public getChildren(): readonly TUIElement[] {
        return [];
    }

    /**
     * Builds the path from root to this element (inclusive on both ends).
     */
    public getAncestorPath(): TUIElement[] {
        const path: TUIElement[] = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current: TUIElement | null = this;
        while (current !== null) {
            path.push(current);
            current = current._parent;
        }
        path.reverse();
        return path;
    }

    /**
     * Returns focusable descendants (tabIndex >= 0) in depth-first order.
     */
    public getDepthFirstFocusableOrder(): TUIElement[] {
        const result: TUIElement[] = [];
        const visit = (el: TUIElement) => {
            if (el.tabIndex >= 0) {
                result.push(el);
            }
            for (const child of el.getChildren()) {
                visit(child);
            }
        };
        visit(this);
        return result;
    }

    // ─── Event API (capture/bubble propagation) ───

    public addEventListener<K extends keyof TUIElementEventMap>(
        type: K,
        handler: (event: TUIElementEventMap[K]) => void,
        options?: AddEventListenerOptions,
    ): void;
    public addEventListener(
        type: string,
        handler: (event: TUIEventBase) => void,
        options?: AddEventListenerOptions,
    ): void;
    public addEventListener(
        type: string,
        handler: (event: TUIEventBase) => void,
        options?: AddEventListenerOptions,
    ): void {
        const capture = options?.capture ?? false;
        let entries = this._listeners.get(type);
        if (!entries) {
            entries = [];
            this._listeners.set(type, entries);
        }
        entries.push({ handler, capture });
    }

    public removeEventListener<K extends keyof TUIElementEventMap>(
        type: K,
        handler: (event: TUIElementEventMap[K]) => void,
        options?: AddEventListenerOptions,
    ): void;
    public removeEventListener(
        type: string,
        handler: (event: TUIEventBase) => void,
        options?: AddEventListenerOptions,
    ): void;
    public removeEventListener(
        type: string,
        handler: (event: TUIEventBase) => void,
        options?: AddEventListenerOptions,
    ): void {
        const capture = options?.capture ?? false;
        const entries = this._listeners.get(type);
        if (!entries) return;
        const index = entries.findIndex((e) => e.handler === handler && e.capture === capture);
        if (index !== -1) {
            entries.splice(index, 1);
        }
    }

    /**
     * Dispatches event with capture → target → bubble phases (DOM-like).
     * Returns true if preventDefault() was NOT called.
     */
    public dispatchEvent(event: TUIEventBase): boolean {
        event.target = this;

        // Build path from root → ... → parent (excluding target)
        const path: TUIElement[] = [];
        let current: TUIElement | null = this._parent;
        while (current !== null) {
            path.push(current);
            current = current._parent;
        }
        path.reverse(); // root first

        // Capture phase
        event.eventPhase = EventPhase.CAPTURING;
        for (const el of path) {
            event.currentTarget = el;
            this._invokeListeners(el, event, true);
            if (event.propagationStopped) break;
        }

        // Target phase
        if (!event.propagationStopped) {
            event.eventPhase = EventPhase.AT_TARGET;
            event.currentTarget = this;
            this._invokeListeners(this, event, null); // both capture and bubble listeners
        }

        // Bubble phase
        if (!event.propagationStopped && event.bubbles) {
            event.eventPhase = EventPhase.BUBBLING;
            for (let i = path.length - 1; i >= 0; i--) {
                event.currentTarget = path[i];
                this._invokeListeners(path[i], event, false);
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- side effect from handler
                if (event.propagationStopped) break;
            }
        }

        event.eventPhase = EventPhase.NONE;
        event.currentTarget = null;

        return !event.defaultPrevented;
    }

    /**
     * Invoke listeners on an element for the given event.
     * captureFilter: true = only capture, false = only bubble, null = both (target phase)
     */
    private _invokeListeners(el: TUIElement, event: TUIEventBase, captureFilter: boolean | null): void {
        const entries = el._listeners.get(event.type);
        if (!entries) return;
        // Snapshot to avoid mutation during iteration
        const snapshot = entries.slice();
        for (const entry of snapshot) {
            if (captureFilter === null || entry.capture === captureFilter) {
                entry.handler(event);
                if (event.immediatePropagationStopped) break;
            }
        }
    }

    // ─── Focus convenience ───

    public focus(): void {
        const fm = this.root?.focusManager ?? null;
        if (fm) {
            fm.setFocus(this);
        }
    }

    public blur(): void {
        const fm = this.root?.focusManager ?? null;
        if (fm?.activeElement === this) {
            fm.setFocus(null);
        }
    }

    /**
     * Marks this element and ancestors as dirty.
     * Call this when layout-affecting properties change.
     *
     * When propagation reaches the root (no parent), fires the
     * requestRenderCallback so TuiApplication can schedule a deferred render.
     * Batching is handled by TuiApplication.scheduleRender().
     */
    public markDirty(): void {
        this.isLayoutDirty = true;
        if (this._parent) {
            this._parent.markDirty();
        } else if (this.requestRenderCallback) {
            this.requestRenderCallback();
        }
    }

    /**
     * Sets parent reference for dirty propagation and root reference propagation.
     * Called by parent elements when adding children.
     */
    public setParent(parent: TUIElement | null): void {
        this._parent = parent;
        const newRoot = parent ? parent.root : null;
        this.propagateRoot(newRoot);
    }

    private propagateRoot(newRoot: TUIElement | null): void {
        this.root = newRoot;
        for (const child of this.getChildren()) {
            child.propagateRoot(newRoot);
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
     * Sets a callback to be invoked when markDirty() reaches the root element.
     * Used by TuiApplication to schedule async re-renders.
     */
    public setRequestRenderCallback(callback: (() => void) | null): void {
        this.requestRenderCallback = callback;
    }

    /**
     * Performs layout: applies constraints to set the allocated visible area.
     */
    public performLayout(constraints: BoxConstraints): Size {
        const resultSize = constraints.constrain(this.allocatedSize);
        this.allocatedSize = resultSize;
        this.isLayoutDirty = false;
        return resultSize;
    }

    public render(_context: RenderContext): void {
        // Base implementation does nothing.
        // Subclasses override to draw themselves.
    }

    // ─── Query API (querySelector / querySelectorAll) ───

    public querySelector(selector: string): TUIElement | null {
        return querySelector(this, selector);
    }

    public querySelectorAll(selector: string): TUIElement[] {
        return querySelectorAll(this, selector);
    }
}
