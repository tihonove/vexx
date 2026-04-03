import { Point } from "../../Common/GeometryPromitives.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

export class BoxElement extends TUIElement {
    public render(context: RenderContext): void {
        const w = this.layoutSize.width;
        const h = this.layoutSize.height;
        const { dx: ox, dy: oy } = context.offset;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const isTop = y === 0;
                const isBottom = y === h - 1;
                const isLeft = x === 0;
                const isRight = x === w - 1;

                let char: string;

                if ((isTop || isBottom) && (isLeft || isRight)) {
                    char = "+";
                } else if (isTop || isBottom) {
                    char = "-";
                } else if (isLeft || isRight) {
                    char = "|";
                } else {
                    char = " ";
                }

                context.canvas.setCell(new Point(ox + x, oy + y), { char });
            }
        }
    }
}
