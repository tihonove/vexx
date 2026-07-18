import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { APP_NAME, REPO_URL, VEXX_VERSION } from "../../Common/Version.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import { CompositeElement } from "../CompositeElement.ts";
import { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import type { JsxNode } from "../JSX/jsx-runtime.ts";

import { BoxContainer } from "./BoxContainerElement.ts";
import type { IButtonStyles } from "./ButtonElement.ts";
import { ButtonElement, unthemedButtonStyles } from "./ButtonElement.ts";
import { HFlex, hflexFill, hflexFit } from "./HFlexElement.ts";
import { PaddingContainer } from "./PaddingContainerElement.ts";
import { TextLabel } from "./TextLabelElement.ts";
import { VStack } from "./VStackElement.ts";

const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const BORDER_FG = packRgb(80, 80, 80);
const TITLE_FG = packRgb(230, 230, 230);
const NAME_FG = packRgb(230, 230, 230);
const LINK_FG = packRgb(100, 130, 200);

export interface IAboutDialogStyles {
    readonly button: IButtonStyles;
}

export const unthemedAboutDialogStyles: IAboutDialogStyles = { button: unthemedButtonStyles };

export class AboutDialogElement extends CompositeElement {
    public onClose?: () => void;

    private readonly okButton: ButtonElement;

    public constructor() {
        super();

        this.okButton = new ButtonElement("OK");
        this.okButton.onActivate = () => this.onClose?.();
        this.okButton.layoutStyle = { width: hflexFit(), height: 1 };

        this.addEventListener("keydown", (event) => {
            this.handleDialogKeydown(event);
        });

        this.rebuild();
    }

    public setStyles(styles: IAboutDialogStyles): void {
        this.okButton.setStyles(styles.button);
    }

    public focusDefault(): void {
        this.okButton.focus();
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const w = this.getMaxIntrinsicWidth(0);
        const h = this.getMaxIntrinsicHeight(w);
        const resultSize = constraints.constrain(new Size(w, h));
        super.performLayout(BoxConstraints.tight(resultSize));
        return resultSize;
    }

    protected describe(): JsxNode {
        return (
            <BoxContainer bg={BG} fg={FG} borderFg={BORDER_FG} title={APP_NAME} titleFg={TITLE_FG} hasSeparator>
                <PaddingContainer left={2} right={2} bg={BG}>
                    <VStack>
                        <TextLabel text={APP_NAME} fg={NAME_FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel
                            text={`Version ${VEXX_VERSION}`}
                            fg={FG}
                            bg={BG}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel
                            text={`Node ${process.version}`}
                            fg={FG}
                            bg={BG}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel text={REPO_URL} fg={LINK_FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel text="" fg={FG} bg={BG} layout={{ width: "stretch", height: 1 }} />
                        <HFlex layout={{ width: "stretch", height: 1 }}>
                            <TextLabel text="" fg={FG} bg={BG} layout={{ width: hflexFill(), height: 1 }} />
                            {this.okButton}
                        </HFlex>
                    </VStack>
                </PaddingContainer>
            </BoxContainer>
        );
    }

    private handleDialogKeydown(event: TUIKeyboardEvent): void {
        if (event.key === "Escape") {
            event.preventDefault();
            this.onClose?.();
        }
    }
}
