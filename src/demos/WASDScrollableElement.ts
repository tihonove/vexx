import { packRgb } from "../Rendering/ColorUtils.ts";
import { RenderContext } from "../TUIDom/TUIElement.ts";
import { ScrollableElement, type ScrollViewportInfo } from "../TUIDom/Widgets/ScrollableElement.ts";

const BG_EVEN = packRgb(40, 40, 50);
const BG_ODD = packRgb(30, 30, 40);
const LABEL_FG = packRgb(120, 180, 220);
const COORD_FG = packRgb(80, 80, 100);

export class WASDScrollableElement extends ScrollableElement {
    private gridWidth: number;
    private gridHeight: number;

    public constructor(gridWidth: number, gridHeight: number) {
        super();
        this.gridWidth = gridWidth;
        this.gridHeight = gridHeight;

        this.addEventListener("keypress", (event) => {
            switch (event.key) {
                case "w":
                    this.scrollBy(0, -1);
                    break;
                case "s":
                    this.scrollBy(0, 1);
                    break;
                case "a":
                    this.scrollBy(-1, 0);
                    break;
                case "d":
                    this.scrollBy(1, 0);
                    break;
            }
        });
    }

    public get contentHeight(): number {
        return this.gridHeight;
    }

    public get contentWidth(): number {
        return this.gridWidth;
    }

    protected renderViewport(context: RenderContext, viewport: ScrollViewportInfo): void {
        for (let screenY = 0; screenY < viewport.viewportHeight; screenY++) {
            const contentY = viewport.scrollTop + screenY;
            if (contentY >= this.gridHeight) break;

            for (let screenX = 0; screenX < viewport.viewportWidth; screenX++) {
                const contentX = viewport.scrollLeft + screenX;
                if (contentX >= this.gridWidth) break;

                const checkerboard = (Math.floor(contentX / 4) + Math.floor(contentY / 2)) % 2 === 0;
                const bg = checkerboard ? BG_EVEN : BG_ODD;

                const label = `${contentX},${contentY}`;
                const cellInLabel = contentX % 4;
                const isLabelRow = contentY % 2 === 0;

                let char = " ";
                let fg: number | undefined;
                if (isLabelRow && cellInLabel < label.length) {
                    char = label[cellInLabel];
                    fg = contentY % 10 === 0 || contentX % 20 === 0 ? LABEL_FG : COORD_FG;
                }

                context.setCell(screenX, screenY, { char, fg, bg });
            }
        }
    }
}
