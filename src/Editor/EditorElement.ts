import { DisplayLine } from "../Common/DisplayLine.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import { RenderContext, TUIElement } from "../TUIDom/TUIElement.ts";
import type { IScrollable } from "../TUIDom/Widgets/IScrollable.ts";

import { EditorViewState } from "./EditorViewState.ts";
import { isSelectionCollapsed, selectionToRange } from "./ISelection.ts";
import type { IUndoElement } from "./IUndoElement.ts";
import { UndoManager } from "./UndoManager.ts";

const SELECTION_BG = packRgb(38, 79, 120);
const GUTTER_LEFT_PADDING = 2;

const DEFAULT_LINE_NUMBER_FG = packRgb(133, 133, 133);
const DEFAULT_LINE_NUMBER_ACTIVE_FG = packRgb(198, 198, 198);

/**
 * TUI element that renders a text editor backed by EditorViewState.
 * Handles keyboard input (printable chars, Enter, Backspace, Delete)
 * and draws the document content with a hardware cursor.
 */
export class EditorElement extends TUIElement implements IScrollable {
    public readonly viewState: EditorViewState;
    public readonly undoManager: UndoManager;

    public get tabSize(): number {
        return this.viewState.tabSize;
    }

    public set tabSize(value: number) {
        this.viewState.tabSize = value;
    }

    public gutterBackground: number | undefined;
    public lineNumberForeground: number | undefined;
    public lineNumberActiveForeground: number | undefined;

    public get contentHeight(): number {
        return this.viewState.getViewLineCount();
    }

    public get contentWidth(): number {
        const doc = this.viewState.document;
        let max = 0;
        for (let i = 0; i < doc.lineCount; i++) {
            const dl = new DisplayLine(doc.getLineContent(i), this.tabSize);
            max = Math.max(max, dl.displayWidth);
        }
        return max;
    }

    public get scrollTop(): number {
        return this.viewState.scrollTop;
    }

    public get scrollLeft(): number {
        return this.viewState.scrollLeft;
    }

    public get gutterWidth(): number {
        const viewLineCount = this.viewState.getViewLineCount();
        const digitCount = Math.max(1, Math.floor(Math.log10(viewLineCount)) + 1);
        return GUTTER_LEFT_PADDING + digitCount + 1;
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
        this.tabIndex = 0;
        this.viewState = viewState;
        this.undoManager = new UndoManager(viewState.document, viewState);

        this.addEventListener("keypress", (event) => {
            this.handleKeyPress(event);
        });
    }

