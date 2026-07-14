import { BoxConstraints, Size } from "../../../common/geometry.ts";
import { APP_NAME, REPO_URL, VEXX_VERSION } from "../../../../platform/product/common/product.ts";
import { packRgb } from "../../../../tui/rendering/colorUtils.ts";
import type { WorkbenchTheme } from "../../../../workbench/services/themes/common/workbenchTheme.ts";
import { CompositeElement } from "../../compositeElement.ts";
import { TUIKeyboardEvent } from "../../events/tuiKeyboardEvent.ts";
import type { JsxNode } from "../../jsx/jsx-runtime.ts";

import { BoxContainer } from "../box/boxContainerElement.ts";
import { ButtonElement } from "../button/buttonElement.ts";
import { HFlex, hflexFill, hflexFit } from "../layout/hFlexElement.ts";
import { PaddingContainer } from "../layout/paddingContainerElement.ts";
import { TextLabel } from "../text/textLabelElement.ts";
import { VStack } from "../layout/vStackElement.ts";

const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const BORDER_FG = packRgb(80, 80, 80);
const TITLE_FG = packRgb(230, 230, 230);
const NAME_FG = packRgb(230, 230, 230);
const LINK_FG = packRgb(100, 130, 200);

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

    /** Push button colors from the active theme (mirrors ConfirmSaveDialogElement). */
    public applyTheme(theme: WorkbenchTheme): void {
        this.okButton.focusedBg = theme.getRequiredColor("button.background");
        this.okButton.focusedFg = theme.getRequiredColor("button.foreground");
        this.okButton.focusedHoverBg = theme.getRequiredColor("button.hoverBackground");
        this.okButton.normalBg = theme.getRequiredColor("button.secondaryBackground");
        this.okButton.normalFg = theme.getRequiredColor("button.secondaryForeground");
        this.okButton.normalHoverBg = theme.getRequiredColor("button.secondaryHoverBackground");
        this.okButton.markDirty();
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
