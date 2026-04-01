import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { ScrollContainerElement } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import type { IController } from "./IController.ts";

export const EditorControllerDIToken = token<EditorController>("EditorController");

export class EditorController extends Disposable implements IController {
    public static dependencies = [] as const;

    public readonly view: ScrollContainerElement;

    private doc: TextDocument;
    private viewState: EditorViewState;
    private editor: EditorElement;
    private filePath: string | null = null;
    private savedVersionId = 0;

    public get isModified(): boolean {
        return this.doc.versionId !== this.savedVersionId;
    }

    public get fileName(): string | null {
        return this.filePath ? path.basename(this.filePath) : null;
    }

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
        this.savedVersionId = this.doc.versionId;
    }

    public save(): void {
        if (this.filePath === null) return;
        fs.writeFileSync(this.filePath, this.doc.getText(), "utf-8");
        this.savedVersionId = this.doc.versionId;
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