    public render(context: RenderContext): void {
        const gutterW = this.gutterWidth;
        const contentCols = this.layoutSize.width - gutterW;
        this.viewState.viewportWidth = contentCols;
        this.viewState.viewportHeight = this.layoutSize.height;
        const scrollTop = this.viewState.scrollTop;
        const scrollLeft = this.viewState.scrollLeft;
        const visibleLines = this.layoutSize.height;
        const viewLineCount = this.viewState.getViewLineCount();

        const editorFg = this.resolvedStyle.fg;
        const editorBg = this.resolvedStyle.bg;
        const gutBg = this.gutterBackground ?? editorBg;
        const lnFg = this.lineNumberForeground ?? DEFAULT_LINE_NUMBER_FG;
        const lnActiveFg = this.lineNumberActiveForeground ?? DEFAULT_LINE_NUMBER_ACTIVE_FG;

        const primaryLine = this.viewState.selections[0].active.line;
        const digitCount = gutterW - GUTTER_LEFT_PADDING - 1;

        for (let screenY = 0; screenY < visibleLines; screenY++) {
            const viewLine = scrollTop + screenY;

            // --- Gutter ---
            if (viewLine < viewLineCount) {
                const logLine = this.viewState.visualToLogicalLine(viewLine);
                const lineNumStr = String(logLine + 1).padStart(digitCount, " ");
                const isActive = logLine === primaryLine;
                const numFg = isActive ? lnActiveFg : lnFg;

                // Left padding
                for (let x = 0; x < GUTTER_LEFT_PADDING; x++) {
                    context.setCell(x, screenY, { char: " ", fg: numFg, bg: gutBg });
                }
                // Line number digits
                for (let d = 0; d < digitCount; d++) {
                    context.setCell(GUTTER_LEFT_PADDING + d, screenY, { char: lineNumStr[d], fg: numFg, bg: gutBg });
                }
                // Right separator space
                context.setCell(gutterW - 1, screenY, { char: " ", fg: numFg, bg: gutBg });
            } else {
                // Past end of document — empty gutter
                for (let x = 0; x < gutterW; x++) {
                    context.setCell(x, screenY, { char: " ", bg: gutBg });
                }
            }

            // --- Content area ---
            if (viewLine >= viewLineCount) {
                // Past end of document — draw tilde like vim
                context.setCell(gutterW, screenY, { char: "~", fg: editorFg, bg: editorBg });
                for (let x = 1; x < contentCols; x++) {
                    context.setCell(gutterW + x, screenY, { char: " ", fg: editorFg, bg: editorBg });
                }
                continue;
            }

            const lineContent = this.viewState.getViewLine(viewLine);
            const dl = new DisplayLine(lineContent, this.tabSize);
            let screenX = 0;
            while (screenX < contentCols) {
                const displayCol = scrollLeft + screenX;
                const char = dl.charAtColumn(displayCol);
                if (char === "") {
                    // Continuation column of a wide char — skip, already handled by Grid
                    screenX++;
                    continue;
                }
                const slot = dl.graphemeAtColumn(displayCol);
                const width = slot ? slot.displayWidth : 1;
                if (slot?.grapheme === "\t") {
                    // Tab: render each column as an individual space so Grid/TerminalRenderer
                    // tracks the cursor correctly (they only support width=1 and width=2).
                    for (let i = 0; i < width && screenX + i < contentCols; i++) {
                        context.setCell(gutterW + screenX + i, screenY, { char: " ", fg: editorFg, bg: editorBg });
                    }
                    screenX += width;
                } else if (width === 2 && screenX + 1 >= contentCols) {
                    // Wide char doesn't fit at the right edge — render space instead
                    context.setCell(gutterW + screenX, screenY, { char: " ", fg: editorFg, bg: editorBg, width: 1 });
                    screenX++;
                } else {
                    context.setCell(gutterW + screenX, screenY, { char, fg: editorFg, bg: editorBg, width });
                    screenX += width;
                }
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
                const dl = new DisplayLine(lineContent, this.tabSize);
                const selStartChar = logLine === range.start.line ? range.start.character : 0;
                const selEndChar = logLine === range.end.line ? range.end.character : lineContent.length + 1;

                const selStartCol = logLine === range.start.line ? dl.offsetToColumn(selStartChar) : 0;
                const selEndCol = logLine === range.end.line ? dl.offsetToColumn(selEndChar) : dl.displayWidth + 1;

                const screenXStart = Math.max(0, selStartCol - scrollLeft);
                const screenXEnd = Math.min(contentCols, selEndCol - scrollLeft);

                for (let screenX = screenXStart; screenX < screenXEnd; screenX++) {
                    context.setCell(gutterW + screenX, screenY, { bg: SELECTION_BG });
                }
            }
        }

        // Position hardware cursor at the primary selection's active position
        const primary = this.viewState.selections[0];
        const cursorVisualLine = this.viewState.logicalToVisualLine(primary.active.line);
        const cursorLineContent = this.viewState.getViewLine(cursorVisualLine);
        const cursorDl = new DisplayLine(cursorLineContent, this.tabSize);
        const cursorScreenX = cursorDl.offsetToColumn(primary.active.character) - scrollLeft + gutterW;
        const cursorScreenY = cursorVisualLine - scrollTop;

        if (
            this.isFocused &&
            cursorScreenX >= gutterW &&
            cursorScreenX < this.layoutSize.width &&
            cursorScreenY >= 0 &&
            cursorScreenY < visibleLines
        ) {
            context.setCursorPosition(cursorScreenX, cursorScreenY);
        }
    }

    private handleKeyPress(event: TUIKeyboardEvent): void {
        if (event.key === "Enter") {
            this.pushUndo(this.viewState.type("\n"));
            return;
        }

        // Printable character: single char, no ctrl/alt/meta modifiers
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
