import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import { findMatches } from "../../Editor/findMatches.ts";
import type { IPosition } from "../../Editor/IPosition.ts";
import { comparePositions } from "../../Editor/IPosition.ts";
import type { IRange } from "../../Editor/IRange.ts";
import { createSelection } from "../../Editor/ISelection.ts";
import type { FindComponent } from "../Components/Editor/FindComponent.ts";
import { FindComponentDIToken } from "../Components/Editor/FindComponent.ts";

import type { EditorService } from "./EditorService.ts";
import { EditorServiceDIToken } from "./EditorService.ts";

export const FindServiceDIToken = token<FindService>("FindService");

/**
 * Drives find-in-file: owns the query → matches → current-index state and
 * pushes it to the active editor for highlighting + reveal. The widget and its
 * overlay session live in {@link FindComponent}; the service wires the widget
 * callbacks and follows the active editor via {@link EditorService} (switching
 * editors closes the widget — find operates on the active editor only).
 */
export class FindService extends Disposable {
    public static dependencies = [FindComponentDIToken, EditorServiceDIToken] as const;

    private readonly component: FindComponent;
    private readonly editorService: EditorService;

    private matches: IRange[] = [];
    private currentIndex = -1;

    public constructor(component: FindComponent, editorService: EditorService) {
        super();
        this.component = component;
        this.editorService = editorService;
        component.onQueryChange = () => {
            this.recompute();
        };
        component.onNext = () => {
            this.next();
        };
        component.onPrev = () => {
            this.prev();
        };
        component.onClose = () => {
            this.close();
        };
        // Find оперирует только активным редактором — смена активного закрывает
        // виджет (раньше эту подписку держал корневой контроллер).
        this.register(
            this.editorService.onActiveEditorChanged(() => {
                this.close();
            }),
        );
    }

    public isVisible(): boolean {
        return this.component.isOpen();
    }

    public open(): void {
        if (this.component.isOpen()) {
            this.component.focus();
            return;
        }

        // Seed the query from a single-line, non-empty selection (VS Code behaviour).
        const editor = this.editorService.getActiveEditor();
        if (editor) {
            const selected = editor.viewState.getSelectedText();
            if (selected.length > 0 && !selected.includes("\n")) {
                this.component.setQuery(selected);
            }
        }

        this.recompute();
        this.component.show();
    }

    public close(): void {
        if (!this.component.isOpen()) return;

        const editor = this.editorService.getActiveEditor();
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
        this.component.hide();
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
        const editor = this.editorService.getActiveEditor();
        if (!editor) {
            this.matches = [];
            this.currentIndex = -1;
            this.component.setCounter(0, 0);
            return;
        }

        this.matches = findMatches(editor.viewState.document, this.component.getQuery());

        if (this.matches.length === 0) {
            this.currentIndex = -1;
        } else {
            this.currentIndex = this.pickCurrentIndex(this.matches, editor.viewState.selections[0].active);
        }

        editor.setSearchDecorations(this.matches, this.currentIndex);
        if (this.currentIndex >= 0) {
            editor.revealRange(this.matches[this.currentIndex]);
        }
        this.component.setCounter(this.currentIndex + 1, this.matches.length);
    }

    private setCurrent(index: number): void {
        this.currentIndex = index;
        const editor = this.editorService.getActiveEditor();
        if (editor) {
            editor.setSearchDecorations(this.matches, index);
            editor.revealRange(this.matches[index]);
        }
        this.component.setCounter(index + 1, this.matches.length);
    }

    /** First match starting at or after `cursor`, wrapping to the first match. */
    private pickCurrentIndex(matches: IRange[], cursor: IPosition): number {
        for (let i = 0; i < matches.length; i++) {
            if (comparePositions(matches[i].start, cursor) >= 0) return i;
        }
        return 0;
    }
}
