import { BoxConstraints, Size } from "../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../Elements/TUIElement.ts";
import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";
import { TerminalScreen } from "./TerminalScreen.ts";

export class TuiApplication {
    private backend: ITerminalBackend;

    public root: TUIElement | null = null;
    public screen: TerminalScreen;

    public constructor(backend: ITerminalBackend) {
        this.backend = backend;
        this.screen = new TerminalScreen(backend.getSize());
    }

    private renderFrame(): void {
        if (this.root) {
            this.root.performLayout(BoxConstraints.tight(this.screen.size));
            this.root.render(new RenderContext(this.screen));
            this.screen.flush(this.backend);
        }
    }

    private handleInput(event: KeyPressEvent): void {
        if (this.root) {
            this.root.emit(event);
            this.renderFrame();
        }
    }

    private handleResize(size: Size): void {
        this.screen = new TerminalScreen(size);
        this.renderFrame();
    }

    public run(): void {
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
