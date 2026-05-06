import { BoxConstraints, Offset, Point, Rect, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { TUIEventBase } from "../Events/TUIEventBase.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIElement.ts";

import { ButtonElement } from "./ButtonElement.ts";
import { HFlexElement, hflexFixed, hflexFit } from "./HFlexElement.ts";
import { TextLabelElement } from "./TextLabelElement.ts";

export const CONFIRM_SAVE_DIALOG_WIDTH = 56;
export const CONFIRM_SAVE_DIALOG_HEIGHT = 12;

const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const BORDER_FG = packRgb(80, 80, 80);
const TITLE_FG = packRgb(230, 230, 230);
const WARN_FG = packRgb(255, 200, 0);
const INFO_FG = packRgb(100, 130, 200);

const INNER_WIDTH = CONFIRM_SAVE_DIALOG_WIDTH - 2;

function makeTextLabel(text: string, fg: number): TextLabelElement {
    const el = new TextLabelElement(text);
    el.setColors(fg, BG);
    return el;
}

export class ConfirmSaveDialogElement extends TUIElement {
    public onSave?: () => void;
    public onDontSave?: () => void;
    public onCancel?: () => void;

    private filename: string;

    private readonly warningLabel: TextLabelElement;
    private readonly filenameLabel: TextLabelElement;
    private readonly infoLabel1: TextLabelElement;
    private readonly infoLabel2: TextLabelElement;
    private readonly dontSaveButton: ButtonElement;
    private readonly cancelButton: ButtonElement;
    private readonly saveButton: ButtonElement;
    private readonly buttonsHFlex: HFlexElement;

    private readonly textChildren: TUIElement[];

    public constructor(filename: string) {
        super();
        this.filename = filename;

        this.warningLabel = makeTextLabel("  ! Do you want to save the changes you made to", FG);
        this.warningLabel.setCharStyle(2, { fg: WARN_FG });

        this.filenameLabel = makeTextLabel(this.buildFilenameText(), FG);
        this.infoLabel1 = makeTextLabel("     Your changes will be lost if you don't save", INFO_FG);
        this.infoLabel2 = makeTextLabel("     them.", INFO_FG);

        this.dontSaveButton = new ButtonElement("Don't Save");
        this.cancelButton = new ButtonElement("Cancel");
        this.saveButton = new ButtonElement("Save");

        this.dontSaveButton.onActivate = () => this.onDontSave?.();
        this.cancelButton.onActivate = () => this.onCancel?.();
        this.saveButton.onActivate = () => this.onSave?.();

        this.buttonsHFlex = new HFlexElement();
        this.buttonsHFlex.addChild(this.dontSaveButton, { width: hflexFit(), height: 1 });
        const spacer1 = makeTextLabel("  ", FG);
        this.buttonsHFlex.addChild(spacer1, { width: hflexFixed(2), height: 1 });
        this.buttonsHFlex.addChild(this.cancelButton, { width: hflexFit(), height: 1 });
        const spacer2 = makeTextLabel("  ", FG);
        this.buttonsHFlex.addChild(spacer2, { width: hflexFixed(2), height: 1 });
        this.buttonsHFlex.addChild(this.saveButton, { width: hflexFit(), height: 1 });

        this.textChildren = [this.warningLabel, this.filenameLabel, this.infoLabel1, this.infoLabel2];

        for (const child of [...this.textChildren, this.buttonsHFlex]) {
            child.setParent(this);
        }

        this.addEventListener("keydown", (event) => {
            this.handleDialogKeydown(event);
        });
    }

    public setFilename(filename: string): void {
        this.filename = filename;
        this.filenameLabel.setText(this.buildFilenameText());
        this.markDirty();
    }

    public focusDefault(): void {
        this.saveButton.focus();
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return CONFIRM_SAVE_DIALOG_WIDTH;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return CONFIRM_SAVE_DIALOG_WIDTH;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return CONFIRM_SAVE_DIALOG_HEIGHT;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return CONFIRM_SAVE_DIALOG_HEIGHT;
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const size = super.performLayout(
            BoxConstraints.tight(new Size(CONFIRM_SAVE_DIALOG_WIDTH, CONFIRM_SAVE_DIALOG_HEIGHT)),
        );

        const textPositions: [number, number][] = [
            [1, 4],
            [1, 5],
            [1, 7],
            [1, 8],
        ];

        for (let i = 0; i < this.textChildren.length; i++) {
            const child = this.textChildren[i];
            const [x, y] = textPositions[i];
            child.localPosition = new Offset(x, y);
            child.globalPosition = new Point(this.globalPosition.x + x, this.globalPosition.y + y);
            child.performLayout(BoxConstraints.tight(new Size(INNER_WIDTH, 1)));
        }

        const btnsW = this.buttonsHFlex.getMinIntrinsicWidth(1);
        const btnX = 1 + Math.floor((INNER_WIDTH - btnsW) / 2);
        const btnY = CONFIRM_SAVE_DIALOG_HEIGHT - 2;
        this.buttonsHFlex.localPosition = new Offset(btnX, btnY);
        this.buttonsHFlex.globalPosition = new Point(this.globalPosition.x + btnX, this.globalPosition.y + btnY);
        this.buttonsHFlex.performLayout(BoxConstraints.tight(new Size(btnsW, 1)));

        return size;
    }

    public override getChildren(): readonly TUIElement[] {
        return [...this.textChildren, this.buttonsHFlex];
    }

    public override render(context: RenderContext): void {
        const w = CONFIRM_SAVE_DIALOG_WIDTH;
        const h = CONFIRM_SAVE_DIALOG_HEIGHT;

        // Fill background
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                context.setCell(x, y, { char: " ", fg: FG, bg: BG });
            }
        }

        // Top border
        context.setCell(0, 0, { char: "┌", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) context.setCell(x, 0, { char: "─", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 0, { char: "┐", fg: BORDER_FG, bg: BG });

        // Side borders
        for (let y = 1; y < h - 1; y++) {
            context.setCell(0, y, { char: "│", fg: BORDER_FG, bg: BG });
            context.setCell(w - 1, y, { char: "│", fg: BORDER_FG, bg: BG });
        }

        // Bottom border
        context.setCell(0, h - 1, { char: "└", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) context.setCell(x, h - 1, { char: "─", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, h - 1, { char: "┘", fg: BORDER_FG, bg: BG });

        // Title row (row 1)
        const title = "Visual Studio Code";
        const titleX = Math.floor((w - title.length) / 2);
        context.drawText(titleX, 1, title, { fg: TITLE_FG, bg: BG });

        // Separator (row 2)
        context.setCell(0, 2, { char: "├", fg: BORDER_FG, bg: BG });
        for (let x = 1; x < w - 1; x++) context.setCell(x, 2, { char: "─", fg: BORDER_FG, bg: BG });
        context.setCell(w - 1, 2, { char: "┤", fg: BORDER_FG, bg: BG });

        // Render children
        for (const child of this.getChildren()) {
            const childOffset = new Offset(child.localPosition.dx, child.localPosition.dy);
            const childClip = new Rect(child.globalPosition, child.layoutSize);
            child.render(context.withOffset(childOffset).withClip(childClip));
        }
    }

    private buildFilenameText(): string {
        const maxFilenameWidth = CONFIRM_SAVE_DIALOG_WIDTH - 7;
        const displayFilename =
            this.filename.length > maxFilenameWidth
                ? "..." + this.filename.slice(-(maxFilenameWidth - 3))
                : this.filename;
        return "     " + displayFilename + "?";
    }

    private handleDialogKeydown(event: TUIEventBase): void {
        if (event.type !== "keydown") return;
        const keyEvent = event as TUIKeyboardEvent;

        const buttons = [this.dontSaveButton, this.cancelButton, this.saveButton];
        const focusedIndex = buttons.findIndex((b) => b.isFocused);

        switch (keyEvent.key) {
            case "ArrowLeft":
                if (focusedIndex > 0) {
                    event.preventDefault();
                    buttons[focusedIndex - 1].focus();
                }
                break;
            case "ArrowRight":
                if (focusedIndex < buttons.length - 1) {
                    event.preventDefault();
                    buttons[focusedIndex + 1].focus();
                }
                break;
            case "Escape":
                event.preventDefault();
                this.onCancel?.();
                break;
        }
    }
}
