import { Disposable } from "../Common/Disposable.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import { findMatches } from "../Editor/findMatches.ts";
import type { IPosition } from "../Editor/IPosition.ts";
import { comparePositions } from "../Editor/IPosition.ts";
import type { IRange } from "../Editor/IRange.ts";
import { createSelection } from "../Editor/ISelection.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { FindWidgetElement } from "../TUIDom/Widgets/FindWidgetElement.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/OverlayLayer.ts";
import { getFindWidgetStyles } from "../Workbench/Styles/defaultStyles.ts";

import type { EditorGroupController } from "./EditorGroupController.ts";

/**
 * Drives the find-in-file widget: owns the query → matches → current-index
 * state and pushes it to the active editor for highlighting + reveal. Mirrors
 * {@link QuickOpenController}'s overlay lifecycle, but the overlay lives in the
 * editor group's local layer (not the global body layer).
 */
export class FindController extends Disposable {
    public readonly view: FindWidgetElement;

    private readonly editorGroupController: EditorGroupController;
    private session: OverlaySessionHandle | null = null;

    private matches: IRange[] = [];
    private currentIndex = -1;

    public constructor(editorGroupController: EditorGroupController) {
        super();
        this.editorGroupController = editorGroupController;
        this.view = new FindWidgetElement();
        this.view.onQueryChange = () => {
            this.recompute();
        };
        this.view.onNext = () => {
            this.next();
        };
        this.view.onPrev = () => {
            this.prev();
        };
        this.view.onClose = () => {
            this.close();
        };
    }

    /** Push the active theme into the widget's buttons. */
    public applyTheme(theme: WorkbenchTheme): void {
        this.view.setStyles(getFindWidgetStyles(theme));
    }

    /** Attaches the widget to the editor group's overlay layer. */
    public setHostView(): void {
        this.session = this.editorGroupController.view.overlayLayer.createSession(this.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            // Find — это док-виджет: клики мимо него намеренно уходят в редактор (как в VS Code).
            pointerPolicy: "passthrough",
        });
        this.register({
            dispose: () => {
                this.session?.dispose();
                this.session = null;
            },
        });
    }

    public isVisible(): boolean {
        return this.session?.isOpen() ?? false;
    }

    public open(): void {
        if (this.session?.isOpen()) {
            this.view.focus();
            return;
        }

        // Seed the query from a single-line, non-empty selection (VS Code behaviour).
        const editor = this.editorGroupController.getActiveEditor();
        if (editor) {
            const selected = editor.viewState.getSelectedText();
            if (selected.length > 0 && !selected.includes("\n")) {
                this.view.setQuery(selected);
            }
        }

        this.recompute();
        this.updatePosition();
        this.session?.open();
        this.view.focus();
    }

    public close(): void {
        if (!this.session?.isOpen()) return;

        const editor = this.editorGroupController.getActiveEditor();
        if (editor) {
            // Leave the cursor on the current match (VS Code behaviour), then clear highlights.
            if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
                const m = this.matches[this.currentIndex];
                editor.viewState.selections = [
                    createSelection(m.start.line, m.start.character, m.end.line, m.end.character),
                ];
            }
            editor.setSearchDecorations([], -1);
        }

        this.matches = [];
        this.currentIndex = -1;
        this.session.close();
    }

    public next(): void {
        if (this.matches.length === 0) return;
        this.setCurrent((this.currentIndex + 1) % this.matches.length);
    }

    public prev(): void {
        if (this.matches.length === 0) return;
        this.setCurrent((this.currentIndex - 1 + this.matches.length) % this.matches.length);
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    /**
     * Recomputes matches for the current query, seeds the current index from the
     * cursor, and refreshes the editor highlights + counter.
     */
    private recompute(): void {
        const editor = this.editorGroupController.getActiveEditor();
        if (!editor) {
            this.matches = [];
            this.currentIndex = -1;
            this.view.setCounter(0, 0);
            return;
        }

        this.matches = findMatches(editor.viewState.document, this.view.getQuery());

        if (this.matches.length === 0) {
            this.currentIndex = -1;
        } else {
            this.currentIndex = this.pickCurrentIndex(this.matches, editor.viewState.selections[0].active);
        }

        editor.setSearchDecorations(this.matches, this.currentIndex);
        if (this.currentIndex >= 0) {
            editor.revealRange(this.matches[this.currentIndex]);
        }
        this.view.setCounter(this.currentIndex + 1, this.matches.length);
    }

    private setCurrent(index: number): void {
        this.currentIndex = index;
        const editor = this.editorGroupController.getActiveEditor();
        if (editor) {
            editor.setSearchDecorations(this.matches, index);
            editor.revealRange(this.matches[index]);
        }
        this.view.setCounter(index + 1, this.matches.length);
    }

    /** First match starting at or after `cursor`, wrapping to the first match. */
    private pickCurrentIndex(matches: IRange[], cursor: IPosition): number {
        for (let i = 0; i < matches.length; i++) {
            if (comparePositions(matches[i].start, cursor) >= 0) return i;
        }
        return 0;
    }

    private updatePosition(): void {
        const group = this.editorGroupController.view;
        const groupWidth = group.layoutSize.width;
        const widgetW = Math.min(60, Math.max(28, groupWidth - 2));
        this.view.preferredWidth = widgetW;
        const px = Math.max(0, groupWidth - widgetW - 1); // right-align with a 1-col margin to the group's edge
        const py = 1; // directly under the tab strip
        this.session?.setPosition(new Point(px, py));
    }
}
