import { applyButtonTheme } from "../../Controllers/applyButtonTheme.ts";
import type { ThemeService } from "../../Theme/ThemeService.ts";
import type { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import type { TUIKeyboardEvent } from "../../TUIDom/Events/TUIKeyboardEvent.ts";
import type { JsxNode } from "../../TUIDom/JSX/jsx-runtime.ts";
import { reconcile } from "../../TUIDom/JSX/reconcile.ts";
import type { TUIElement } from "../../TUIDom/TUIElement.ts";
import type { ButtonElement } from "../../TUIDom/Widgets/ButtonElement.ts";
import { FitContentElement } from "../../TUIDom/Widgets/FitContentElement.ts";
import { Component } from "../Component.ts";

/**
 * База модальных диалогов Workbench. Диалог — компонент: он НЕ наследует
 * TUIElement, а владеет корневым контролом ({@link FitContentElement}) и
 * размещает в нём дерево примитивов, описанное JSX'ом в {@link describe}.
 *
 * База даёт трём диалогам общее поведение: reconcile-перестройку дерева,
 * покраску ряда кнопок из темы ({@link Component.applyStyles} → rebuild),
 * навигацию стрелками по ряду кнопок и Escape → {@link onDismiss}.
 */
export abstract class DialogComponent extends Component {
    public readonly view: FitContentElement;

    private rootChild: TUIElement | null = null;

    /**
     * `id` вешается на корневой контрол — это DOM-идентичность диалога для
     * `querySelector("#...")` (у компонента, в отличие от элемента, нет имени
     * класса в дереве).
     */
    protected constructor(themeService: ThemeService, id: string) {
        super(themeService);
        this.view = new FitContentElement();
        this.view.id = id;
        this.view.addEventListener("keydown", (event) => {
            this.handleDialogKeydown(event);
        });
    }

    /** JSX-дерево диалога; строится из контролов и уже созданных кнопок. */
    protected abstract describe(theme: WorkbenchTheme): JsxNode;

    /** Ряд кнопок слева направо — для навигации стрелками и покраски из темы. */
    protected abstract rowButtons(): readonly ButtonElement[];

    /** Реакция на Escape (обычно — отмена/закрытие). */
    protected abstract onDismiss(): void;

    /** Перестраивает дерево контролов под текущее состояние и тему. */
    protected rebuild(): void {
        this.rootChild = reconcile(this.rootChild, this.describe(this.themeService.theme));
        this.view.setChild(this.rootChild);
    }

    protected override applyStyles(theme: WorkbenchTheme): void {
        for (const button of this.rowButtons()) {
            applyButtonTheme(button, theme);
        }
        this.rebuild();
    }

    private handleDialogKeydown(event: TUIKeyboardEvent): void {
        const buttons = this.rowButtons();
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
                this.onDismiss();
                break;
        }
    }
}
