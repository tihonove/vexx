import { BoxConstraints, Size } from "../../Common/GeometryPromitives.ts";
import { packRgb } from "../../Rendering/ColorUtils.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { CompositeElement } from "../CompositeElement.ts";
import type { TUIKeyboardEvent } from "../Events/TUIKeyboardEvent.ts";
import type { JsxNode } from "../JSX/jsx-runtime.ts";

import { BoxContainer } from "./BoxContainerElement.ts";
import { ButtonElement } from "./ButtonElement.ts";
import { HFlex, hflexFill, hflexFit, hflexFixed } from "./HFlexElement.ts";
import { PaddingContainer } from "./PaddingContainerElement.ts";
import { TextLabel } from "./TextLabelElement.ts";
import { VStack } from "./VStackElement.ts";

const BG = packRgb(37, 37, 38);
const FG = packRgb(204, 204, 204);
const BORDER_FG = packRgb(80, 80, 80);
const TITLE_FG = packRgb(230, 230, 230);
const WARN_FG = packRgb(255, 200, 0);

const MAX_INNER_WIDTH = 70;
const MIN_INNER_WIDTH = 40;

export interface ConfirmDialogOptions {
    readonly title: string;
    /** Текст вопроса — одна или несколько строк. */
    readonly message: string | readonly string[];
    readonly confirmLabel: string;
    readonly cancelLabel?: string;
    /** Подсветить сообщение как предупреждение (жёлтым) — для необратимых действий. */
    readonly warning?: boolean;
    /** Какая кнопка в фокусе по умолчанию. По умолчанию — Cancel (безопаснее). */
    readonly defaultButton?: "confirm" | "cancel";
}

/**
 * Универсальный модальный диалог подтверждения (заголовок + текст + Confirm/Cancel).
 * Ответ — через callback-поля `onConfirm`/`onCancel`; Esc = отмена. По образцу
 * `ConfirmSaveDialogElement`, открывается через `overlayLayer.createSession`. Под разные
 * вопросы создаётся новый экземпляр (метки кнопок неизменяемы).
 */
export class ConfirmDialogElement extends CompositeElement {
    public onConfirm?: () => void;
    public onCancel?: () => void;

    private readonly options: ConfirmDialogOptions;
    private readonly confirmButton: ButtonElement;
    private readonly cancelButton: ButtonElement;

    public constructor(options: ConfirmDialogOptions) {
        super();
        this.options = options;
        this.confirmButton = new ButtonElement(options.confirmLabel);
        this.cancelButton = new ButtonElement(options.cancelLabel ?? "Cancel");
        this.confirmButton.onActivate = () => this.onConfirm?.();
        this.cancelButton.onActivate = () => this.onCancel?.();
        this.confirmButton.layoutStyle = { width: hflexFit(), height: 1 };
        this.cancelButton.layoutStyle = { width: hflexFit(), height: 1 };

        this.addEventListener("keydown", (event) => {
            this.handleDialogKeydown(event);
        });

        this.rebuild();
    }

    public applyTheme(theme: WorkbenchTheme): void {
        for (const button of [this.confirmButton, this.cancelButton]) {
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
        if (this.options.defaultButton === "confirm") {
            this.confirmButton.focus();
        } else {
            this.cancelButton.focus();
        }
    }

    public override performLayout(constraints: BoxConstraints): Size {
        const w = this.getMaxIntrinsicWidth(0);
        const h = this.getMaxIntrinsicHeight(w);
        const resultSize = constraints.constrain(new Size(w, h));
        super.performLayout(BoxConstraints.tight(resultSize));
        return resultSize;
    }

    protected describe(): JsxNode {
        const lines = typeof this.options.message === "string" ? [this.options.message] : this.options.message;
        const maxLine = Math.max(...lines.map((l) => l.length + 3));
        const confirmWidth = this.options.confirmLabel.length + 4;
        const cancelWidth = (this.options.cancelLabel ?? "Cancel").length + 4;
        const buttonsWidth = confirmWidth + 2 + cancelWidth;
        const innerWidth = Math.min(MAX_INNER_WIDTH, Math.max(MIN_INNER_WIDTH, maxLine, buttonsWidth));
        const buttonsLeftPad = Math.max(0, Math.floor((innerWidth - buttonsWidth) / 2));
        const messageFg = this.options.warning ? WARN_FG : FG;

        // Дети VStack собираем в один массив: reconcile уплощает массив-выражение, поэтому
        // строки из .map можно безопасно смешивать со спейсером и рядом кнопок.
        const children: JsxNode[] = [
            ...lines.map((line) => (
                <TextLabel text={"  " + line} fg={messageFg} bg={BG} layout={{ width: "stretch", height: 1 }} />
            )),
            <TextLabel text="" fg={FG} bg={BG} layout={{ width: "stretch", height: 1 }} />,
            <HFlex layout={{ width: "stretch", height: 1 }}>
                <TextLabel text="" fg={FG} bg={BG} layout={{ width: hflexFixed(buttonsLeftPad), height: 1 }} />
                {this.confirmButton}
                <TextLabel text="  " fg={FG} bg={BG} layout={{ width: hflexFixed(2), height: 1 }} />
                {this.cancelButton}
                <TextLabel text="" fg={FG} bg={BG} layout={{ width: hflexFill(), height: 1 }} />
            </HFlex>,
        ];

        return (
            <BoxContainer
                bg={BG}
                fg={FG}
                borderFg={BORDER_FG}
                title={this.options.title}
                titleFg={TITLE_FG}
                hasSeparator
            >
                <PaddingContainer left={2} right={2} bg={BG}>
                    <VStack>{children}</VStack>
                </PaddingContainer>
            </BoxContainer>
        );
    }

    private handleDialogKeydown(event: TUIKeyboardEvent): void {
        const buttons = [this.confirmButton, this.cancelButton];
        const focusedIndex = buttons.findIndex((b) => b.isFocused);
        switch (event.key) {
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
