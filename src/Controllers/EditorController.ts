import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import type { IUndoElement } from "../Editor/IUndoElement.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { DocumentTokenStore } from "../Editor/Tokenization/DocumentTokenStore.ts";
import { PlainTextTokenizer } from "../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import type { ITokenizationSupport } from "../Editor/Tokenization/ITokenizationSupport.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "./CoreTokens.ts";
import type { IController } from "./IController.ts";
import type { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import type { ITokenStyleResolver } from "../Editor/Tokenization/ITokenStyleResolver.ts";

export const EditorControllerDIToken = token<EditorController>("EditorController");

export class EditorController extends Disposable implements IController {
    public static dependencies = [
        ThemeServiceDIToken,
        TokenizationRegistryDIToken,
        TokenStyleResolverDIToken,
    ] as const;

    public readonly view: ScrollBarDecorator;

    public get viewState(): EditorViewState {
        return this.editorViewState;
    }

    private doc: TextDocument;
    private editorViewState: EditorViewState;
    private editor: EditorElement;
    private tokenStore: DocumentTokenStore;
    private filePath: string | null = null;
    private savedVersionId = 0;
    private readonly tokenizationRegistry: TokenizationRegistry;
    private readonly tokenStyleResolver: ITokenStyleResolver;

    public get isModified(): boolean {
        return this.doc.versionId !== this.savedVersionId;
    }

    public get fileName(): string | null {
        return this.filePath ? path.basename(this.filePath) : null;
    }

    public constructor(
        themeService: ThemeService,
        tokenizationRegistry: TokenizationRegistry,
        tokenStyleResolver: ITokenStyleResolver,
    ) {
        super();

        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;

        this.doc = new TextDocument("");
        this.editorViewState = new EditorViewState(this.doc);
        this.tokenStore = new DocumentTokenStore(this.doc, this.pickTokenizer(null));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.view = new ScrollBarDecorator(this.editor);

        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public openFile(filePath: string): void {
        this.filePath = filePath;
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
        this.doc = new TextDocument(content);
        this.editorViewState = new EditorViewState(this.doc);
        this.tokenStore.dispose();
        this.tokenStore = new DocumentTokenStore(this.doc, this.pickTokenizer(filePath));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = this.tokenStyleResolver;
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

    public pushUndo(element: IUndoElement | undefined): void {
        if (element) {
            this.editor.undoManager.pushUndoElement(element);
        }
    }

    public undo(): void {
        this.editor.undoManager.undo();
    }

    public redo(): void {
        this.editor.undoManager.redo();
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

    private applyTheme(theme: WorkbenchTheme): void {
        const fg = theme.getColorOrDefault("editor.foreground", packRgb(212, 212, 212));
        const bg = theme.getColorOrDefault("editor.background", packRgb(30, 30, 30));
        this.editor.style = { fg, bg };
        this.editor.gutterBackground = theme.getColor("editorGutter.background") ?? bg;
        this.editor.lineNumberForeground = theme.getColor("editorLineNumber.foreground");
        this.editor.lineNumberActiveForeground = theme.getColor("editorLineNumber.activeForeground");
    }

    /**
     * Picks a tokenizer based on the file extension. Temporary glue — a
     * dedicated language detection service will own this concern later.
     */
    private pickTokenizer(filePath: string | null): ITokenizationSupport {
        const ext = filePath ? path.extname(filePath).toLowerCase() : "";
        const languageId = ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx"
            ? "javascript"
            : "plaintext";
        return this.tokenizationRegistry.get(languageId) ?? new PlainTextTokenizer();
    }
}
