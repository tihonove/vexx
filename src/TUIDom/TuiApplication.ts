import type { ITerminalBackend } from "../Backend/ITerminalBackend.ts";
import { BoxConstraints, Offset, Point, Rect, Size } from "../Common/GeometryPromitives.ts";
import type { KeyPressEvent } from "../Input/KeyEvent.ts";
import type { MouseToken } from "../Input/RawTerminalToken.ts";
import { TerminalScreen } from "../Rendering/TerminalScreen.ts";

import { FocusManager } from "./Events/FocusManager.ts";
import { MouseEventDispatcher } from "./Events/MouseEventDispatcher.ts";
import { TUIKeyboardEvent } from "./Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "./TUIElement.ts";

export class TuiApplication {
    public backend: ITerminalBackend;

    public root: TUIElement | null = null;
    public screen: TerminalScreen;
    public focusManager: FocusManager | null = null;
    public mouseDispatcher: MouseEventDispatcher = new MouseEventDispatcher();
    private renderScheduled = false;

    public constructor(backend: ITerminalBackend) {
        this.backend = backend;
        this.screen = new TerminalScreen(backend.getSize());
    }

    private renderFrame(): void {
        if (this.root) {
            this.screen.clear();

            // Set root global position to (0, 0) — top-left of screen
            this.root.globalPosition = new Point(0, 0);

            // Perform layout with tight constraints based on screen size
            const constraints = BoxConstraints.tight(this.screen.size);
            this.root.performLayout(constraints);

            // Render
            const screenClip = new Rect(new Point(0, 0), this.screen.size);
            this.root.render(new RenderContext(this.screen, new Offset(0, 0), screenClip));
            this.screen.flush(this.backend);
        }
    }

    /**
     * Schedules a deferred render via setImmediate.
     * Batches multiple markDirty() calls into a single frame.
     * Skips rendering if layout is already clean (e.g. a synchronous
     * renderFrame from handleInput already ran).
     */
    public scheduleRender(): void {
        if (this.renderScheduled) return;
        this.renderScheduled = true;
        setImmediate(() => {
            this.renderScheduled = false;
            if (this.root?.isLayoutDirty) {
                this.renderFrame();
            }
        });
    }

    private handleInput(event: KeyPressEvent): void {
        if (this.root) {
            // Dispatch to focused element (or root) with capture/bubble
            const tuiEvent = new TUIKeyboardEvent(event.type, {
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey,
                raw: event.raw,
            });

            const target = this.focusManager?.activeElement ?? this.root;
            const notPrevented = target.dispatchEvent(tuiEvent);

            // Tab focus cycling (default behavior if not prevented, only on keydown)
            if (notPrevented && event.key === "Tab" && event.type === "keydown" && this.focusManager) {
                const direction = event.shiftKey ? "backward" : "forward";
                this.focusManager.cycleFocus(direction);
            }

            this.renderFrame();
        }
    }

    private handleMouse(token: MouseToken): void {
        if (this.root) {
            this.mouseDispatcher.handleMouseToken(token, this.root);
            this.renderFrame();
        }
    }

    private handleResize(size: Size): void {
        this.screen = new TerminalScreen(size);
        // Mark root as dirty so next render recalculates layout
        if (this.root) {
            this.root.markDirty();
        }
        this.renderFrame();
    }

    public run(): void {
        // Set up focus manager on root
        if (this.root) {
            this.focusManager = new FocusManager(this.root);
            this.root.focusManager = this.focusManager;
            this.root.setRequestRenderCallback(() => {
                this.scheduleRender();
            });
        }

        this.backend.setup();

        this.backend.onInput((event) => {
            // Ctrl+C — exit
            if (event.ctrlKey && event.key === "c") {
                this.backend.teardown();
                process.exit(0);
            }
            this.handleInput(event);
        });

        this.backend.onResize((size) => {
            this.handleResize(size);
        });

        this.backend.onMouse((token) => {
            this.handleMouse(token);
        });

        // Initial render
        this.renderFrame();
    }
}
