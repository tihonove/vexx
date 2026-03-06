import { Size } from "../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../Elements/TUIElement.ts";
import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";
import type { KeyEvent } from "../TerminalBackend/KeyEvent.ts";
import { TerminalScreen } from "./TerminalScreen.ts";

export class TuiApplication {
  root: TUIElement | null = null;
  screen: TerminalScreen;
  private backend: ITerminalBackend;

  constructor(backend: ITerminalBackend) {
    this.backend = backend;
    const { cols, rows } = backend.getSize();
    this.screen = new TerminalScreen(cols, rows);
  }

  private renderFrame(): void {
    if (this.root) {
      this.screen.clear();
      this.root.size = new Size(this.screen.width, this.screen.height);
      this.root.performLayout();
      this.root.render(new RenderContext(this.screen));
      this.screen.flush(this.backend);
    }
  }

  private handleInput(event: KeyEvent): void {
    if (this.root) {
      this.root.emit(event);
      this.renderFrame();
    }
  }

  private handleResize(cols: number, rows: number): void {
    this.screen = new TerminalScreen(cols, rows);
    this.renderFrame();
  }

  public run(): void {
    this.backend.setup();

    this.backend.onInput((event) => {
      // Ctrl+C — exit
      if (event.key === "Ctrl+C") {
        this.backend.teardown();
        process.exit(0);
      }
      this.handleInput(event);
    });

    this.backend.onResize(({ cols, rows }) => {
      this.handleResize(cols, rows);
    });

    // Initial render
    this.renderFrame();
  }
}
