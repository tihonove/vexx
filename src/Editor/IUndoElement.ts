import type { ITextEdit } from "./ITextEdit.ts";
import type { ISelection } from "./ISelection.ts";

export interface IUndoElement {
    readonly label: string;
    readonly versionBefore: number;
    readonly versionAfter: number;
    readonly forwardEdits: readonly ITextEdit[];
    readonly backwardEdits: readonly ITextEdit[];
    readonly beforeSelections: readonly ISelection[];
    readonly afterSelections: readonly ISelection[];
}
