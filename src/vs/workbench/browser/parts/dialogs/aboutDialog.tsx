import { APP_NAME, REPO_URL, VEXX_VERSION } from "../../../../base/common/version.ts";
import type { ThemeService } from "../../../services/themes/common/themeService.ts";
import type { JsxNode } from "../../../../base/browser/jsx/jsx-runtime.ts";
import { BoxContainer } from "../../../../base/browser/ui/layout/boxContainerElement.ts";
import { ButtonElement } from "../../../../base/browser/ui/button/buttonElement.ts";
import { HFlex, hflexFill, hflexFit } from "../../../../base/browser/ui/layout/hFlexElement.ts";
import { PaddingContainer } from "../../../../base/browser/ui/layout/paddingContainerElement.ts";
import { TextLabel } from "../../../../base/browser/ui/text/textLabelElement.ts";
import { VStack } from "../../../../base/browser/ui/layout/vStackElement.ts";

import type { IDialogStyles } from "./dialogComponent.ts";
import { DialogComponent } from "./dialogComponent.ts";

/** Диалог «About»: имя, версия, Node, ссылка на репозиторий. */
export class AboutDialog extends DialogComponent {
    public onClose?: () => void;

    private readonly okButton: ButtonElement;

    public constructor(themeService: ThemeService) {
        super(themeService, "aboutDialog");

        this.okButton = new ButtonElement("OK");
        this.okButton.onActivate = () => this.onClose?.();
        this.okButton.layoutStyle = { width: hflexFit(), height: 1 };
        this.initStyles();
    }

    public focusDefault(): void {
        this.okButton.focus();
    }

    protected override rowButtons(): readonly ButtonElement[] {
        return [this.okButton];
    }

    protected override onDismiss(): void {
        this.onClose?.();
    }

    protected override describe(styles: IDialogStyles): JsxNode {
        const { bg, fg } = styles;
        return (
            <BoxContainer bg={bg} fg={fg} borderFg={styles.borderFg} title={APP_NAME} titleFg={fg} hasSeparator>
                <PaddingContainer left={2} right={2} bg={bg}>
                    <VStack>
                        <TextLabel text={APP_NAME} fg={fg} bg={bg} layout={{ width: "stretch", height: 1 }} />
                        <TextLabel
                            text={`Version ${VEXX_VERSION}`}
                            fg={fg}
                            bg={bg}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel
                            text={`Node ${process.version}`}
                            fg={fg}
                            bg={bg}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel
                            text={REPO_URL}
                            fg={styles.linkFg}
                            bg={bg}
                            layout={{ width: "stretch", height: 1 }}
                        />
                        <TextLabel text="" fg={fg} bg={bg} layout={{ width: "stretch", height: 1 }} />
                        <HFlex layout={{ width: "stretch", height: 1 }}>
                            <TextLabel text="" fg={fg} bg={bg} layout={{ width: hflexFill(), height: 1 }} />
                            {this.okButton}
                        </HFlex>
                    </VStack>
                </PaddingContainer>
            </BoxContainer>
        );
    }
}
