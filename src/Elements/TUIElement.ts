import { TerminalScreen } from "../Application/TerminalScreen.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import type { KeyEvent } from "../TerminalBackend/KeyEvent.ts";

export class RenderContext {
  readonly canvas: TerminalScreen;

  constructor(canvas: TerminalScreen) {
    this.canvas = canvas;
  }
}

class LayoutStyle {

}

class LayoutState {

}

export class TUIElement {
  public dirty: boolean = false;
  public layoutStyle?: LayoutStyle;
  public layoutState?: LayoutState;
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
}
