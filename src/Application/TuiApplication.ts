import { BoxConstraints, Offset, Point, Size } from "../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../Elements/TUIElement.ts";
import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { FocusManager } from "../Events/FocusManager.ts";
import { TerminalScreen } from "./TerminalScreen.ts";

export class TuiApplication {
    private backend: ITerminalBackend;

    public root: TUIElement | null = null;
    public screen: TerminalScreen;
    public focusManager: FocusManager | null = null;

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
            this.root.render(new RenderContext(this.screen));
            this.screen.flush(this.backend);
        }
    }

    private handleInput(event: KeyPressEvent): void {
        if (this.root) {
            // Legacy emit path — existing elements still rely on it
            this.root.emit(event);

            // New dispatchEvent path — dispatch to focused element (or root)
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

        // Initial render
        this.renderFrame();
    }
}
