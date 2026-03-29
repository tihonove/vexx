import * as fs from "node:fs";

import { Disposable } from "../Common/Disposable.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { ScrollContainerElement } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import type { IController } from "./IController.ts";

export class EditorController extends Disposable implements IController {
    public readonly view: ScrollContainerElement;

    private doc: TextDocument;
    private viewState: EditorViewState;
    private editor: EditorElement;
    private filePath: string | null = null;

    public constructor() {
        super();

        this.doc = new TextDocument("");
        this.viewState = new EditorViewState(this.doc);
        this.editor = new EditorElement(this.viewState);
        this.editor.tabIndex = 0;
        this.view = new ScrollContainerElement(this.editor);
    }

    public openFile(filePath: string): void {
        this.filePath = filePath;
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
        this.doc = new TextDocument(content);
        this.viewState = new EditorViewState(this.doc);
        this.editor = new EditorElement(this.viewState);
        this.editor.tabIndex = 0;
        this.view.setChild(this.editor);
    }

    public save(): void {
        if (this.filePath === null) return;
        fs.writeFileSync(this.filePath, this.doc.getText(), "utf-8");
    }

    public getText(): string {
        return this.doc.getText();
    }

    public mount(): void {
        // Future: subscribe to editor-specific events
    }

    public async activate(): Promise<void> {
        // Future: LSP connection, syntax highlighting, etc.
    }

    public focusEditor(): void {
        this.editor.focus();
    }
}
