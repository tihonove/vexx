// Контрол отрисовки терминала — «клиент» встроенного терминала.
//
// TUIElement-лист: каждый кадр читает сетку ячеек VT-эмулятора
// (`session.terminal.buffer.active`) и блитит её в наш grid через `RenderContext.setCell`.
// Размером PTY управляет по реально выделенному месту (`performLayout` → `session.resize`),
// поэтому ресайз окна автоматически рефлоует шелл. Ввод пробрасывает в PTY через
// `encodeKeyForPty`. См. docs/TODO/IntegratedTerminal.md.

import type { IBufferCell } from "@xterm/headless";

import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { DEFAULT_COLOR } from "../../Rendering/ColorUtils.ts";
import { StyleFlags } from "../../Rendering/StyleFlags.ts";
import type { TUIEventBase } from "../../TUIDom/Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../../TUIDom/Events/TUIKeyboardEvent.ts";
import type { TUIMouseEvent } from "../../TUIDom/Events/TUIMouseEvent.ts";
import type { TUIPasteEvent } from "../../TUIDom/Events/TUIPasteEvent.ts";
import { RenderContext, TUIElement } from "../../TUIDom/TUIElement.ts";

import type { EmbeddedTerminalSession } from "./EmbeddedTerminalSession.ts";
import { encodeKeyForPty } from "./encodeKeyForPty.ts";
import { xtermPaletteToRgb } from "./xtermPalette.ts";

// xterm CoreMouseButton / CoreMouseAction (значения enum-ов).
const CORE_BUTTON: Record<string, number> = { left: 0, middle: 1, right: 2, none: 3 };
const WHEEL_BUTTON = 4;
const ACTION_UP = 0;
const ACTION_DOWN = 1;
const ACTION_MOVE = 4;
const WHEEL_ACTION: Record<string, number> = { up: 0, down: 1, left: 2, right: 3 };

export class TerminalViewElement extends TUIElement {
    private readonly session: EmbeddedTerminalSession;
    // Переиспользуемая ячейка — getCell(x, cell) не аллоцирует новый объект на каждую ячейку.
    private cellBuffer: IBufferCell | undefined;

    public constructor(session: EmbeddedTerminalSession) {
        super();
        this.session = session;
        this.tabIndex = 0; // фокусируемый — принимает клавиатуру
        this.capturesPointer = true; // drag: move/up приходят сюда даже вне границ
        // Новые данные из шелла → перерисовать контрол (TuiApplication батчит кадр).
        this.session.onUpdate(() => {
            this.markDirty();
        });

        // Мышь → внутренний mouse-энкодер эмулятора (сам решает по активному режиму).
        this.addEventListener("mousedown", (event) => {
            this.forwardMouse(event as TUIMouseEvent, ACTION_DOWN);
        });
        this.addEventListener("mouseup", (event) => {
            this.forwardMouse(event as TUIMouseEvent, ACTION_UP);
        });
        this.addEventListener("mousemove", (event) => {
            this.forwardMouse(event as TUIMouseEvent, ACTION_MOVE);
        });
        this.addEventListener("wheel", (event) => {
            const mouse = event as TUIMouseEvent;
            const action = WHEEL_ACTION[mouse.wheelDirection ?? "up"] ?? ACTION_UP;
            this.sendMouse(mouse, WHEEL_BUTTON, action);
        });
    }

    private forwardMouse(event: TUIMouseEvent, action: number): void {
        this.sendMouse(event, CORE_BUTTON[event.button] ?? 3, action);
    }

    private sendMouse(event: TUIMouseEvent, button: number, action: number): void {
        this.session.sendMouse({
            col: event.localX,
            row: event.localY,
            button,
            action,
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
        });
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = super.performLayout(constraints);
        // Держим PTY и эмулятор ровно по выделенной области (TIOCSWINSZ+SIGWINCH).
        this.session.resize(size.width, size.height);
        return size;
    }

    public override render(context: RenderContext): void {
        const width = this.layoutSize.width;
        const height = this.layoutSize.height;
        const buffer = this.session.terminal.buffer.active;

        for (let y = 0; y < height; y++) {
            const line = buffer.getLine(buffer.baseY + y);
            let x = 0;
            while (x < width) {
                const cell = line?.getCell(x, this.cellBuffer);
                if (cell) this.cellBuffer = cell;
                if (!cell) {
                    context.setCell(x, y, { char: " " });
                    x++;
                    continue;
                }
                const cellWidth = cell.getWidth();
                if (cellWidth === 0) {
                    // Продолжение wide-char: голова уже нарисована с width=2 — пропускаем.
                    x++;
                    continue;
                }
                const chars = cell.getChars();
                context.setCell(x, y, {
                    char: chars.length > 0 ? chars : " ",
                    fg: resolveFg(cell),
                    bg: resolveBg(cell),
                    style: resolveStyle(cell),
                    width: cellWidth,
                });
                x += cellWidth;
            }
        }

        // Курсор PTY показываем только когда контрол в фокусе.
        if (this.isFocused && !this.session.isExited) {
            const cx = buffer.cursorX;
            const cy = buffer.cursorY;
            if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
                context.setCursorPosition(cx, cy);
            }
        }
    }

    protected override performDefaultAction(event: TUIEventBase): void {
        if (event.type === "paste") {
            event.preventDefault();
            this.session.write((event as TUIPasteEvent).text);
            return;
        }
        if (event.type !== "keydown") return;
        const bytes = encodeKeyForPty(event as TUIKeyboardEvent);
        if (bytes !== "") {
            event.preventDefault();
            this.session.write(bytes);
        }
    }
}

function resolveFg(cell: IBufferCell): number {
    if (cell.isFgDefault()) return DEFAULT_COLOR;
    if (cell.isFgRGB()) return cell.getFgColor(); // уже 0xRRGGBB
    return xtermPaletteToRgb(cell.getFgColor()); // palette-индекс
}

function resolveBg(cell: IBufferCell): number {
    if (cell.isBgDefault()) return DEFAULT_COLOR;
    if (cell.isBgRGB()) return cell.getBgColor();
    return xtermPaletteToRgb(cell.getBgColor());
}

function resolveStyle(cell: IBufferCell): number {
    let style = StyleFlags.None;
    if (cell.isBold()) style |= StyleFlags.Bold;
    if (cell.isItalic()) style |= StyleFlags.Italic;
    if (cell.isUnderline()) style |= StyleFlags.Underline;
    if (cell.isDim()) style |= StyleFlags.Dim;
    if (cell.isInverse()) style |= StyleFlags.Inverse;
    if (cell.isStrikethrough()) style |= StyleFlags.Strikethrough;
    return style;
}
