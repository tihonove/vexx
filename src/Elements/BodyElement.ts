import { RenderContext, TUIElement } from "./TUIElement.ts";



export class BodyElement extends TUIElement {
  public title: string = "";

  public render(context: RenderContext) {
    for (let y = 0; y < this.title.length; y++) {
      context.canvas.setCell(0 + y, 0, { char: this.title[y] });
    }
  }
}
