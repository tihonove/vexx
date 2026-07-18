import type { ThemeService } from "../../../Theme/ThemeService.ts";
import type { JsxNode } from "../../../TUIDom/JSX/jsx-runtime.ts";
import { BoxContainer } from "../../../TUIDom/Widgets/BoxContainerElement.ts";
import { ButtonElement } from "../../../TUIDom/Widgets/ButtonElement.ts";
import { HFlex, hflexFill, hflexFit, hflexFixed } from "../../../TUIDom/Widgets/HFlexElement.ts";
import { PaddingContainer } from "../../../TUIDom/Widgets/PaddingContainerElement.ts";
import type { StyledChar } from "../../../TUIDom/Widgets/TextLabelElement.ts";
import { TextLabel } from "../../../TUIDom/Widgets/TextLabelElement.ts";
import { VStack } from "../../../TUIDom/Widgets/VStackElement.ts";

import type { IDialogStyles } from "./DialogComponent.ts";
import { DialogComponent } from "./DialogComponent.ts";

// Width of the longest static text line: "   Your changes will be lost if you don't save"
const STATIC_TEXT_MIN_WIDTH = 46;
// "Don't Save"=14, "Cancel"=10, "Save"=8, two spacers=4 → total=36
const BUTTONS_TOTAL_WIDTH = 14 + 2 + 10 + 2 + 8;
const MAX_INNER_WIDTH = 70;
const MAX_FILENAME_DISPLAY = MAX_INNER_WIDTH - 4; // -3 for "   " prefix, -1 for "?" suffix

/**
 * Диалог «сохранить изменения?». Компонент: сервисы в конструктор, view —
 * дерево контролов; цвета — только из активной темы. Живёт один экземпляр
 * на приложение — `DialogService` переиспользует его через {@link setFilename}.
 */
export class ConfirmSaveDialog extends DialogComponent {
    public onSave?: () => void;
    public onDontSave?: () => void;
    public onCancel?: () => void;

    private filename: string;

    private readonly dontSaveButton: ButtonElement;
    private readonly cancelButton: ButtonElement;
    private readonly saveButton: ButtonElement;

    public constructor(themeService: ThemeService, filename: string) {
        super(themeService, "confirmSaveDialog");
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
        this.initStyles();
    }

    public setFilename(filename: string): void {
        this.filename = filename;
        this.rebuild();
    }

    public focusDefault(): void {
        this.saveButton.focus();
    }

    protected override rowButtons(): readonly ButtonElement[] {
        return [this.dontSaveButton, this.cancelButton, this.saveButton];
    }

    protected override onDismiss(): void {
        this.onCancel?.();
    }

    protected override describe(styles: IDialogStyles): JsxNode {
        const { bg, fg } = styles;
        // "! " — the "!" is at index 0
        const warningCharStyles = new Map<number, StyledChar>([[0, { fg: styles.warningFg }]]);

        const filenameDisplay =
            this.filename.length > MAX_FILENAME_DISPLAY
                ? "..." + this.filename.slice(-(MAX_FILENAME_DISPLAY - 3))
                : this.filename;
        const filenameRowWidth = 3 + filenameDisplay.length + 1;
        const naturalInnerWidth = Math.max(STATIC_TEXT_MIN_WIDTH, filenameRowWidth);
        const buttonsLeftPad = Math.floor((naturalInnerWidth - BUTTONS_TOTAL_WIDTH) / 2);
        const filenameText = "   " + filenameDisplay + "?";

        return (
            <BoxContainer bg={bg} fg={fg} borderFg={styles.borderFg} title="Visual Studio Code" titleFg={fg} hasSeparator>
                <PaddingContainer left={2} right={2} bg={bg}>
                    <VStack>
                        <TextLabel
                            text="! Do you want to save the changes you made to"
                            fg={fg}
                            bg={bg}
                            charStyles={warningCharStyles}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel text={filenameText} fg={fg} bg={bg} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel text="" fg={fg} bg={bg} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel
                            text="   Your changes will be lost if you don't save"
                            fg={styles.descriptionFg}
                            bg={bg}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel
                            text="   them."
                            fg={styles.descriptionFg}
                            bg={bg}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel text="" fg={fg} bg={bg} layout={{ width: "stretch", height: 1 }} />
                        <HFlex layout={{ width: "stretch", height: 1 }}>
                            <TextLabel
                                text=""
                                fg={fg}
                                bg={bg}
                                layout={{ width: hflexFixed(buttonsLeftPad), height: 1 }}
                            />
                            {this.dontSaveButton}
                            <TextLabel text="  " fg={fg} bg={bg} layout={{ width: hflexFixed(2), height: 1 }} />
                            {this.cancelButton}
                            <TextLabel text="  " fg={fg} bg={bg} layout={{ width: hflexFixed(2), height: 1 }} />
                            {this.saveButton}
                            <TextLabel text="" fg={fg} bg={bg} layout={{ width: hflexFill(), height: 1 }} />
                        </HFlex>
                    </VStack>
                </PaddingContainer>
            </BoxContainer>
        );
    }
}
