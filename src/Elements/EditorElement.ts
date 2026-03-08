import { RenderContext, TUIElement } from "./TUIElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import type { KeyPressEvent } from "../TerminalBackend/KeyEvent.ts";

/**
 * TUI element that renders a text editor backed by EditorViewState.
 * Handles keyboard input (printable chars, Enter, Backspace, Delete)
 * and draws the document content with a hardware cursor.
 */
export class EditorElement extends TUIElement {
    public readonly viewState: EditorViewState;

    constructor(viewState: EditorViewState) {
        super();
        this.viewState = viewState;

        this.addEventListener("keypress", (event) => {
            this.handleKeyPress(event);
        });
    }

    public render(context: RenderContext): void {
        const { canvas, offset } = context;
        const { dx: ox, dy: oy } = offset;
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
                canvas.setCell(ox, oy + screenY, { char: "~" });
                for (let x = 1; x < visibleCols; x++) {
                    canvas.setCell(ox + x, oy + screenY, { char: " " });
                }
                continue;
            }

            const lineContent = this.viewState.getViewLine(viewLine);
            for (let screenX = 0; screenX < visibleCols; screenX++) {
                const docChar = scrollLeft + screenX;
                const char = docChar < lineContent.length ? lineContent[docChar] : " ";
                canvas.setCell(ox + screenX, oy + screenY, { char });
            }
        }

        // Position hardware cursor at the primary selection's active position
        const primary = this.viewState.selections[0];
        const cursorVisualLine = this.viewState.logicalToVisualLine(primary.active.line);
        const cursorScreenX = primary.active.character - scrollLeft;
        const cursorScreenY = cursorVisualLine - scrollTop;

        if (cursorScreenX >= 0 && cursorScreenX < visibleCols && cursorScreenY >= 0 && cursorScreenY < visibleLines) {
            canvas.setCursorPosition(ox + cursorScreenX, oy + cursorScreenY);
        }
    }

    private handleKeyPress(event: KeyPressEvent): void {
        if (event.key === "Enter") {
            this.viewState.insertNewLine();
            return;
        }

        if (event.key === "Backspace") {
            this.viewState.deleteLeft();
            return;
        }

        if (event.key === "Delete") {
            this.viewState.deleteRight();
            return;
        }

        if (event.key === "ArrowLeft") {
            this.viewState.moveCursorLeft();
            return;
        }

        if (event.key === "ArrowRight") {
            this.viewState.moveCursorRight();
            return;
        }

        if (event.key === "ArrowUp") {
            this.viewState.moveCursorUp();
            return;
        }

        if (event.key === "ArrowDown") {
            this.viewState.moveCursorDown();
            return;
        }

        // Printable character: single char, no ctrl/alt/meta modifiers
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            this.viewState.type(event.key);
            return;
        }
    }
}
