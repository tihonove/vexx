import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import type { IFileWatcher } from "../Common/IFileWatcher.ts";
import type { Uri } from "../Common/Uri.ts";
import type { IGutterChangeDecoration } from "../Editor/Decorations/IGutterChangeDecoration.ts";
import type { EditorViewState } from "../Editor/EditorViewState.ts";
import type { EndOfLine } from "../Editor/EndOfLine.ts";
import type { IDocumentLanguageChange } from "../Editor/IDocumentLanguageChange.ts";
import type { IRange } from "../Editor/IRange.ts";
import type { SaveParticipant } from "../Editor/ISaveParticipant.ts";
import type { ITextEdit } from "../Editor/ITextEdit.ts";
import type { IUndoElement } from "../Editor/IUndoElement.ts";
import type { IMarkerDecoration } from "../Editor/Markers/IMarker.ts";
import type { OverlayAnchorPosition } from "../TUIDom/Widgets/OverlayLayer.ts";
import type { MenuEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import type { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";
import type { EditorComponent } from "../Workbench/Components/Editor/EditorComponent.ts";
import type { SaveOutcome, TextFileModel } from "../Workbench/Services/TextFile/TextFileModel.ts";

/**
 * Транзитная пара «модель + view-компонент» одного открытого редактора (этап 9a
 * Workbench-рефакторинга). Владеет временем жизни обоих и делегирует прежний
 * публичный API растворённого редактора-контроллера по принадлежности: файлово-модельное — в
 * {@link TextFileModel}, view-обвязочное — в {@link EditorComponent}. Держит
 * поверхность потребителей (AppController, экшены, Find/Completion, швы
 * Workbench, host-адаптеры) неизменной до этапа 9b (`EditorService` +
 * `EditorGroupComponent`), где пара растворится.
 */
export class EditorPane extends Disposable {
    public constructor(
        public readonly model: TextFileModel,
        public readonly component: EditorComponent,
    ) {
        super();
        this.register(component);
        this.register(model);
    }

    // ─── Модель: ресурс, dirty, save, оси encoding/EOL/language ────────────────

    public get uri(): Uri {
        return this.model.uri;
    }

    public get fileName(): string | null {
        return this.model.fileName;
    }

    public get absoluteFilePath(): string | null {
        return this.model.absoluteFilePath;
    }

    public get isModified(): boolean {
        return this.model.isModified;
    }

    public get eol(): EndOfLine {
        return this.model.eol;
    }

    public get encoding(): string {
        return this.model.encoding;
    }

    public get languageId(): string {
        return this.model.languageId;
    }

    public get hasDiskConflict(): boolean {
        return this.model.hasDiskConflict;
    }

    public get undoContext(): string {
        return this.model.undoContext;
    }

    public set onDidSave(callback: (() => void) | undefined) {
        this.model.onDidSave = callback;
    }

    public set fileWatcher(watcher: IFileWatcher | null) {
        this.model.fileWatcher = watcher;
    }

    public get saveParticipant(): SaveParticipant | undefined {
        return this.model.saveParticipant;
    }

    public set saveParticipant(participant: SaveParticipant | undefined) {
        this.model.saveParticipant = participant;
    }

    public setUntitled(untitledNumber: number): void {
        this.model.setUntitled(untitledNumber);
    }

    public openFile(uri: Uri): void {
        this.model.openFile(uri);
    }

    public save(options?: { overwrite?: boolean }): Promise<SaveOutcome> {
        return this.model.save(options);
    }

    public saveWithEncoding(encoding: string, options?: { overwrite?: boolean }): Promise<SaveOutcome> {
        return this.model.saveWithEncoding(encoding, options);
    }

    public saveAs(newPath: string): Promise<void> {
        return this.model.saveAs(newPath);
    }

    public revertToDisk(): boolean {
        return this.model.revertToDisk();
    }

    public reopenWithEncoding(encoding: string): boolean {
        return this.model.reopenWithEncoding(encoding);
    }

    public setEncoding(encoding: string): void {
        this.model.setEncoding(encoding);
    }

    public setEol(eol: EndOfLine): void {
        this.model.setEol(eol);
    }

    public setLanguage(languageId: string): void {
        this.model.setLanguage(languageId);
    }

    public getText(): string {
        return this.model.getText();
    }

    public applyExternalEdits(edits: readonly ITextEdit[], label: string): void {
        this.model.applyExternalEdits(edits, label);
    }

    public undo(): void {
        this.model.undo();
    }

    public redo(): void {
        this.model.redo();
    }

    public onDidChangeContent(listener: () => void): IDisposable {
        return this.model.onDidChangeContent(listener);
    }

    public onDidChangeLanguage(listener: (change: IDocumentLanguageChange) => void): IDisposable {
        return this.model.onDidChangeLanguage(listener);
    }

    public onDidChangeEol(listener: () => void): IDisposable {
        return this.model.onDidChangeEol(listener);
    }

    public onDidChangeEncoding(listener: () => void): IDisposable {
        return this.model.onDidChangeEncoding(listener);
    }

    public onDidChangeDiskState(listener: () => void): IDisposable {
        return this.model.onDidChangeDiskState(listener);
    }

    // ─── Компонент: view, курсор/скролл, декорации, folding ────────────────────

    public get view(): ScrollBarDecorator {
        return this.component.view;
    }

    public get viewState(): EditorViewState {
        return this.component.viewState;
    }

    public set contextMenuEntries(entries: MenuEntry[]) {
        this.component.contextMenuEntries = entries;
    }

    public onDidChangeCursorPosition(listener: () => void): IDisposable {
        return this.component.onDidChangeCursorPosition(listener);
    }

    public getCaretAnchor(): OverlayAnchorPosition | null {
        return this.component.getCaretAnchor();
    }

    public showContextMenu(): void {
        this.component.showContextMenu();
    }

    public focusEditor(): void {
        this.component.focus();
    }

    public pushUndo(element: IUndoElement | undefined): void {
        this.component.pushUndo(element);
    }

    public setIndentOptions(patch: { tabSize?: number; insertSpaces?: boolean }): void {
        this.component.setIndentOptions(patch);
    }

    public setOccurrenceHighlightEnabled(enabled: boolean): void {
        this.component.setOccurrenceHighlightEnabled(enabled);
    }

    public setCursorSurroundingLines(lines: number): void {
        this.component.setCursorSurroundingLines(lines);
    }

    public setSearchDecorations(matches: IRange[], currentIndex: number): void {
        this.component.setSearchDecorations(matches, currentIndex);
    }

    public setMarkerDecorations(decorations: readonly IMarkerDecoration[]): void {
        this.component.setMarkerDecorations(decorations);
    }

    public setGutterChangeDecorations(decorations: readonly IGutterChangeDecoration[]): void {
        this.component.setGutterChangeDecorations(decorations);
    }

    public revealRange(range: IRange): void {
        this.component.revealRange(range);
    }

    public get lineCount(): number {
        return this.component.lineCount;
    }

    public get primaryCursorLine(): number {
        return this.component.primaryCursorLine;
    }

    public get primaryCursorColumn(): number {
        return this.component.primaryCursorColumn;
    }

    public goToPosition(line: number, column = 0): void {
        this.component.goToPosition(line, column);
    }

    public foldAtCursor(): void {
        this.component.foldAtCursor();
    }

    public unfoldAtCursor(): void {
        this.component.unfoldAtCursor();
    }

    public toggleFoldAtCursor(): void {
        this.component.toggleFoldAtCursor();
    }

    public foldAll(): void {
        this.component.foldAll();
    }

    public unfoldAll(): void {
        this.component.unfoldAll();
    }

    public foldRecursivelyAtCursor(): void {
        this.component.foldRecursivelyAtCursor();
    }

    public unfoldRecursivelyAtCursor(): void {
        this.component.unfoldRecursivelyAtCursor();
    }

    public foldLevel(level: number): void {
        this.component.foldLevel(level);
    }

    public gotoNextFold(): void {
        this.component.gotoNextFold();
    }

    public gotoPreviousFold(): void {
        this.component.gotoPreviousFold();
    }
}
