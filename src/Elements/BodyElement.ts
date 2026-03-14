import { RenderContext, TUIElement } from "./TUIElement.ts";
import { Point } from "../Common/GeometryPromitives.ts";

export class BodyElement extends TUIElement {
    public title = "";

    public render(context: RenderContext) {
        for (let y = 0; y < this.title.length; y++) {
            context.canvas.setCell(new Point(0 + y, 0), { char: this.title[y] });
        }
    }
}
