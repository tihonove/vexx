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
}
