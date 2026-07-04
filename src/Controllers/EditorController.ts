import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import type { IDocumentLanguageChange } from "../Editor/IDocumentLanguageChange.ts";
import type { IRange } from "../Editor/IRange.ts";
import type { IUndoElement } from "../Editor/IUndoElement.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { PlainTextTokenizer } from "../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "../Editor/Tokenization/DocumentTokenStore.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import type { ITokenizationSupport } from "../Editor/Tokenization/ITokenizationSupport.ts";
import type { ITokenStyleResolver } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { MenuEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { LanguageServiceDIToken, TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "./CoreTokens.ts";
import type { IController } from "./IController.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "./Workspace/UndoRedoService.ts";

export const EditorControllerDIToken = token<EditorController>("EditorController");

export class EditorController extends Disposable implements IController {
    public static dependencies = [
        ThemeServiceDIToken,
        TokenizationRegistryDIToken,
        TokenStyleResolverDIToken,
        LanguageServiceDIToken,
        UndoRedoServiceDIToken,
    ] as const;

    public readonly view: ScrollBarDecorator;

    public get viewState(): EditorViewState {
        return this.editorViewState;
    }

    private doc: TextDocument;
    private editorViewState: EditorViewState;
    private editor: EditorElement;
    private tokenStore: DocumentTokenStore;
    private languageSubscription: IDisposable | null = null;
    private languageChangeListeners: ((change: IDocumentLanguageChange) => void)[] = [];
    private filePath: string | null = null;
    private savedVersionId = 0;
    private readonly tokenizationRegistry: TokenizationRegistry;
    private readonly tokenStyleResolver: ITokenStyleResolver;
    private readonly languageService: ILanguageService;
    private readonly undoRedoService: UndoRedoService;
    private contextMenuEntriesValue: MenuEntry[] = [];

    public get isModified(): boolean {
        return this.doc.versionId !== this.savedVersionId;
    }

    public set contextMenuEntries(entries: MenuEntry[]) {
        this.contextMenuEntriesValue = entries;
        this.editor.contextMenuEntries = entries;
    }

    public onDidSave?: () => void;

    public onDidChangeContent(listener: () => void): IDisposable {
        return this.doc.onDidChangeContent(listener);
    }

    public onDidChangeCursorPosition(listener: () => void): IDisposable {
        return this.editorViewState.onDidChangeCursorPosition(listener);
    }

    /** Language id открытого документа (`plaintext`, если язык не определён). */
    public get languageId(): string {
        return this.doc.languageId;
    }

    /**
     * Меняет язык документа вручную (закладка под будущий language picker,
     * аналог `editor.action.changeLanguage` из VS Code). Токенизатор
     * пересаживается автоматически через подписку на doc.onDidChangeLanguage.
     */
    public setLanguage(languageId: string): void {
        this.doc.setLanguage(languageId);
    }

    /**
     * Событие смены языка документа. Подписка живёт на контроллере, а не на
     * конкретном документе — переживает пересоздание документа в openFile.
     */
    public onDidChangeLanguage(listener: (change: IDocumentLanguageChange) => void): IDisposable {
        this.languageChangeListeners.push(listener);
        return {
            dispose: () => {
                const i = this.languageChangeListeners.indexOf(listener);
                if (i >= 0) this.languageChangeListeners.splice(i, 1);
            },
        };
    }

    public get fileName(): string | null {
        return this.filePath ? path.basename(this.filePath) : null;
    }

    public get absoluteFilePath(): string | null {
        return this.filePath;
    }

    public constructor(
        themeService: ThemeService,
        tokenizationRegistry: TokenizationRegistry,
        tokenStyleResolver: ITokenStyleResolver,
        languageService: ILanguageService,
        undoRedoService: UndoRedoService,
    ) {
        super();

        this.tokenizationRegistry = tokenizationRegistry;
        this.tokenStyleResolver = tokenStyleResolver;
        this.languageService = languageService;
        this.undoRedoService = undoRedoService;

        this.doc = new TextDocument("");
        this.editorViewState = new EditorViewState(this.doc);
        this.tokenStore = new DocumentTokenStore(this.doc, this.pickTokenizerForLanguage(this.doc.languageId));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.attachUndoRouting();
        this.view = new ScrollBarDecorator(this.editor);
        this.bindLanguageListener();

        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
        // Грамматики регистрируются асинхронно (ExtensionTokenizationContributor)
        // и могут появиться уже после открытия файла — тогда пересаживаем
        // документ с fallback-токенизатора на настоящий.
        this.register(
            tokenizationRegistry.onDidChange((languageId) => {
                if (languageId === this.doc.languageId) this.applyTokenizer();
            }),
        );
        this.register({
            dispose: () => {
                this.languageSubscription?.dispose();
            },
        });
        // Очищаем историю отмены этого файла при закрытии вкладки.
        this.register({ dispose: () => this.undoRedoService.clear(this.undoContext()) });
    }

    public openFile(filePath: string): void {
        this.filePath = filePath;
        const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
        this.doc = new TextDocument(content, this.resolveLanguageId(filePath));
        this.editorViewState = new EditorViewState(this.doc);
        this.tokenStore.dispose();
        this.tokenStore = new DocumentTokenStore(this.doc, this.pickTokenizerForLanguage(this.doc.languageId));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = this.tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.editor.contextMenuEntries = this.contextMenuEntriesValue;
        this.attachUndoRouting();
        this.view.setChild(this.editor);
        this.savedVersionId = this.doc.versionId;
        this.bindLanguageListener();
    }

    public save(): void {
        if (this.filePath === null) return;
        fs.writeFileSync(this.filePath, this.doc.getText(), "utf-8");
        this.savedVersionId = this.doc.versionId;
        this.onDidSave?.();
    }

    /**
     * Writes the document to a new path and re-points the editor to it.
     *
     * Unlike {@link openFile}, the document/view-state/undo-history/cursor are
     * preserved. The language is re-resolved for the new extension; the bound
     * language listener re-tokenizes and repaints automatically. Firing
     * `onDidSave` lets the group controller rename the tab and clear the dirty
     * marker.
     */
    public saveAs(newPath: string): void {
        this.filePath = newPath;
        fs.writeFileSync(newPath, this.doc.getText(), "utf-8");
        this.doc.setLanguage(this.resolveLanguageId(newPath));
        this.savedVersionId = this.doc.versionId;
        this.onDidSave?.();
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
        void this.undoRedoService.undo(this.undoContext());
    }

    public redo(): void {
        void this.undoRedoService.redo(this.undoContext());
    }

    /** Контекст-бакет истории отмены для этого редактора (путь файла). */
    private undoContext(): string {
        return this.filePath ?? "untitled";
    }

    /**
     * Подключает текущий редактор к общей истории: каждый шаг `UndoManager` регистрирует
     * обёртку в `UndoRedoService` под контекстом этого файла. Обёртка — токен порядка:
     * её undo/redo делегируют в `UndoManager` (LIFO 1:1, поэтому стеки идут в ногу).
     */
    private attachUndoRouting(): void {
        const editor = this.editor;
        editor.undoManager.onDidPush = (element) => {
            const resource = this.undoContext();
            this.undoRedoService.pushElement(
                {
                    label: element.label,
                    resources: [resource],
                    undo: () => {
                        editor.undoManager.undo();
                        editor.markDirty();
                    },
                    redo: () => {
                        editor.undoManager.redo();
                        editor.markDirty();
                    },
                },
                resource,
            );
        };
    }

    /**
     * Применяет к view-state'у редактора частичный набор настроек indent.
     * После изменений принудительно отключает auto-detect (если расширение
     * выставило размер таба, оно знает, что делает) и помечает редактор
     * dirty, чтобы изменения отрисовались в следующем кадре.
     */
    public setIndentOptions(patch: { tabSize?: number; insertSpaces?: boolean }): void {
        let changed = false;
        if (patch.tabSize !== undefined && patch.tabSize > 0 && this.editorViewState.tabSize !== patch.tabSize) {
            this.editorViewState.tabSize = patch.tabSize;
            changed = true;
        }
        if (patch.insertSpaces !== undefined && this.editorViewState.insertSpaces !== patch.insertSpaces) {
            this.editorViewState.insertSpaces = patch.insertSpaces;
            changed = true;
        }
        if (changed) {
            this.editorViewState.detectIndentation = false;
            this.editor.markDirty();
        }
    }

    /**
     * Sets the search-match decorations rendered by the editor and repaints.
     * `currentIndex` is the active match (highlighted distinctly), or -1.
     */
    public setSearchDecorations(matches: IRange[], currentIndex: number): void {
        this.editorViewState.searchMatches = matches;
        this.editorViewState.currentSearchMatchIndex = currentIndex;
        this.editor.markDirty();
    }

    /** Scrolls a range into view (expanding folds if needed) and repaints. */
    public revealRange(range: IRange): void {
        this.editorViewState.revealRange(range);
        this.editor.markDirty();
    }

    /* v8 ignore start -- placeholder lifecycle hook; editor-specific subscriptions are added later */
    public mount(): void {
        // Future: subscribe to editor-specific events
    }
    /* v8 ignore stop */

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
     * Language detection is delegated to the {@link ILanguageService}
     * (implemented by `LanguageRegistry` from the Extensions layer).
     */
    private resolveLanguageId(filePath: string): string {
        return this.languageService.getLanguageIdForResource(filePath) ?? "plaintext";
    }

    private pickTokenizerForLanguage(languageId: string): ITokenizationSupport {
        return this.tokenizationRegistry.get(languageId) ?? new PlainTextTokenizer();
    }

    /** Пересаживает токен-кеш текущего документа на актуальный токенизатор. */
    private applyTokenizer(): void {
        this.tokenStore.setTokenizationSupport(this.pickTokenizerForLanguage(this.doc.languageId));
        this.editor.markDirty();
    }

    /**
     * Переподписывается на смену языка текущего документа (документ
     * пересоздаётся в openFile): пересаживает токенизатор и ретранслирует
     * событие подписчикам контроллера.
     */
    private bindLanguageListener(): void {
        this.languageSubscription?.dispose();
        this.languageSubscription = this.doc.onDidChangeLanguage((change) => {
            this.applyTokenizer();
            for (const listener of [...this.languageChangeListeners]) listener(change);
        });
    }
}
