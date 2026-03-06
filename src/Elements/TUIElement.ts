import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { Offset, Size } from "../Common/GeometryPromitives.ts";
import type { KeyEvent } from "../TerminalBackend/KeyEvent.ts";

export class RenderContext {
  readonly canvas: TerminalScreen;
  readonly offset: Offset;

  constructor(canvas: TerminalScreen, offset: Offset = new Offset(0, 0)) {
    this.canvas = canvas;
    this.offset = offset;
  }

  public withOffset(extra: Offset): RenderContext {
    return new RenderContext(
      this.canvas,
      new Offset(this.offset.dx + extra.dx, this.offset.dy + extra.dy),
    );
  }
}

export class TUIElement {
  public dirty: boolean = false;
  public size: Size = new Size(80, 24);
  public contentSize: Size = new Size(80, 24);
  private eventListeners: { [event: string]: ((event: any) => void)[]; } = {};

  public emit(event: KeyEvent): void {
    if (this.eventListeners["keypress"]) {
      for (const listener of this.eventListeners["keypress"]) {
        listener(event);
      }
    }
  }

  public addEventListener(event: "keypress", handler: (event: KeyEvent) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  public performLayout(): void {
    // Base implementation does nothing.
    // Container subclasses (VStackElement, etc.) override this.
  }

  public render(_context: RenderContext): void {
    // Base implementation does nothing.
    // Subclasses override to draw themselves.
  }
}
