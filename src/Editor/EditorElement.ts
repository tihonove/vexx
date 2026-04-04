import { packRgb } from "../Rendering/ColorUtils.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIDom/TUIElement.ts";
import type { IScrollable } from "../TUIDom/Widgets/IScrollable.ts";

import { EditorViewState } from "./EditorViewState.ts";
import { isSelectionCollapsed, selectionToRange } from "./ISelection.ts";
import type { IUndoElement } from "./IUndoElement.ts";
import { UndoManager } from "./UndoManager.ts";

const SELECTION_BG = packRgb(38, 79, 120);

/**
 * TUI element that renders a text editor backed by EditorViewState.
 * Handles keyboard input (printable chars, Enter, Backspace, Delete)
 * and draws the document content with a hardware cursor.
 */
export class EditorElement extends TUIElement implements IScrollable {
    public readonly viewState: EditorViewState;
    public readonly undoManager: UndoManager;

    public get contentHeight(): number {
        return this.viewState.getViewLineCount();
    }

    public get contentWidth(): number {
        const doc = this.viewState.document;
        let max = 0;
        for (let i = 0; i < doc.lineCount; i++) {
            max = Math.max(max, doc.getLineLength(i));
        }
        return max;
    }

    public get scrollTop(): number {
        return this.viewState.scrollTop;
    }

    public get scrollLeft(): number {
        return this.viewState.scrollLeft;
    }

    public override getMinIntrinsicWidth(_height: number): number {
        return 1;
    }

    public override getMaxIntrinsicWidth(_height: number): number {
        return this.contentWidth;
    }

    public override getMinIntrinsicHeight(_width: number): number {
        return 1;
    }

    public override getMaxIntrinsicHeight(_width: number): number {
        return this.contentHeight;
    }

    public constructor(viewState: EditorViewState) {
        super();
        this.viewState = viewState;
        this.undoManager = new UndoManager(viewState.document, viewState);

        this.addEventListener("keypress", (event) => {
            this.handleKeyPress(event);
        });
    }

    public render(context: RenderContext): void {
        this.viewState.viewportWidth = this.layoutSize.width;
        this.viewState.viewportHeight = this.layoutSize.height;
        const scrollTop = this.viewState.scrollTop;
        const scrollLeft = this.viewState.scrollLeft;
        const visibleLines = this.layoutSize.height;
        const visibleCols = this.layoutSize.width;
        const viewLineCount = this.viewState.getViewLineCount();

        // Draw visible lines (using view projection that accounts for folding)
        for (let screenY = 0; screenY < visibleLines; screenY++) {
            const viewLine = scrollTop + screenY;
            if (viewLine >= viewLineCount) {
                // Past end of document — draw tilde like vim
                context.setCell(0, screenY, { char: "~" });
                for (let x = 1; x < visibleCols; x++) {
                    context.setCell(x, screenY, { char: " " });
                }
                continue;
            }

            const lineContent = this.viewState.getViewLine(viewLine);
            for (let screenX = 0; screenX < visibleCols; screenX++) {
                const docChar = scrollLeft + screenX;
                const char = docChar < lineContent.length ? lineContent[docChar] : " ";
                context.setCell(screenX, screenY, { char });
            }
        }

        // Highlight selections
        for (const sel of this.viewState.selections) {
            if (isSelectionCollapsed(sel)) continue;
            const range = selectionToRange(sel);

            for (let screenY = 0; screenY < visibleLines; screenY++) {
                const viewLine = scrollTop + screenY;
                if (viewLine >= viewLineCount) break;

                const logLine = this.viewState.visualToLogicalLine(viewLine);
                if (logLine < range.start.line || logLine > range.end.line) continue;

                const lineContent = this.viewState.getViewLine(viewLine);
                const selStartChar = logLine === range.start.line ? range.start.character : 0;
                // When selection spans past this line, highlight one extra cell for EOL
                const selEndChar = logLine === range.end.line ? range.end.character : lineContent.length + 1;

                const screenXStart = Math.max(0, selStartChar - scrollLeft);
                const screenXEnd = Math.min(visibleCols, selEndChar - scrollLeft);

                for (let screenX = screenXStart; screenX < screenXEnd; screenX++) {
                    context.setCell(screenX, screenY, { bg: SELECTION_BG });
                }
            }
        }

        // Position hardware cursor at the primary selection's active position
        const primary = this.viewState.selections[0];
        const cursorVisualLine = this.viewState.logicalToVisualLine(primary.active.line);
        const cursorScreenX = primary.active.character - scrollLeft;
        const cursorScreenY = cursorVisualLine - scrollTop;

        if (cursorScreenX >= 0 && cursorScreenX < visibleCols && cursorScreenY >= 0 && cursorScreenY < visibleLines) {
            context.setCursorPosition(cursorScreenX, cursorScreenY);
        }
    }

    private handleKeyPress(event: TUIKeyboardEvent): void {
        if (event.key === "z" && event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey) {
            this.undoManager.redo();
            return;
        }

        if (event.key === "z" && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            this.undoManager.undo();
            return;
        }

        if (event.key === "Enter") {
            this.pushUndo(this.viewState.type("\n"));
            return;
        }

        if (event.key === "Backspace") {
            this.pushUndo(this.viewState.deleteLeft());
            return;
        }

        if (event.key === "Delete") {
            this.pushUndo(this.viewState.deleteRight());
            return;
        }

        if (event.key === "ArrowLeft") {
            if (event.metaKey) {
                this.viewState.cursorHome(event.shiftKey);
            } else {
                this.viewState.cursorLeft(event.shiftKey);
            }
            return;
        }

        if (event.key === "ArrowRight") {
            if (event.metaKey) {
                this.viewState.cursorEnd(event.shiftKey);
            } else {
                this.viewState.cursorRight(event.shiftKey);
            }
            return;
        }

        if (event.key === "ArrowUp") {
            this.viewState.cursorUp(event.shiftKey);
            return;
        }

        if (event.key === "ArrowDown") {
            this.viewState.cursorDown(event.shiftKey);
            return;
        }

        if (event.key === "Home") {
            this.viewState.cursorHome(event.shiftKey);
            return;
        }

        if (event.key === "End") {
            this.viewState.cursorEnd(event.shiftKey);
            return;
        }

        // Printable character:     single char, no ctrl/alt/meta modifiers
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            this.pushUndo(this.viewState.type(event.key));
            return;
        }
    }

    private pushUndo(element: IUndoElement | undefined): void {
        if (element) {
            this.undoManager.pushUndoElement(element);
        }
    }
}
