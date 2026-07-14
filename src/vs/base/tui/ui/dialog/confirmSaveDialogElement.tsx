import { BoxConstraints, Size } from "../../../common/geometry.ts";
import { packRgb } from "../../../../tui/rendering/colorUtils.ts";
import type { WorkbenchTheme } from "../../../../workbench/services/themes/common/workbenchTheme.ts";
import { CompositeElement } from "../../compositeElement.ts";
import { TUIKeyboardEvent } from "../../events/tuiKeyboardEvent.ts";
import type { JsxNode } from "../../jsx/jsx-runtime.ts";

import { BoxContainer } from "../box/boxContainerElement.ts";
import { ButtonElement } from "../button/buttonElement.ts";
import { HFlex, hflexFill, hflexFit, hflexFixed } from "../layout/hFlexElement.ts";
import { PaddingContainer } from "../layout/paddingContainerElement.ts";
import type { StyledChar } from "../text/textLabelElement.ts";
import { TextLabel } from "../text/textLabelElement.ts";
import { VStack } from "../layout/vStackElement.ts";

const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const BORDER_FG = packRgb(80, 80, 80);
const TITLE_FG = packRgb(230, 230, 230);
const WARN_FG = packRgb(255, 200, 0);
const INFO_FG = packRgb(100, 130, 200);

// "! " — the "!" is at index 0
const WARNING_CHAR_STYLES = new Map<number, StyledChar>([[0, { fg: WARN_FG }]]);

// Width of the longest static text line: "   Your changes will be lost if you don't save"
const STATIC_TEXT_MIN_WIDTH = 46;
// "Don't Save"=14, "Cancel"=10, "Save"=8, two spacers=4 → total=36
const BUTTONS_TOTAL_WIDTH = 14 + 2 + 10 + 2 + 8;
const MAX_INNER_WIDTH = 70;
const MAX_FILENAME_DISPLAY = MAX_INNER_WIDTH - 4; // -3 for "   " prefix, -1 for "?" suffix

export class ConfirmSaveDialogElement extends CompositeElement {
    public onSave?: () => void;
    public onDontSave?: () => void;
    public onCancel?: () => void;

    private filename: string;

    private readonly dontSaveButton: ButtonElement;
    private readonly cancelButton: ButtonElement;
    private readonly saveButton: ButtonElement;

    public constructor(filename: string) {
        super();
        this.filename = filename;

        this.dontSaveButton = new ButtonElement("Don't Save");
        this.cancelButton = new ButtonElement("Cancel");
        this.saveButton = new ButtonElement("Save");

        this.dontSaveButton.onActivate = () => this.onDontSave?.();
        this.cancelButton.onActivate = () => this.onCancel?.();
        this.saveButton.onActivate = () => this.onSave?.();

        this.dontSaveButton.layoutStyle = { width: hflexFit(), height: 1 };
        this.cancelButton.layoutStyle = { width: hflexFit(), height: 1 };
        this.saveButton.layoutStyle = { width: hflexFit(), height: 1 };

        this.addEventListener("keydown", (event) => {
            this.handleDialogKeydown(event);
        });

        this.rebuild();
    }

    public setFilename(filename: string): void {
        this.filename = filename;
        this.rebuild();
    }

    /**
     * Push button colors from the active theme. The focused (default) button maps to the
     * VS Code "primary" button, the rest to the "secondary" button. The `button.*` tokens
     * are guaranteed by the default color registry, so no inline fallback is needed.
     */
    public applyTheme(theme: WorkbenchTheme): void {
        for (const button of [this.dontSaveButton, this.cancelButton, this.saveButton]) {
            button.focusedBg = theme.getRequiredColor("button.background");
            button.focusedFg = theme.getRequiredColor("button.foreground");
            button.focusedHoverBg = theme.getRequiredColor("button.hoverBackground");
            button.normalBg = theme.getRequiredColor("button.secondaryBackground");
            button.normalFg = theme.getRequiredColor("button.secondaryForeground");
            button.normalHoverBg = theme.getRequiredColor("button.secondaryHoverBackground");
            button.markDirty();
        }
    }

    public focusDefault(): void {
        this.saveButton.focus();
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const w = this.getMaxIntrinsicWidth(0);
        const h = this.getMaxIntrinsicHeight(w);
        const resultSize = constraints.constrain(new Size(w, h));
        super.performLayout(BoxConstraints.tight(resultSize));
        return resultSize;
    }

    protected describe(): JsxNode {
        const filenameDisplay =
            this.filename.length > MAX_FILENAME_DISPLAY
                ? "..." + this.filename.slice(-(MAX_FILENAME_DISPLAY - 3))
                : this.filename;
        const filenameRowWidth = 3 + filenameDisplay.length + 1;
        const naturalInnerWidth = Math.max(STATIC_TEXT_MIN_WIDTH, filenameRowWidth);
        const buttonsLeftPad = Math.floor((naturalInnerWidth - BUTTONS_TOTAL_WIDTH) / 2);
        const filenameText = "   " + filenameDisplay + "?";

        return (
            <BoxContainer
                bg={BG}
                fg={FG}
                borderFg={BORDER_FG}
                title="Visual Studio Code"
                titleFg={TITLE_FG}
                hasSeparator
            >
                <PaddingContainer left={2} right={2} bg={BG}>
                    <VStack>
                        <TextLabel
                            text="! Do you want to save the changes you made to"
                            fg={FG}
                            bg={BG}
                            charStyles={WARNING_CHAR_STYLES}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel text={filenameText} fg={FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel text="" fg={FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel
                            text="   Your changes will be lost if you don't save"
                            fg={INFO_FG}
                            bg={BG}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel text="   them." fg={INFO_FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel text="" fg={FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <HFlex layout={{ width: "stretch", height: 1 }}>
                            <TextLabel
                                text=""
                                fg={FG}
                                bg={BG}
                                layout={{ width: hflexFixed(buttonsLeftPad), height: 1 }}
                            />
                            {this.dontSaveButton}
                            <TextLabel text="  " fg={FG} bg={BG} layout={{ width: hflexFixed(2), height: 1 }} />
                            {this.cancelButton}
                            <TextLabel text="  " fg={FG} bg={BG} layout={{ width: hflexFixed(2), height: 1 }} />
                            {this.saveButton}
                            <TextLabel text="" fg={FG} bg={BG} layout={{ width: hflexFill(), height: 1 }} />
                        </HFlex>
                    </VStack>
                </PaddingContainer>
            </BoxContainer>
        );
    }

    private handleDialogKeydown(event: TUIKeyboardEvent): void {
        const keyEvent = event;

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
