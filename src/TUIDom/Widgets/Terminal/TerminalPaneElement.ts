// Содержимое TERMINAL-вкладки: сплит «активный терминал | список терминалов».
// Слева активный TerminalViewElement (на всё оставшееся место), справа —
// TerminalListElement фиксированной ширины, видимый только когда терминалов больше
// одного (контроллер зовёт setListVisible). Ручной layout по образцу VStackElement/
// WorkbenchLayoutElement: активный виджет получает ширину минус список, поэтому PTY
// корректно ресайзится (TerminalViewElement.performLayout → surface.resize).
//
// Контейнер владеет только раскладкой/показом — сами инстансы и их переключение
// держит TerminalController. Чистый TUIDom: без импортов Controllers.

import { BoxConstraints, Offset, Point, Rect, Size } from "../../../Common/GeometryPromitives.ts";
import { packRgb } from "../../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../../TUIElement.ts";

import { TerminalListElement } from "./TerminalListElement.ts";
import type { TerminalViewElement } from "./TerminalViewElement.ts";

const DEFAULT_BG = packRgb(24, 24, 24);
const DEFAULT_BORDER = packRgb(43, 43, 43);

/** Фиксированная ширина списка терминалов справа. */
export const TERMINAL_LIST_WIDTH = 24;
/** Ширина колонки-разделителя между терминалом и списком, когда список виден. */
const SEPARATOR_WIDTH = 1;

/**
 * Хост содержимого встроенного терминала: активный {@link TerminalViewElement} слева и
 * (опционально) {@link TerminalListElement} справа. Список показывается по
 * {@link setListVisible} — контроллер включает его, когда открыто больше одного
 * терминала. Фокус делегируется активному виджету.
 */
export class TerminalPaneElement extends TUIElement {
    public background = DEFAULT_BG;
    public borderColor = DEFAULT_BORDER;

    public readonly list: TerminalListElement;

    private activeWidget: TerminalViewElement | null = null;
    private listVisible = false;

    public constructor() {
        super();
        this.list = new TerminalListElement();
        this.list.setParent(this);
    }

    /** Меняет показываемый активный терминал (старый виджет отвязывается от дерева). */
    public setActiveWidget(widget: TerminalViewElement | null): void {
        if (this.activeWidget === widget) return;
        this.activeWidget?.setParent(null);
        this.activeWidget = widget;
        widget?.setParent(this);
        this.markDirty();
    }

    /** Показать/скрыть список терминалов справа. */
    public setListVisible(visible: boolean): void {
        if (this.listVisible === visible) return;
        this.listVisible = visible;
        this.markDirty();
    }

    public isListVisible(): boolean {
        return this.listVisible;
    }

    public override focus(): void {
        this.activeWidget?.focus();
    }

    /** Ширина, отдаваемая списку (0, если он скрыт); клэмпится по доступному месту. */
    private listWidth(width: number): number {
        if (!this.listVisible) return 0;
        return Math.min(TERMINAL_LIST_WIDTH, Math.max(0, width - SEPARATOR_WIDTH));
    }

    public override getChildren(): readonly TUIElement[] {
        const children: TUIElement[] = [];
        if (this.activeWidget !== null) children.push(this.activeWidget);
        if (this.listVisible) children.push(this.list);
        return children;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const containerSize = super.performLayout(constraints);
        const { width, height } = containerSize;

        const listW = this.listWidth(width);
        const sep = listW > 0 ? SEPARATOR_WIDTH : 0;
        const terminalW = Math.max(0, width - listW - sep);

        if (this.activeWidget !== null) {
            this.activeWidget.localPosition = new Offset(0, 0);
            this.activeWidget.globalPosition = new Point(this.globalPosition.x, this.globalPosition.y);
            this.activeWidget.performLayout(BoxConstraints.tight(new Size(terminalW, height)));
        }

        if (listW > 0) {
            const listX = terminalW + sep;
            this.list.localPosition = new Offset(listX, 0);
            this.list.globalPosition = new Point(this.globalPosition.x + listX, this.globalPosition.y);
            this.list.performLayout(BoxConstraints.tight(new Size(listW, height)));
        }

        return containerSize;
    }

    public override render(context: RenderContext): void {
        const { width, height } = this.layoutSize;
        const listW = this.listWidth(width);
        const sep = listW > 0 ? SEPARATOR_WIDTH : 0;
        const terminalW = Math.max(0, width - listW - sep);

        if (this.activeWidget !== null) {
            this.renderChild(context, this.activeWidget);
        }

        // Вертикальный разделитель между терминалом и списком.
        if (sep > 0) {
            for (let y = 0; y < height; y++) {
                context.setCell(terminalW, y, { char: "│", fg: this.borderColor, bg: this.background });
            }
        }

        if (listW > 0) {
            this.renderChild(context, this.list);
        }
    }

    private renderChild(context: RenderContext, child: TUIElement): void {
        const offset = new Offset(child.localPosition.dx, child.localPosition.dy);
        const clip = new Rect(child.globalPosition, child.layoutSize);
        child.render(context.withOffset(offset).withClip(clip));
    }
}
