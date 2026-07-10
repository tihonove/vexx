import { DisplayLine } from "../Common/DisplayLine.ts";
import { Point } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import { StyleFlags } from "../Rendering/StyleFlags.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIEventBase } from "../TUIDom/Events/TUIEventBase.ts";
import type { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";
import type { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import type { TUIPasteEvent } from "../TUIDom/Events/TUIPasteEvent.ts";
import { RenderContext, TUIElement } from "../TUIDom/TUIElement.ts";
import type { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";
import type { IScrollable } from "../TUIDom/Widgets/IScrollable.ts";
import type { OverlaySessionHandle } from "../TUIDom/Widgets/OverlayLayer.ts";
import type { MenuEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { PopupMenuElement } from "../TUIDom/Widgets/PopupMenuElement.ts";

import { computeWordOccurrences } from "./computeWordOccurrences.ts";
import { EditorViewState } from "./EditorViewState.ts";
import type { ILineTokens, IToken } from "./ILineTokens.ts";
import type { IRange } from "./IRange.ts";
import { createCursorSelection, createSelection, isSelectionCollapsed, selectionToRange } from "./ISelection.ts";
import type { IUndoElement } from "./IUndoElement.ts";
import type { ITokenStyleResolver, ResolvedTokenStyle } from "./Tokenization/ITokenStyleResolver.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "./Tokenization/ITokenStyleResolver.ts";
import { UndoManager } from "./UndoManager.ts";

const SELECTION_BG = packRgb(38, 79, 120);
// Find-in-file highlights: all matches get a dim background; the current match a brighter one.
const FIND_MATCH_BG = packRgb(98, 91, 23);
const FIND_MATCH_CURRENT_BG = packRgb(168, 109, 0);
// Occurrences of the word under the cursor. Opaque approximation of VS Code's
// `editor.wordHighlightBackground` (#575757b8) composited over the editor bg.
const DEFAULT_OCCURRENCE_HIGHLIGHT_BG = packRgb(71, 71, 71);
const NO_RANGES: readonly IRange[] = [];
const GUTTER_LEFT_PADDING = 2;

const DEFAULT_LINE_NUMBER_FG = packRgb(133, 133, 133);
const DEFAULT_LINE_NUMBER_ACTIVE_FG = packRgb(198, 198, 198);

/** Viewport geometry shared by the range-background highlight passes. */
interface RangeHighlightGeometry {
    scrollTop: number;
    scrollLeft: number;
    visibleLines: number;
    viewLineCount: number;
    contentCols: number;
    gutterW: number;
}

/**
 * TUI element that renders a text editor backed by EditorViewState.
 * Handles keyboard input (printable chars, Enter, Backspace, Delete)
 * and draws the document content with a hardware cursor.
 */
export class EditorElement extends TUIElement implements IScrollable {
    public readonly viewState: EditorViewState;
    public readonly undoManager: UndoManager;
    /**
     * Resolves TextMate scopes to {@link ResolvedTokenStyle}. Defaults to a
     * no-op resolver; concrete implementations live in the Theme layer (or
     * are supplied by an LSP semantic-tokens provider).
     */
    public tokenStyleResolver: ITokenStyleResolver = NULL_TOKEN_STYLE_RESOLVER;

    public get tabSize(): number {
        return this.viewState.tabSize;
    }

    public set tabSize(value: number) {
        this.viewState.tabSize = value;
    }

    public gutterBackground: number | undefined;
    public lineNumberForeground: number | undefined;
    public lineNumberActiveForeground: number | undefined;
    /** Background used to highlight occurrences of the word under the cursor. */
    public occurrenceHighlightBackground: number | undefined;
    /** Whether to highlight occurrences of the word under the cursor (VS Code `editor.occurrencesHighlight`). */
    public occurrenceHighlightEnabled = true;

    public contextMenuEntries: MenuEntry[] = [];
    /** Тема для тематизации контекстного меню (`menu.*`); задаётся контроллером. */
    public menuTheme: WorkbenchTheme | null = null;

    private contentWidthCache: { versionId: number; value: number } | null = null;
    private occurrenceCache: { versionId: number; line: number; character: number; ranges: IRange[] } | null = null;
    private activeContextMenuSession: OverlaySessionHandle | null = null;

    public get contentHeight(): number {
        return this.viewState.getViewLineCount();
    }

    public get contentWidth(): number {
        const doc = this.viewState.document;
        const currentVersionId = doc.versionId;
        if (this.contentWidthCache !== null && this.contentWidthCache.versionId === currentVersionId) {
            return this.contentWidthCache.value;
        }
        let max = 0;
        for (let i = 0; i < doc.lineCount; i++) {
            const dl = new DisplayLine(doc.getLineContent(i), this.tabSize);
            max = Math.max(max, dl.displayWidth);
        }
        this.contentWidthCache = { versionId: currentVersionId, value: max };
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

    /**
     * Абсолютные (экранные) координаты ячейки каретки первичного курсора, или
     * `null`, если каретка вне видимой области. Используется для якорения
     * completion-попапа (та же математика, что в {@link render}).
     */
    public getCaretScreenCell(): Point | null {
        const gutterW = this.gutterWidth;
        const scrollTop = this.viewState.scrollTop;
        const scrollLeft = this.viewState.scrollLeft;
        const visibleLines = this.layoutSize.height;

        const primary = this.viewState.selections[0];
        const cursorVisualLine = this.viewState.logicalToVisualLine(primary.active.line);
        const cursorLineContent = this.viewState.getViewLine(cursorVisualLine);
        const cursorDl = new DisplayLine(cursorLineContent, this.tabSize);
        const localX = cursorDl.offsetToColumn(primary.active.character) - scrollLeft + gutterW;
        const localY = cursorVisualLine - scrollTop;

        if (localX < gutterW || localX >= this.layoutSize.width || localY < 0 || localY >= visibleLines) {
            return null;
        }
        return new Point(this.globalPosition.x + localX, this.globalPosition.y + localY);
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

        this.addEventListener("keydown", (event) => {
            this.handleKeyDown(event);
        });
        this.addEventListener("keypress", (event) => {
            this.handleKeyPress(event);
        });
        this.addEventListener("paste", (event) => {
            this.handlePaste(event);
        });
        this.addEventListener("mousedown", (event) => {
            this.handleMouseDown(event);
        });
        this.addEventListener("mousemove", (event) => {
            this.handleMouseMove(event);
        });
        this.addEventListener("mouseup", () => {
            this.dragAnchor = null;
        });
        this.addEventListener("wheel", (event) => {
            this.handleWheel(event);
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

        // Bring the token cache up to the bottom of the viewport before reading.
        const tokenStore = this.viewState.tokenStore;
        if (tokenStore) {
            const lastVisibleLogical = this.viewState.visualToLogicalLine(
                Math.min(scrollTop + visibleLines - 1, viewLineCount - 1),
            );
            if (lastVisibleLogical >= 0) tokenStore.tokenizeUpTo(lastVisibleLogical);
        }

        // Frame-local cache of resolved styles to avoid re-walking the rule list
        // for repeated scopes within a single render pass.
        const styleCache = new Map<readonly string[], ResolvedTokenStyle>();
        const resolveStyle = (scopes: readonly string[]): ResolvedTokenStyle => {
            const cached = styleCache.get(scopes);
            if (cached) return cached;
            const result = this.tokenStyleResolver.resolve(scopes);
            styleCache.set(scopes, result);
            return result;
        };

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
                // Past end of document — empty content area (VS Code draws no vim-style tildes)
                for (let x = 0; x < contentCols; x++) {
                    context.setCell(gutterW + x, screenY, { char: " ", fg: editorFg, bg: editorBg });
                }
                continue;
            }

            const lineContent = this.viewState.getViewLine(viewLine);
            const dl = new DisplayLine(lineContent, this.tabSize);
            const lineTokens = this.viewState.getViewLineTokens(viewLine);
            const tokenIndex = lineTokens ? new TokenIndex(lineTokens, lineContent.length) : null;

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

                // Resolve style for this offset.
                let fg = editorFg;
                let bg = editorBg;
                let style: number = StyleFlags.None;
                if (tokenIndex && slot) {
                    const offset = slot.offset;
                    const token = tokenIndex.tokenAt(offset);
                    if (token) {
                        const resolved = resolveStyle(token.scopes);
                        if (resolved.fg !== undefined) fg = resolved.fg;
                        if (resolved.bg !== undefined) bg = resolved.bg;
                        style = packStyleFlags(resolved);
                    }
                }

                if (slot?.grapheme === "\t") {
                    // Tab: render each column as an individual space so Grid/TerminalRenderer
                    // tracks the cursor correctly (they only support width=1 and width=2).
                    for (let i = 0; i < width && screenX + i < contentCols; i++) {
                        context.setCell(gutterW + screenX + i, screenY, { char: " ", fg, bg, style });
                    }
                    screenX += width;
                } else if (width === 2 && screenX + 1 >= contentCols) {
                    // Wide char doesn't fit at the right edge — render space instead
                    context.setCell(gutterW + screenX, screenY, { char: " ", fg, bg, style, width: 1 });
                    screenX++;
                } else {
                    context.setCell(gutterW + screenX, screenY, { char, fg, bg, style, width });
                    screenX += width;
                }
            }
        }

        // Shared geometry for the range-background highlight passes below.
        const geometry: RangeHighlightGeometry = {
            scrollTop,
            scrollLeft,
            visibleLines,
            viewLineCount,
            contentCols,
            gutterW,
        };

        // Highlight all occurrences of the word under the cursor (weakest layer,
        // painted first so selections and search matches win where they overlap).
        const occurrenceBg = this.occurrenceHighlightBackground ?? DEFAULT_OCCURRENCE_HIGHLIGHT_BG;
        for (const range of this.getOccurrenceHighlights()) {
            this.paintRangeBackground(context, range, occurrenceBg, geometry);
        }

        // Highlight all search matches except the current one (drawn under selections).
        const searchMatches = this.viewState.searchMatches;
        const currentMatchIndex = this.viewState.currentSearchMatchIndex;
        for (let i = 0; i < searchMatches.length; i++) {
            if (i === currentMatchIndex) continue;
            this.paintRangeBackground(context, searchMatches[i], FIND_MATCH_BG, geometry);
        }

        // Highlight selections
        for (const sel of this.viewState.selections) {
            if (isSelectionCollapsed(sel)) continue;
            this.paintRangeBackground(context, selectionToRange(sel), SELECTION_BG, geometry);
        }

        // Highlight the current search match on top (wins over other matches and selection).
        if (currentMatchIndex >= 0 && currentMatchIndex < searchMatches.length) {
            this.paintRangeBackground(context, searchMatches[currentMatchIndex], FIND_MATCH_CURRENT_BG, geometry);
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

    /**
     * Paints a solid background colour over the cells covered by `range` within
     * the visible viewport. Only `bg` is set, so the glyph and fg underneath are
     * preserved. Used by both the selection and search-match highlight passes.
     */
    private paintRangeBackground(context: RenderContext, range: IRange, bg: number, geo: RangeHighlightGeometry): void {
        for (let screenY = 0; screenY < geo.visibleLines; screenY++) {
            const viewLine = geo.scrollTop + screenY;
            if (viewLine >= geo.viewLineCount) break;

            const logLine = this.viewState.visualToLogicalLine(viewLine);
            if (logLine < range.start.line || logLine > range.end.line) continue;

            const lineContent = this.viewState.getViewLine(viewLine);
            const dl = new DisplayLine(lineContent, this.tabSize);
            const startChar = logLine === range.start.line ? range.start.character : 0;
            const endChar = logLine === range.end.line ? range.end.character : lineContent.length + 1;

            const startCol = logLine === range.start.line ? dl.offsetToColumn(startChar) : 0;
            const endCol = logLine === range.end.line ? dl.offsetToColumn(endChar) : dl.displayWidth + 1;

            const screenXStart = Math.max(0, startCol - geo.scrollLeft);
            const screenXEnd = Math.min(geo.contentCols, endCol - geo.scrollLeft);

            for (let screenX = screenXStart; screenX < screenXEnd; screenX++) {
                context.setCell(geo.gutterW + screenX, screenY, { bg });
            }
        }
    }

    /**
     * Ranges of every occurrence of the word under the primary cursor. Empty
     * when disabled or when the primary selection is not collapsed (no
     * highlight while text is selected — that mirrors VS Code, where a
     * selection switches to the separate selection-highlight feature).
     *
     * Cached by document version + caret position so re-renders triggered by
     * unrelated changes don't rescan the document.
     */
    private getOccurrenceHighlights(): readonly IRange[] {
        if (!this.occurrenceHighlightEnabled) return NO_RANGES;
        const primary = this.viewState.selections[0];
        if (!isSelectionCollapsed(primary)) return NO_RANGES;

        const doc = this.viewState.document;
        const pos = primary.active;
        const cache = this.occurrenceCache;
        if (
            cache !== null &&
            cache.versionId === doc.versionId &&
            cache.line === pos.line &&
            cache.character === pos.character
        ) {
            return cache.ranges;
        }

        const ranges = computeWordOccurrences(doc, pos);
        this.occurrenceCache = { versionId: doc.versionId, line: pos.line, character: pos.character, ranges };
        return ranges;
    }

    private handleWheel(event: TUIMouseEvent): void {
        const viewState = this.viewState;
        const maxScrollTop = Math.max(0, viewState.getViewLineCount() - viewState.viewportHeight);
        const maxScrollLeft = Math.max(0, this.contentWidth - viewState.viewportWidth);

        switch (event.wheelDirection) {
            case "up":
                viewState.scrollTop = Math.max(0, viewState.scrollTop - 3);
                break;
            case "down":
                viewState.scrollTop = Math.min(maxScrollTop, viewState.scrollTop + 3);
                break;
            case "left":
                viewState.scrollLeft = Math.max(0, viewState.scrollLeft - 3);
                break;
            case "right":
                viewState.scrollLeft = Math.min(maxScrollLeft, viewState.scrollLeft + 3);
                break;
        }

        this.markDirty();
    }

    private dragAnchor: { line: number; character: number } | null = null;

    private screenToDocPosition(localX: number, localY: number): { line: number; character: number } {
        const gutterW = this.gutterWidth;
        const viewLineCount = this.viewState.getViewLineCount();
        /* v8 ignore start -- unreachable: a TextDocument always has at least one line and a fold header is never hidden, so getViewLineCount() is never 0 */
        if (viewLineCount === 0) return { line: 0, character: 0 };
        /* v8 ignore stop */

        const viewLine = Math.min(this.viewState.scrollTop + localY, viewLineCount - 1);
        const logLine = this.viewState.visualToLogicalLine(viewLine);
        const displayCol = localX < gutterW ? 0 : localX - gutterW + this.viewState.scrollLeft;
        const lineContent = this.viewState.document.getLineContent(logLine);
        const dl = new DisplayLine(lineContent, this.tabSize);
        const charOffset = dl.columnToOffset(displayCol);
        return { line: logLine, character: charOffset };
    }

    private handleMouseDown(event: TUIMouseEvent): void {
        if (event.button === "right") {
            this.openContextMenu(event.screenX, event.screenY);
            return;
        }
        /* v8 ignore start -- unreachable: getViewLineCount() is never 0 (document always has a line; fold headers stay visible) */
        if (this.viewState.getViewLineCount() === 0) return;
        /* v8 ignore stop */

        const pos = this.screenToDocPosition(event.localX, event.localY);

        if (event.shiftKey && this.viewState.selections.length > 0) {
            const anchor = this.viewState.selections[0].anchor;
            this.dragAnchor = { line: anchor.line, character: anchor.character };
            this.viewState.selections = [createSelection(anchor.line, anchor.character, pos.line, pos.character)];
        } else {
            this.dragAnchor = { line: pos.line, character: pos.character };
            this.viewState.selections = [createCursorSelection(pos.line, pos.character)];
        }
    }

    private openContextMenu(screenX: number, screenY: number): void {
        this.closeContextMenu();
        if (this.contextMenuEntries.length === 0) return;

        const wrappedEntries: MenuEntry[] = this.contextMenuEntries.map((entry) => {
            if (entry.type === "separator") return entry;
            const original = entry.onSelect;
            return {
                ...entry,
                onSelect: () => {
                    this.closeContextMenu();
                    original?.();
                },
            };
        });

        const menu = new PopupMenuElement(wrappedEntries);
        if (this.menuTheme) {
            menu.applyTheme(this.menuTheme);
        }

        const layer = this.getOverlayLayer();
        if (!layer) return;

        let session: OverlaySessionHandle | null = null;
        session = layer.createSession(menu, new Point(screenX, screenY), {
            visible: true,
            closeOnEscape: true,
            pointerPolicy: "close-on-outside",
            focusOnOpen: true,
            disposeOnClose: true,
            onClose: () => {
                /* v8 ignore start -- the `!==` else is unreachable: openContextMenu disposes (not closes) any prior session before reassigning, so a session's onClose only fires while it is still the active one */
                if (this.activeContextMenuSession === session) {
                    this.activeContextMenuSession = null;
                }
                /* v8 ignore stop */
            },
        });

        menu.onClose = () => {
            session.close();
        };

        this.activeContextMenuSession = session;
    }

    private closeContextMenu(): void {
        if (!this.activeContextMenuSession) return;
        const session = this.activeContextMenuSession;
        this.activeContextMenuSession = null;
        session.dispose();
    }

    private getOverlayLayer() {
        const root = this.getRoot();
        if (!root) return null;
        return (root as BodyElement).overlayLayer;
    }

    private handleMouseMove(event: TUIMouseEvent): void {
        if (this.dragAnchor === null) return;
        /* v8 ignore start -- unreachable: getViewLineCount() is never 0 (document always has a line; fold headers stay visible) */
        if (this.viewState.getViewLineCount() === 0) return;
        /* v8 ignore stop */

        const pos = this.screenToDocPosition(event.localX, event.localY);
        this.viewState.selections = [
            createSelection(this.dragAnchor.line, this.dragAnchor.character, pos.line, pos.character),
        ];
    }

    private handleKeyDown(event: TUIKeyboardEvent): void {
        if (event.key === "Tab" && !event.ctrlKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            if (!event.shiftKey) {
                const indent = this.viewState.insertSpaces ? " ".repeat(this.viewState.tabSize) : "\t";
                this.pushUndo(this.viewState.type(indent));
            }
        }
    }

    private handleKeyPress(event: TUIKeyboardEvent): void {
        if (event.key === "Enter") {
            this.pushUndo(this.viewState.insertNewLine());
            return;
        }

        // Printable character: single char, no ctrl/alt/meta modifiers
        if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
            this.pushUndo(this.viewState.type(event.key));
            return;
        }
    }

    private handlePaste(event: TUIPasteEvent): void {
        // Insert the whole paste as one edit (newlines preserved) — one undo step.
        this.pushUndo(this.viewState.insertText(event.text));
    }

    private pushUndo(element: IUndoElement | undefined): void {
        /* v8 ignore start -- defensive: every caller passes the result of type(), which always returns an element; the undefined guard is never taken */
        if (element) {
            this.undoManager.pushUndoElement(element);
        }
        /* v8 ignore stop */
    }
}

function packStyleFlags(style: ResolvedTokenStyle): number {
    let flags = 0;
    if (style.bold) flags |= StyleFlags.Bold;
    if (style.italic) flags |= StyleFlags.Italic;
    if (style.underline) flags |= StyleFlags.Underline;
    if (style.strikethrough) flags |= StyleFlags.Strikethrough;
    return flags;
}

/**
 * Linear cursor over a sorted token array, optimised for left-to-right
 * scans (which is how the renderer walks columns). Falls back to binary
 * search when the offset rewinds.
 *
 * Exported for unit testing: the renderer only ever scans forward, so the
 * rewind path is unreachable through rendering alone.
 */
export class TokenIndex {
    private readonly tokens: readonly IToken[];
    private readonly lineLength: number;
    private cursor = 0;

    public constructor(lineTokens: ILineTokens, lineLength: number) {
        this.tokens = lineTokens.tokens;
        this.lineLength = lineLength;
    }

    /** Token covering `[token.startIndex .. nextToken.startIndex)` for `offset`. */
    public tokenAt(offset: number): IToken | undefined {
        if (this.tokens.length === 0 || offset >= this.lineLength) return undefined;

        // Fast path: forward scan.
        let i = this.cursor;
        if (i >= this.tokens.length || this.tokens[i].startIndex > offset) {
            i = 0; // rewind
        }
        while (i + 1 < this.tokens.length && this.tokens[i + 1].startIndex <= offset) {
            i++;
        }
        this.cursor = i;
        return this.tokens[i];
    }
}
