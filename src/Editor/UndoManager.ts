import type { EditorViewState } from "./EditorViewState.ts";
import type { ISelection } from "./ISelection.ts";
import type { ITextDocument } from "./ITextDocument.ts";
import type { ITextEdit } from "./ITextEdit.ts";
import type { IUndoElement } from "./IUndoElement.ts";

interface MutableUndoElement {
    label: string;
    versionBefore: number;
    versionAfter: number;
    forwardEdits: readonly ITextEdit[];
    backwardEdits: readonly ITextEdit[];
    beforeSelections: readonly ISelection[];
    afterSelections: readonly ISelection[];
}

export class UndoManager {
    private undoStack: MutableUndoElement[] = [];
    private redoStack: MutableUndoElement[] = [];
    private readonly doc: ITextDocument;
    private readonly viewState: EditorViewState;

    public constructor(doc: ITextDocument, viewState: EditorViewState) {
        this.doc = doc;
        this.viewState = viewState;
    }

    public get canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    public get canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    public pushUndoElement(element: IUndoElement): void {
        this.undoStack.push({ ...element });
        this.redoStack.length = 0;
    }

    public undo(): boolean {
        const element = this.undoStack.pop();
        if (!element) return false;

        if (this.doc.versionId !== element.versionAfter) {
            return false;
        }

        const { appliedVersion, inverseEdits } = this.doc.applyEdits(element.backwardEdits);
        this.viewState.restoreSelections(element.beforeSelections);

        this.redoStack.push({
            label: element.label,
            versionBefore: element.versionAfter,
            versionAfter: appliedVersion,
            forwardEdits: element.backwardEdits,
            backwardEdits: inverseEdits,
            beforeSelections: element.afterSelections,
            afterSelections: element.beforeSelections,
        });

        // The next element on the undo stack now needs its versionAfter updated
        // because the document version changed due to the undo operation
        if (this.undoStack.length > 0) {
            this.undoStack[this.undoStack.length - 1].versionAfter = appliedVersion;
        }

        return true;
    }

    public redo(): boolean {
        const element = this.redoStack.pop();
        if (!element) return false;

        if (this.doc.versionId !== element.versionAfter) {
            return false;
        }

        const { appliedVersion, inverseEdits } = this.doc.applyEdits(element.backwardEdits);
        this.viewState.restoreSelections(element.beforeSelections);

        this.undoStack.push({
            label: element.label,
            versionBefore: element.versionAfter,
            versionAfter: appliedVersion,
            forwardEdits: element.backwardEdits,
            backwardEdits: inverseEdits,
            beforeSelections: element.afterSelections,
            afterSelections: element.beforeSelections,
        });

        // Update the next redo element's versionAfter to match current doc version
        if (this.redoStack.length > 0) {
            this.redoStack[this.redoStack.length - 1].versionAfter = appliedVersion;
        }

        return true;
    }
}
