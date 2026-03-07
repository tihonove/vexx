import type { KeyPressEvent, TUIEvent } from "./TerminalBackend/KeyEvent.ts";
import { TerminalScreen } from "./Application/TerminalScreen.ts";


class Point {
  public readonly x: number;
  public readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class Offset {
  public readonly dx: number;
  public readonly dy: number;

  constructor(dx: number, dy: number) {
    this.dx = dx;
    this.dy = dy;
  }
}

class Size {
  public readonly width: number;
  public readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

class RenderContext {
  readonly canvas: TerminalScreen;

  constructor(canvas: TerminalScreen) {
    this.canvas = canvas;
  }
}

export class TUIElement { 
  public dirty: boolean = false;
  public size: Size = new Size(80, 24);
  public contentSize: Size = new Size(80, 24);
  private eventListeners: { [event: string]: ((event: any) => void)[] } = {};

  public emit(event: TUIEvent): void {
    const listeners = this.eventListeners[event.type];
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }

  public addEventListener(event: "keypress", handler: (event: KeyPressEvent) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }
}

export class BodyElement extends TUIElement {
  public title: string = "";

  public render(context: RenderContext) {
    for (let y = 0; y < this.title.length; y++) {
      context.canvas.setCell(0 + y, 0, { char: this.title[y] });
    }
  }
}
