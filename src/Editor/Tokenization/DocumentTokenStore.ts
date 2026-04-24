import { Disposable } from "../../Common/Disposable.ts";
import type { IDocumentContentChange } from "../IDocumentContentChange.ts";
import type { ILineTokens } from "../ILineTokens.ts";
import { createLineTokens, createToken } from "../ILineTokens.ts";
import type { ITextDocument } from "../ITextDocument.ts";

import type { IState } from "./IState.ts";
import type { ITokenizationSupport } from "./ITokenizationSupport.ts";

const EMPTY_LINE_TOKENS: ILineTokens = createLineTokens([createToken(0, [])]);

/**
 * Per-document cache of line tokens.
 *
 * Subscribes to {@link ITextDocument.onDidChangeContent}: shifts cached entries
 * for inserted/deleted lines and marks the first dirty line via
 * {@link invalidLineIndex}. Tokenization itself runs lazily on demand via
 * {@link tokenizeUpTo} (synchronously in the MVP — chunked / async runs can
 * be layered on top later).
 */
export class DocumentTokenStore extends Disposable {
    private readonly document: ITextDocument;
    private support: ITokenizationSupport;

    private cachedTokens: (ILineTokens | undefined)[] = [];
    private endStates: (IState | undefined)[] = [];
    private invalidLineIndexInternal = 0;

    public constructor(document: ITextDocument, support: ITokenizationSupport) {
        super();
        this.document = document;
        this.support = support;

        this.cachedTokens.length = document.lineCount;
        this.endStates.length = document.lineCount;
        this.invalidLineIndexInternal = 0;

        this.register(
            document.onDidChangeContent((change) => {
                this.handleContentChange(change);
            }),
        );
    }

    /**
     * First line whose cached tokens are stale (or never computed).
     * Anything below this index may also be stale even if cached — see
     * the end-state optimisation in {@link tokenizeUpTo}.
     */
    public get invalidLineIndex(): number {
        return this.invalidLineIndexInternal;
    }

    /**
     * Replaces the active tokenizer (e.g. when a new language is detected).
     * Invalidates the entire cache.
     */
    public setTokenizationSupport(support: ITokenizationSupport): void {
        this.support = support;
        this.cachedTokens.length = 0;
        this.cachedTokens.length = this.document.lineCount;
        this.endStates.length = 0;
        this.endStates.length = this.document.lineCount;
        this.invalidLineIndexInternal = 0;
    }

    /** Returns cached tokens for `line`, or `undefined` if not yet tokenized. */
    public getLineTokens(line: number): ILineTokens | undefined {
        if (line < 0 || line >= this.document.lineCount) return undefined;
        return this.cachedTokens[line];
    }

    /**
     * Externally-supplied tokens (e.g. from an LSP semantic-tokens response,
     * or tests). Bypasses the registered ITokenizationSupport for that line.
     * Does NOT update {@link invalidLineIndex}, so subsequent `tokenizeUpTo`
     * may still re-tokenize earlier dirty lines and overwrite this entry —
     * call after edits, not before.
     */
    public setLineTokens(line: number, tokens: ILineTokens): void {
        if (line < 0 || line >= this.document.lineCount) return;
        this.cachedTokens[line] = tokens;
    }

    /**
     * Synchronously tokenizes lines `[invalidLineIndex .. targetLine]` (inclusive).
     *
     * If a freshly-computed end state matches the previously cached one, we
     * stop early — subsequent lines are guaranteed to produce the same tokens.
     * This is the standard TextMate optimisation.
     */
    public tokenizeUpTo(targetLine: number): void {
        const last = Math.min(targetLine, this.document.lineCount - 1);
        if (last < this.invalidLineIndexInternal) return;

        let line = this.invalidLineIndexInternal;
        let state = line === 0 ? this.support.getInitialState() : (this.endStates[line - 1] ?? this.support.getInitialState());

        for (; line <= last; line++) {
            const text = this.document.getLineContent(line);
            const result = this.support.tokenizeLine(text, state);
            this.cachedTokens[line] = result.tokens;
            const previousEndState = this.endStates[line];
            this.endStates[line] = result.endState;
            state = result.endState;

            if (previousEndState && previousEndState.equals(result.endState)) {
                // Subsequent lines were already tokenized starting from this same
                // end state, so their cached tokens are still valid — jump to EOF.
                this.invalidLineIndexInternal = this.document.lineCount;
                return;
            }
        }

        this.invalidLineIndexInternal = Math.max(this.invalidLineIndexInternal, line);
    }

    /** For tests: the cached end state of `line` (after tokenization). */
    public getEndState(line: number): IState | undefined {
        return this.endStates[line];
    }

    private handleContentChange(change: IDocumentContentChange): void {
        const { startLine, oldEndLine, newEndLine } = change;
        const lineDelta = newEndLine - oldEndLine;

        if (lineDelta > 0) {
            // Insert `lineDelta` empty slots after `oldEndLine`.
            const placeholderTokens: (ILineTokens | undefined)[] = new Array(lineDelta).fill(undefined);
            const placeholderStates: (IState | undefined)[] = new Array(lineDelta).fill(undefined);
            this.cachedTokens.splice(oldEndLine + 1, 0, ...placeholderTokens);
            this.endStates.splice(oldEndLine + 1, 0, ...placeholderStates);
        } else if (lineDelta < 0) {
            // Remove `-lineDelta` slots from the end of the changed region.
            this.cachedTokens.splice(newEndLine + 1, -lineDelta);
            this.endStates.splice(newEndLine + 1, -lineDelta);
        }

        // Invalidate cached tokens for every line that is now part of the changed region.
        // The endState of the FIRST line beyond the changed region is intentionally
        // kept intact so that {@link tokenizeUpTo} can detect convergence
        // (newEndState.equals(previousEndState)) once it reaches it and stop early.
        for (let i = startLine; i <= newEndLine && i < this.cachedTokens.length; i++) {
            this.cachedTokens[i] = undefined;
            this.endStates[i] = undefined;
        }

        if (startLine < this.invalidLineIndexInternal) {
            this.invalidLineIndexInternal = startLine;
        }
        if (this.invalidLineIndexInternal > this.document.lineCount) {
            this.invalidLineIndexInternal = this.document.lineCount;
        }
    }

    /**
     * Returns a single token spanning the whole line with empty scopes.
     * Useful as a typed fallback when a renderer asks for tokens before
     * {@link tokenizeUpTo} has been called.
     */
    public static emptyLineTokens(): ILineTokens {
        return EMPTY_LINE_TOKENS;
    }
}
