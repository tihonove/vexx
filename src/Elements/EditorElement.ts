import { RenderContext, TUIElement } from "./TUIElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { UndoManager } from "../Editor/UndoManager.ts";
import type { IUndoElement } from "../Editor/IUndoElement.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";
import { isSelectionCollapsed, selectionToRange } from "../Editor/ISelection.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { Point } from "../Common/GeometryPromitives.ts";

const SELECTION_BG = packRgb(38, 79, 120);

/**
 * TUI element that renders a text editor backed by EditorViewState.
 * Handles keyboard input (printable chars, Enter, Backspace, Delete)
 * and draws the document content with a hardware cursor.
 */
export class EditorElement extends TUIElement {
    public readonly viewState: EditorViewState;
    public readonly undoManager: UndoManager;

    public constructor(viewState: EditorViewState) {
        super();
        this.viewState = viewState;
        this.undoManager = new UndoManager(viewState.document, viewState);

        this.addEventListener("keypress", (event) => {
            this.handleKeyPress(event);
        });
    }

    public render(context: RenderContext): void {
        const { canvas, offset } = context;
        const { dx: ox, dy: oy } = offset;
        this.viewState.viewportWidth = this.size.width;
        this.viewState.viewportHeight = this.size.height;
        const scrollTop = this.viewState.scrollTop;
        const scrollLeft = this.viewState.scrollLeft;
        const visibleLines = this.size.height;
        const visibleCols = this.size.width;
        const viewLineCount = this.viewState.getViewLineCount();

        // Draw visible lines (using view projection that accounts for folding)
        for (let screenY = 0; screenY < visibleLines; screenY++) {
            const viewLine = scrollTop + screenY;
            if (viewLine >= viewLineCount) {
                // Past end of document — draw tilde like vim
                canvas.setCell(new Point(ox, oy + screenY), { char: "~" });
                for (let x = 1; x < visibleCols; x++) {
                    canvas.setCell(new Point(ox + x, oy + screenY), { char: " " });
                }
                continue;
            }

            const lineContent = this.viewState.getViewLine(viewLine);
            for (let screenX = 0; screenX < visibleCols; screenX++) {
                const docChar = scrollLeft + screenX;
                const char = docChar < lineContent.length ? lineContent[docChar] : " ";
                canvas.setCell(new Point(ox + screenX, oy + screenY), { char });
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
                    canvas.setCell(new Point(ox + screenX, oy + screenY), { bg: SELECTION_BG });
                }
            }
        }

        // Position hardware cursor at the primary selection's active position
        const primary = this.viewState.selections[0];
        const cursorVisualLine = this.viewState.logicalToVisualLine(primary.active.line);
        const cursorScreenX = primary.active.character - scrollLeft;
        const cursorScreenY = cursorVisualLine - scrollTop;

        if (cursorScreenX >= 0 && cursorScreenX < visibleCols && cursorScreenY >= 0 && cursorScreenY < visibleLines) {
            canvas.setCursorPosition(new Point(ox + cursorScreenX, oy + cursorScreenY));
        }
    }

    private handleKeyPress(event: KeyPressEvent): void {
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
