/**
 * End-of-line sequence used when a document is serialized to disk.
 *
 * Numeric values match the VS Code public `EndOfLine` enum (LF = 1, CRLF = 2),
 * which keeps a future extension-bridge mapping trivial. Internally documents
 * always store line content without terminators (LF-canonical); the EOL is a
 * separate axis applied only at the disk boundary.
 */
export enum EndOfLine {
    LF = 1,
    CRLF = 2,
}

/** Maps an {@link EndOfLine} to the concrete character sequence. */
export function eolToSequence(eol: EndOfLine): "\n" | "\r\n" {
    return eol === EndOfLine.CRLF ? "\r\n" : "\n";
}

/**
 * Detects the prevailing end-of-line sequence in raw text.
 *
 * Counts `\r\n` versus lone `\n`; the majority wins. Ties and text without any
 * line breaks resolve to {@link EndOfLine.LF}.
 */
export function detectEndOfLine(text: string): EndOfLine {
    let crlf = 0;
    let index = text.indexOf("\r\n");
    while (index !== -1) {
        crlf++;
        index = text.indexOf("\r\n", index + 2);
    }

    let totalLf = 0;
    index = text.indexOf("\n");
    while (index !== -1) {
        totalLf++;
        index = text.indexOf("\n", index + 1);
    }

    const loneLf = totalLf - crlf;
    return crlf > loneLf ? EndOfLine.CRLF : EndOfLine.LF;
}
