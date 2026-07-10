import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { EndOfLine } from "../Editor/EndOfLine.ts";
import type { IDocumentLanguageChange } from "../Editor/IDocumentLanguageChange.ts";
import type { IRange } from "../Editor/IRange.ts";
import { createRange } from "../Editor/IRange.ts";
import type { ISaveEdit, ISaveSnapshot, SaveParticipant } from "../Editor/ISaveParticipant.ts";
import type { ITextEdit } from "../Editor/ITextEdit.ts";
import { createTextEdit } from "../Editor/ITextEdit.ts";
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
import type { OverlayAnchorPosition } from "../TUIDom/Widgets/OverlayLayer.ts";
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
    private eolSubscription: IDisposable | null = null;
    private eolChangeListeners: (() => void)[] = [];
    private filePath: string | null = null;
    private savedVersionId = 0;
    private savedEol: EndOfLine;
    private readonly tokenizationRegistry: TokenizationRegistry;
    private readonly tokenStyleResolver: ITokenStyleResolver;
    private readonly languageService: ILanguageService;
    private readonly undoRedoService: UndoRedoService;
    private contextMenuEntriesValue: MenuEntry[] = [];
    private currentTheme: WorkbenchTheme | null = null;

    public get isModified(): boolean {
        return this.doc.versionId !== this.savedVersionId || this.doc.eol !== this.savedEol;
    }

    public get eol(): EndOfLine {
        return this.doc.eol;
    }

    public set contextMenuEntries(entries: MenuEntry[]) {
        this.contextMenuEntriesValue = entries;
        this.editor.contextMenuEntries = entries;
    }

    public onDidSave?: () => void;

    /**
     * Save-участник (`onWillSaveTextDocument`): вызывается перед записью на диск,
     * возвращает undoable-правки (trim/insert-final-newline/EOL из editorconfig).
     * Инъектируется извне (EditorGroupController ← host/харнесс); ядро не знает
     * про extension-слой. Не задан ⇒ save остаётся синхронным.
     */
    public saveParticipant?: SaveParticipant;

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
     * Экранный якорь каретки для completion-попапа, или `null`, если каретка вне
     * видимой области. Делегирует в {@link EditorElement.getCaretScreenCell}.
     */
    public getCaretAnchor(): OverlayAnchorPosition | null {
        const cell = this.editor.getCaretScreenCell();
        if (cell === null) return null;
        return { screenX: cell.x, screenY: cell.y, preferBelow: true };
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

    /**
     * Событие смены EOL документа (командой, undo/redo — любым путём через
     * doc.setEol). Подписка живёт на контроллере, а не на конкретном
     * документе — переживает пересоздание документа в openFile.
     */
    public onDidChangeEol(listener: () => void): IDisposable {
        this.eolChangeListeners.push(listener);
        return {
            dispose: () => {
                const i = this.eolChangeListeners.indexOf(listener);
                if (i >= 0) this.eolChangeListeners.splice(i, 1);
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
        this.savedEol = this.doc.eol;
        this.editorViewState = new EditorViewState(this.doc);
        this.tokenStore = new DocumentTokenStore(this.doc, this.pickTokenizerForLanguage(this.doc.languageId));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.attachUndoRouting();
        this.view = new ScrollBarDecorator(this.editor);
        this.bindDocumentListeners();

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
                this.eolSubscription?.dispose();
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
        this.editor.menuTheme = this.currentTheme;
        this.attachUndoRouting();
        this.view.setChild(this.editor);
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
        this.bindDocumentListeners();
    }

    public async save(): Promise<void> {
        if (this.filePath === null) return;
        // Когда участник не задан — до writeFileSync нет ни одного await, запись
        // остаётся синхронной в текущем тике (вызовы save() без await работают).
        const participant = this.saveParticipant;
        if (participant !== undefined) {
            await this.runSaveParticipant(participant, this.filePath);
        }
        fs.writeFileSync(this.filePath, this.doc.serialize(), "utf-8");
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
        this.onDidSave?.();
    }

    /**
     * Собирает снапшот, дожидается участника и применяет вернувшиеся правки к
     * буферу (undoable) до записи. Выделено, чтобы переиспользовать в saveAs.
     */
    private async runSaveParticipant(participant: SaveParticipant, fileName: string): Promise<void> {
        const snapshot: ISaveSnapshot = {
            fileName,
            languageId: this.doc.languageId,
            versionId: this.doc.versionId,
            isDirty: this.isModified,
            text: this.doc.getText(),
            eol: this.doc.eol,
        };
        const edits = await participant(snapshot);
        this.applySaveEdits(edits);
    }

    /**
     * Применяет правки save-участника. Текстовые правки клампятся к текущим
     * границам документа (во время await пользователь мог печатать) и уходят
     * одним undoable-батчем; смена EOL — отдельным undoable-элементом (setEol).
     */
    private applySaveEdits(edits: readonly ISaveEdit[]): void {
        const textEdits: ITextEdit[] = [];
        for (const edit of edits) {
            if (edit.kind === "text") {
                textEdits.push(createTextEdit(this.clampRange(edit.range), edit.text));
            }
        }
        if (textEdits.length > 0) {
            this.applyExternalEdits(textEdits, "editorconfig: pre-save");
        }
        for (const edit of edits) {
            if (edit.kind === "eol") this.setEol(edit.eol);
        }
    }

    /** Ограничивает диапазон текущими границами документа (строки и колонки). */
    private clampRange(range: IRange): IRange {
        const start = this.clampPosition(range.start.line, range.start.character);
        const end = this.clampPosition(range.end.line, range.end.character);
        return createRange(start.line, start.character, end.line, end.character);
    }

    private clampPosition(line: number, character: number): { line: number; character: number } {
        const maxLine = this.doc.lineCount - 1;
        const clampedLine = line < 0 ? 0 : line > maxLine ? maxLine : line;
        const maxChar = this.doc.getLineLength(clampedLine);
        const clampedChar = character < 0 ? 0 : character > maxChar ? maxChar : character;
        return { line: clampedLine, character: clampedChar };
    }

    /**
     * Changes the document's end-of-line sequence. The change is undoable and
     * marks the editor dirty (EOL is tracked as a separate axis from content —
     * see {@link isModified}).
     */
    public setEol(eol: EndOfLine): void {
        const previous = this.doc.eol;
        if (previous === eol) return;

        const selections = this.editorViewState.cloneSelections();
        const version = this.doc.versionId;
        this.doc.setEol(eol);
        this.pushUndo({
            label: "Change End of Line Sequence",
            versionBefore: version,
            versionAfter: version,
            forwardEdits: [],
            backwardEdits: [],
            beforeSelections: selections,
            afterSelections: selections,
            eolBefore: previous,
            eolAfter: eol,
        });
        this.editor.markDirty();
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
    public async saveAs(newPath: string): Promise<void> {
        this.filePath = newPath;
        const participant = this.saveParticipant;
        if (participant !== undefined) {
            await this.runSaveParticipant(participant, newPath);
        }
        fs.writeFileSync(newPath, this.doc.serialize(), "utf-8");
        this.doc.setLanguage(this.resolveLanguageId(newPath));
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
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

    /**
     * Applies a programmatic batch of edits as a single undoable operation.
     *
     * A seam for edits that don't originate from user input — editor commands
     * (trim-trailing-whitespace, insert-final-newline) and, later, save
     * participants. Pushes an undo element (if anything changed) and repaints.
     * Document dirtiness follows automatically from the version bump.
     */
    public applyExternalEdits(edits: readonly ITextEdit[], label: string): void {
        this.pushUndo(this.editorViewState.applyEdits(edits, label));
        this.editor.markDirty();
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

    /** Logical line count of the open document. */
    public get lineCount(): number {
        return this.editorViewState.lineCount;
    }

    /** 0-based line of the primary cursor. */
    public get primaryCursorLine(): number {
        return this.editorViewState.primaryCursorLine;
    }

    /** 0-based character offset of the primary cursor. */
    public get primaryCursorColumn(): number {
        return this.editorViewState.primaryCursorColumn;
    }

    /**
     * Moves the primary cursor to (`line`, `column`) — both 0-based — clamping to
     * document bounds and revealing the target. Backs Go-to-Line navigation.
     */
    public goToPosition(line: number, column = 0): void {
        this.editorViewState.goToPosition(line, column);
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
        this.currentTheme = theme;
        const fg = theme.getColorOrDefault("editor.foreground", packRgb(212, 212, 212));
        const bg = theme.getColorOrDefault("editor.background", packRgb(30, 30, 30));
        this.editor.style = { fg, bg };
        this.editor.gutterBackground = theme.getColor("editorGutter.background") ?? bg;
        this.editor.lineNumberForeground = theme.getColor("editorLineNumber.foreground");
        this.editor.lineNumberActiveForeground = theme.getColor("editorLineNumber.activeForeground");
        this.editor.menuTheme = theme;
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
     * Переподписывается на события текущего документа (документ пересоздаётся
     * в openFile): на смену языка — пересаживает токенизатор, на смену EOL —
     * просто ретранслирует; оба события ретранслируются подписчикам контроллера.
     */
    private bindDocumentListeners(): void {
        this.languageSubscription?.dispose();
        this.languageSubscription = this.doc.onDidChangeLanguage((change) => {
            this.applyTokenizer();
            for (const listener of [...this.languageChangeListeners]) listener(change);
        });
        this.eolSubscription?.dispose();
        this.eolSubscription = this.doc.onDidChangeEol(() => {
            for (const listener of [...this.eolChangeListeners]) listener();
        });
    }
}
