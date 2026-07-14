import { Disposable } from "../../../base/common/lifecycle.ts";
import { Point } from "../../../base/common/geometry.ts";
import type { BodyElement } from "../../../base/tui/bodyElement.ts";
import type { OverlaySessionHandle } from "../../../base/tui/ui/contextview/overlayLayer.ts";
import type { QuickPickItem } from "./quickPickElement.ts";
import { QuickPickElement } from "./quickPickElement.ts";

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
 * Options for a list pick, mirroring VS Code's `showQuickPick`.
 */
export interface QuickPickOptions {
    /** Title drawn in the overlay's top border. */
    title?: string;
    /** Ghost text shown when the query field is empty. */
    placeholder?: string;
    /** The items to choose from. Filtered live by their `label` as the user types. */
    items: readonly QuickPickItem[];
    /** Row to pre-highlight when the picker opens (clamped into range; default 0). */
    activeIndex?: number;
    /**
     * Fired as the highlighted item changes (open, arrow navigation, filtering) —
     * the hook behind live preview (e.g. applying a theme while browsing). Receives
     * `undefined` when the filtered list is empty.
     */
    onDidChangeActive?: (item: QuickPickItem | undefined, index: number) => void;
}

/**
 * VS Code-style QuickInput service (the reusable "enter a value" / "pick from a
 * list" control).
 *
 * Owns ONE reusable {@link QuickPickElement} hosted in a single overlay session,
 * mirroring {@link import("../../../../Controllers/QuickOpenController.ts").QuickOpenController}. Only
 * one quick-input is ever active at a time; a new call cancels any previous one.
 *
 * Exposes the InputBox flavor (`input()`) and the list-pick flavor
 * (`quickPick()`). The file-dialog flavor reuses the same widget/session and is a
 * future addition.
 */
export class QuickInputController extends Disposable {
    public readonly view: QuickPickElement;

    private hostBody: BodyElement | null = null;
    private session: OverlaySessionHandle | null = null;
    private pendingResolve: ((value: string | QuickPickItem | undefined) => void) | null = null;

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
            this.pendingResolve = resolve as (value: string | QuickPickItem | undefined) => void;

            const view = this.view;
            view.acceptMode = "value";
            view.items = [];
            view.title = opts.title;
            view.prompt = opts.prompt;
            view.placeholder = opts.placeholder ?? "";
            view.validationSeverity = "error";
            // Clear any list-pick leftovers so a prior quickPick() can't fire here.
            view.onAccept = null;
            view.onActiveItemChanged = null;

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

    /**
     * Present a filterable list and resolve with the chosen {@link QuickPickItem}
     * on Enter, or `undefined` if dismissed (Escape / outside click / superseded).
     *
     * The list is filtered live by a case-insensitive substring match on each
     * item's `label`. `onDidChangeActive` fires whenever the highlighted item
     * changes (open, navigation, filtering) — the seam for live preview.
     */
    public quickPick(opts: QuickPickOptions): Promise<QuickPickItem | undefined> {
        // A previous prompt still open? Cancel it before starting a new one.
        this.settle(undefined);

        return new Promise<QuickPickItem | undefined>((resolve) => {
            this.pendingResolve = resolve as (value: string | QuickPickItem | undefined) => void;

            const allItems = opts.items;
            const view = this.view;
            view.acceptMode = "item";
            view.title = opts.title;
            view.prompt = undefined;
            view.placeholder = opts.placeholder ?? "";
            view.validationMessage = null;

            const notifyActive = (): void => {
                const index = view.selectedIndex;
                opts.onDidChangeActive?.(view.items[index], index);
            };

            const applyFilter = (query: string): void => {
                const needle = query.trim().toLowerCase();
                view.items =
                    needle === "" ? allItems : allItems.filter((it) => it.label.toLowerCase().includes(needle));
                // `items =` resets the highlight to the top; surface that as an active change.
                notifyActive();
            };

            view.onQueryChange = (query) => {
                applyFilter(query);
            };
            view.onActiveItemChanged = () => {
                notifyActive();
            };
            view.onAccept = (item) => {
                // Mirror the InputBox flavor: defer the close so the trailing key
                // event of this Enter does not land in the newly-focused editor.
                queueMicrotask(() => {
                    this.settle(item);
                });
            };

            view.setQuery("");
            view.items = allItems;
            if (opts.activeIndex !== undefined) view.setActiveIndex(opts.activeIndex);
            notifyActive();

            this.updatePosition();
            this.session?.open();
            view.focus();
        });
    }

    /** Resolve the pending promise exactly once and close the overlay. */
    private settle(value: string | QuickPickItem | undefined): void {
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
