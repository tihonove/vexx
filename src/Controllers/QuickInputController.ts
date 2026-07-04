import { Disposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import type { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/OverlayLayer.ts";
import { QuickPickElement } from "../TUIDom/Widgets/QuickPickElement.ts";

/**
 * Options for a single-line text prompt, mirroring VS Code's `showInputBox`.
 */
export interface InputBoxOptions {
    /** Title drawn in the overlay's top border. */
    title?: string;
    /** Subtitle drawn under the input (dim), e.g. an instruction. */
    prompt?: string;
    /** Ghost text shown when the field is empty. */
    placeholder?: string;
    /** Initial value; the cursor is seeded at the end. */
    value?: string;
    /**
     * Synchronous validation. Return a message to mark the value invalid (Enter
     * is blocked and the message is shown); return null when the value is OK.
     */
    validateInput?: (value: string) => string | null;
}

/**
 * VS Code-style QuickInput service (the reusable "enter a value" control).
 *
 * Owns ONE reusable {@link QuickPickElement} hosted in a single overlay session,
 * mirroring {@link import("./QuickOpenController.ts").QuickOpenController}. Only
 * one quick-input is ever active at a time; a new call cancels any previous one.
 *
 * Currently exposes the InputBox flavor (`input()`). The list-pick and
 * file-dialog flavors reuse the same widget/session and are future additions.
 */
export class QuickInputController extends Disposable {
    public readonly view: QuickPickElement;

    private hostBody: BodyElement | null = null;
    private session: OverlaySessionHandle | null = null;
    private pendingResolve: ((value: string | undefined) => void) | null = null;

    public constructor() {
        super();
        this.view = new QuickPickElement();
        this.view.onCancel = () => {
            this.settle(undefined);
        };
        this.view.onAcceptValue = (value) => {
            // The widget already blocks Enter on a hard validation error.
            // Defer to a microtask (like QuickOpenController): closing the session here
            // restores focus to the editor, and doing that synchronously mid-keypress would
            // let the trailing key event of the same Enter land in the now-focused editor.
            queueMicrotask(() => {
                this.settle(value);
            });
        };
    }

    public setHostView(body: BodyElement): void {
        this.hostBody = body;
        this.session = body.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            closeOnEscape: true,
            pointerPolicy: "close-on-outside",
            onClose: () => {
                // Outside click / Escape / programmatic close all resolve as cancelled.
                this.settle(undefined);
            },
        });

        this.register({
            dispose: () => {
                this.session?.dispose();
                this.session = null;
            },
        });
    }

    /**
     * Prompt the user for a single line of text. Resolves with the entered value
     * on Enter, or `undefined` if the prompt is dismissed (Escape / outside
     * click / superseded by another call).
     */
    public input(opts: InputBoxOptions = {}): Promise<string | undefined> {
        // A previous prompt still open? Cancel it before starting a new one.
        this.settle(undefined);

        return new Promise<string | undefined>((resolve) => {
            this.pendingResolve = resolve;

            const view = this.view;
            view.acceptMode = "value";
            view.items = [];
            view.title = opts.title;
            view.prompt = opts.prompt;
            view.placeholder = opts.placeholder ?? "";
            view.validationSeverity = "error";

            const validate = opts.validateInput;
            view.onQueryChange = (query) => {
                view.validationMessage = validate ? (validate(query) ?? null) : null;
                view.markDirty();
            };

            view.setQuery(opts.value ?? "");
            // Seed the validation state for the initial value.
            view.validationMessage = validate ? (validate(view.getQuery()) ?? null) : null;

            this.updatePosition();
            this.session?.open();
            view.focus();
        });
    }

    /** Resolve the pending promise exactly once and close the overlay. */
    private settle(value: string | undefined): void {
        const resolve = this.pendingResolve;
        if (resolve === null) return;
        this.pendingResolve = null;
        if (this.session?.isOpen()) {
            this.session.close();
        }
        resolve(value);
    }

    private updatePosition(): void {
        if (!this.hostBody) return;

        const screenW = this.hostBody.layoutSize.width;
        const screenH = this.hostBody.layoutSize.height;

        const width = Math.min(80, Math.max(40, screenW - 4));
        const px = Math.max(0, Math.floor((screenW - width) / 2));
        const py = Math.max(1, Math.floor(screenH * 0.1));

        this.view.preferredWidth = width;
        this.session?.setPosition(new Point(px, py));
    }
}
