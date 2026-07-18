import { APP_NAME, REPO_URL, VEXX_VERSION } from "../../../Common/Version.ts";
import type { ThemeService } from "../../../Theme/ThemeService.ts";
import type { JsxNode } from "../../../TUIDom/JSX/jsx-runtime.ts";
import { BoxContainer } from "../../../TUIDom/Widgets/BoxContainerElement.ts";
import { ButtonElement } from "../../../TUIDom/Widgets/ButtonElement.ts";
import { HFlex, hflexFill, hflexFit } from "../../../TUIDom/Widgets/HFlexElement.ts";
import { PaddingContainer } from "../../../TUIDom/Widgets/PaddingContainerElement.ts";
import { TextLabel } from "../../../TUIDom/Widgets/TextLabelElement.ts";
import { VStack } from "../../../TUIDom/Widgets/VStackElement.ts";

import type { IDialogStyles } from "./DialogComponent.ts";
import { DialogComponent } from "./DialogComponent.ts";

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
                        <TextLabel text={REPO_URL} fg={styles.linkFg} bg={bg} layout={{ width: "stretch", height: 1 }} />
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
