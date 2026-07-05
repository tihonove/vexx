import type { EndOfLine } from "./EndOfLine.ts";
import type { ISelection } from "./ISelection.ts";
import type { ITextEdit } from "./ITextEdit.ts";

export interface IUndoElement {
    readonly label: string;
    readonly versionBefore: number;
    readonly versionAfter: number;
    readonly forwardEdits: readonly ITextEdit[];
    readonly backwardEdits: readonly ITextEdit[];
    readonly beforeSelections: readonly ISelection[];
    readonly afterSelections: readonly ISelection[];
    /**
     * End-of-line sequence to restore when this element is undone. Present only
     * for elements that change the document's EOL. `undo` restores
     * {@link eolBefore}; the mirrored redo element restores {@link eolAfter}.
     */
    readonly eolBefore?: EndOfLine;
    readonly eolAfter?: EndOfLine;
}
