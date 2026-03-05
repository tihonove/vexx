import { BodyElement } from "../BodyElement.ts";
import type { ITerminalBackend } from "../TerminalBackend/ITerminalBackend.ts";
import type { KeyEvent } from "../TerminalBackend/KeyEvent.ts";
import { TerminalScreen } from "./TerminalScreen.ts";

export class TuiApplication {
  root: BodyElement | null = null;
  screen: TerminalScreen;
  private backend: ITerminalBackend;

  constructor(backend: ITerminalBackend) {
    this.backend = backend;
    const { cols, rows } = backend.getSize();
    this.screen = new TerminalScreen(cols, rows);
  }

  private handleInput(event: KeyEvent): void {
    if (this.root) {
      this.root.emit(event);
      this.screen.clear();
      this.root.render({ canvas: this.screen });
      this.screen.flush(this.backend);
    }
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
  }
}
