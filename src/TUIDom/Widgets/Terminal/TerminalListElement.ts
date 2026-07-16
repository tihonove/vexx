// Список открытых терминалов — вертикальная «полоса вкладок» справа от активного
// терминала (как terminal tabs в VS Code). Чистый TUIElement-лист: рендерит строки
// «id → заголовок», подсвечивает активную, а поведение (переключение/убийство) отдаёт
// колбэками наверх — контроллер вешает их на setActiveTerminal/killTerminal, поэтому
// TUIDom не знает про сессии/команды. Один и тот же приём, что EditorTabStripElement.
//
// Показывается контейнером (TerminalPaneElement) только когда терминалов больше одного.

import { DisplayLine } from "../../../Common/DisplayLine.ts";
import { packRgb } from "../../../Rendering/ColorUtils.ts";
import { RenderContext, TUIElement } from "../../TUIElement.ts";

/** Одна строка списка: стабильный id инстанса + отображаемый заголовок. */
export interface TerminalListItem {
    readonly id: number;
    readonly title: string;
}

const DEFAULT_BG = packRgb(24, 24, 24);
const DEFAULT_FG = packRgb(142, 142, 142);
const DEFAULT_ACTIVE_BG = packRgb(4, 57, 94);
const DEFAULT_ACTIVE_FG = packRgb(255, 255, 255);
const DEFAULT_HOVER_BG = packRgb(42, 45, 46);

/** Отступ заголовка от левого края строки. */
const LEFT_PAD = 1;
/** Символ «убить терминал» у правого края строки. */
const CLOSE_CHAR = "×";
/** Пустая колонка справа после ×. */
const RIGHT_PAD = 1;

/**
 * Вертикальный список терминалов. Каждая строка — один инстанс: клик по строке
 * переключает активный (`onActivate(id)`), `×` у правого края убивает этот терминал
 * (`onClose(id)`), middle-click по строке — тоже kill (как в editor-вкладках).
 * Цвета пушит контроллер из темы (`panel.*` / `list.*`), как и остальным виджетам.
 */
export class TerminalListElement extends TUIElement {
    public background = DEFAULT_BG;
    public foreground = DEFAULT_FG;
    public activeSelectionBg = DEFAULT_ACTIVE_BG;
    public activeSelectionFg = DEFAULT_ACTIVE_FG;
    public hoverBg = DEFAULT_HOVER_BG;

    public onActivate?: (id: number) => void;
    public onClose?: (id: number) => void;

    private items: TerminalListItem[] = [];
    private activeId: number | null = null;
    private hoveredIndex = -1;

    public constructor() {
        super();

        this.addEventListener("click", (event) => {
            const index = event.localY;
            if (index < 0 || index >= this.items.length) return;
            const id = this.items[index].id;
            if (event.button === "middle") {
                this.onClose?.(id);
                return;
            }
            if (event.button !== "left") return;
            if (event.localX >= this.closeCol()) this.onClose?.(id);
            else this.onActivate?.(id);
        });

        this.addEventListener("mousemove", (event) => {
            const index = event.localY >= 0 && event.localY < this.items.length ? event.localY : -1;
            if (index === this.hoveredIndex) return;
            this.hoveredIndex = index;
            this.markDirty();
        });

        this.addEventListener("mouseleave", () => {
            if (this.hoveredIndex === -1) return;
            this.hoveredIndex = -1;
            this.markDirty();
        });
    }

    /** Обновляет строки и активный id (контроллер зовёт при open/close/switch). */
    public setItems(items: readonly TerminalListItem[], activeId: number | null): void {
        this.items = [...items];
        this.activeId = activeId;
        if (this.hoveredIndex >= this.items.length) this.hoveredIndex = -1;
        this.markDirty();
    }

    /** Колонка символа × (у правого края, оставляя один пробел справа). */
    private closeCol(): number {
        return this.layoutSize.width - RIGHT_PAD - CLOSE_CHAR.length;
    }

    public override render(context: RenderContext): void {
        const { width, height } = this.layoutSize;
        const closeCol = this.closeCol();

        for (let i = 0; i < this.items.length && i < height; i++) {
            const item = this.items[i];
            const isActive = item.id === this.activeId;
            const isHovered = i === this.hoveredIndex;
            const rowBg = isActive ? this.activeSelectionBg : isHovered ? this.hoverBg : this.background;
            const rowFg = isActive ? this.activeSelectionFg : this.foreground;

            // Заливаем строку фоном.
            for (let x = 0; x < width; x++) {
                context.setCell(x, i, { char: " ", fg: rowFg, bg: rowBg });
            }

            // Заголовок, обрезанный по ширине до зоны ×.
            const line = new DisplayLine(item.title);
            for (let col = 0; col < line.displayWidth; col++) {
                const x = LEFT_PAD + col;
                if (x >= closeCol) break;
                const char = line.charAtColumn(col);
                if (char === "") continue; // хвост wide-графемы
                context.setCell(x, i, { char, fg: rowFg, bg: rowBg });
            }

            // × показываем на активной и на наведённой строке (VS Code — по ховеру).
            if ((isActive || isHovered) && closeCol >= LEFT_PAD && closeCol < width) {
                context.setCell(closeCol, i, { char: CLOSE_CHAR, fg: rowFg, bg: rowBg });
            }
        }
    }
}
