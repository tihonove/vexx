import * as fs from "node:fs";
import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { Uri } from "../Common/Uri.ts";
import { EditorElement } from "../Editor/EditorElement.ts";
import { EditorViewState } from "../Editor/EditorViewState.ts";
import { decodeBuffer, DEFAULT_ENCODING, encodeText, getEncodingInfo } from "../Editor/Encoding.ts";
import { EndOfLine } from "../Editor/EndOfLine.ts";
import type { IGutterChangeDecoration } from "../Editor/Decorations/IGutterChangeDecoration.ts";
import { computeIndentationFolds } from "../Editor/FoldingRangeProvider.ts";
import type { IDocumentLanguageChange } from "../Editor/IDocumentLanguageChange.ts";
import type { IRange } from "../Editor/IRange.ts";
import { createRange } from "../Editor/IRange.ts";
import type { ISaveEdit, ISaveSnapshot, SaveParticipant } from "../Editor/ISaveParticipant.ts";
import type { ITextEdit } from "../Editor/ITextEdit.ts";
import { createTextEdit } from "../Editor/ITextEdit.ts";
import type { IUndoElement } from "../Editor/IUndoElement.ts";
import type { IMarkerDecoration } from "../Editor/Markers/IMarker.ts";
import { TextDocument } from "../Editor/TextDocument.ts";
import { PlainTextTokenizer } from "../Editor/Tokenization/builtin/PlainTextTokenizer.ts";
import { DocumentTokenStore } from "../Editor/Tokenization/DocumentTokenStore.ts";
import type { ILanguageService } from "../Editor/Tokenization/ILanguageService.ts";
import type { ITokenizationSupport } from "../Editor/Tokenization/ITokenizationSupport.ts";
import type { ITokenStyleResolver } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import type { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { OverlayAnchorPosition } from "../TUIDom/Widgets/OverlayLayer.ts";
import type { MenuEntry } from "../TUIDom/Widgets/PopupMenuElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";

import { applyScrollBarTheme } from "./applyScrollBarTheme.ts";
import type { MenuColors } from "../TUIDom/Widgets/PopupMenuItemElement.tsx";
import { menuColorsFromTheme } from "./menuColorsFromTheme.ts";

import { LanguageServiceDIToken, TokenizationRegistryDIToken, TokenStyleResolverDIToken } from "./CoreTokens.ts";
import type { IController } from "./IController.ts";
import type { IFileWatcher } from "../Common/IFileWatcher.ts";
import { UndoRedoService, UndoRedoServiceDIToken } from "./Workspace/UndoRedoService.ts";

export const EditorControllerDIToken = token<EditorController>("EditorController");

/**
 * Итог сохранения. `conflict` — файл на диске изменился внешним процессом с
 * момента открытия/последней записи, и запись отменена (чтобы не затереть
 * параллельные правки); повторить с `{ overwrite: true }`.
 */
export type SaveOutcome = "saved" | "conflict" | "no-file";

/** Снимок метаданных файла на диске для детекта внешних изменений (mtime + размер). */
interface IDiskStat {
    mtimeMs: number;
    size: number;
}

/** Источник непрозрачных ключей истории отмены (см. {@link EditorController.undoContext}). */
let nextUndoContextId = 1;

/**
 * Ресурс свежесозданного редактора: безымянный буфер без номера. Номер назначает группа
 * ({@link EditorController.setUntitled}) — она владеет счётчиком; до этого редактора ещё
 * никто не видит.
 */
const UNTITLED_PLACEHOLDER_URI = Uri.from({ scheme: "untitled", path: "Untitled" });

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
    /**
     * Кодировка байтового представления на диске (id из SUPPORTED_ENCODINGS).
     * В отличие от EOL это состояние контроллера, а не документа: модель видит
     * только строки, а кодировка применяется на дисковой границе (read/write).
     * Не undoable и не входит в isModified — Reopen заменяет документ целиком,
     * Save with Encoding сохраняет сразу (как в VS Code).
     */
    private encodingValue: string = DEFAULT_ENCODING;
    private encodingChangeListeners: (() => void)[] = [];
    private contentSubscription: IDisposable | null = null;
    private contentChangeListeners: (() => void)[] = [];
    private foldingSubscription: IDisposable | null = null;
    private foldingRecomputeScheduled = false;
    private controllerDisposed = false;
    /**
     * Идентичность ресурса этого редактора — первичное состояние, из которого выводится
     * всё остальное (путь, имя, признак безымянности). Не `null`: у свежего редактора
     * это `untitled:`-буфер, а не «редактор без ресурса», поэтому ветку «пути нет»
     * задаёт схема, а не отсутствие значения.
     */
    private uriValue: Uri = UNTITLED_PLACEHOLDER_URI;
    private savedVersionId = 0;
    private savedEol: EndOfLine;
    /**
     * Метаданные файла на момент последнего чтения/записи. Сверяя их с текущим
     * stat, мы отличаем внешнее изменение файла от собственной записи и от
     * «файл не трогали». `null` — файла не было на диске при открытии.
     */
    private diskStat: IDiskStat | null = null;
    private diskConflictValue = false;
    private diskStateListeners: (() => void)[] = [];
    private fileWatch: IDisposable | null = null;
    private readonly tokenizationRegistry: TokenizationRegistry;
    private readonly tokenStyleResolver: ITokenStyleResolver;
    private readonly languageService: ILanguageService;
    private readonly undoRedoService: UndoRedoService;
    private contextMenuEntriesValue: MenuEntry[] = [];
    private currentMenuColors: MenuColors | null = null;

    public get isModified(): boolean {
        return this.doc.versionId !== this.savedVersionId || this.doc.eol !== this.savedEol;
    }

    public get eol(): EndOfLine {
        return this.doc.eol;
    }

    /** Кодировка, в которой документ читается с диска и пишется на диск. */
    public get encoding(): string {
        return this.encodingValue;
    }

    /**
     * Меняет кодировку, в которой документ будет записан на диск. Неизвестные
     * id игнорируются (пикеры оперируют только элементами SUPPORTED_ENCODINGS).
     * Содержимое буфера не трогает — перечитывание с диска делает
     * {@link reopenWithEncoding}.
     */
    public setEncoding(encoding: string): void {
        if (getEncodingInfo(encoding) === undefined) return;
        this.applyEncoding(encoding);
    }

    private applyEncoding(encoding: string): void {
        if (this.encodingValue === encoding) return;
        this.encodingValue = encoding;
        for (const listener of [...this.encodingChangeListeners]) listener();
    }

    public set contextMenuEntries(entries: MenuEntry[]) {
        this.contextMenuEntriesValue = entries;
        this.editor.contextMenuEntries = entries;
    }

    public onDidSave?: () => void;

    /**
     * Наблюдатель за файлами (инъектируется группой перед openFile). Когда задан,
     * контроллер следит за открытым файлом и реагирует на внешние изменения
     * (авто-перечитка чистого буфера, флаг конфликта для «грязного»). По
     * умолчанию `null` — без live-watch (юнит-тесты, если фейк не подставлен).
     */
    public fileWatcher: IFileWatcher | null = null;

    /**
     * `true`, если файл изменился на диске внешним процессом, а в буфере есть
     * несохранённые правки (авто-перечитать нельзя — затрём пользователя). При
     * следующем сохранении это приведёт к диалогу подтверждения перезаписи.
     */
    public get hasDiskConflict(): boolean {
        return this.diskConflictValue;
    }

    /**
     * Событие смены «дискового» состояния редактора: файл перечитан с диска
     * (чистый буфер) либо взведён/снят флаг конфликта. Подписка живёт на
     * контроллере и переживает пересоздание документа в openFile.
     */
    public onDidChangeDiskState(listener: () => void): IDisposable {
        this.diskStateListeners.push(listener);
        return {
            dispose: () => {
                const i = this.diskStateListeners.indexOf(listener);
                if (i >= 0) this.diskStateListeners.splice(i, 1);
            },
        };
    }

    /**
     * Save-участник (`onWillSaveTextDocument`): вызывается перед записью на диск,
     * возвращает undoable-правки (trim/insert-final-newline/EOL из editorconfig).
     * Инъектируется извне (EditorGroupController ← host/харнесс); ядро не знает
     * про extension-слой. Не задан ⇒ save остаётся синхронным.
     */
    public saveParticipant?: SaveParticipant;

    public onDidChangeContent(listener: () => void): IDisposable {
        this.contentChangeListeners.push(listener);
        return {
            dispose: () => {
                const i = this.contentChangeListeners.indexOf(listener);
                if (i >= 0) this.contentChangeListeners.splice(i, 1);
            },
        };
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
     * Открывает контекстное меню редактора с клавиатуры (Shift+F10), заякорив его на
     * каретке. Делегирует в {@link EditorElement.openContextMenuAtCaret}.
     */
    public showContextMenu(): void {
        this.editor.openContextMenuAtCaret();
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

    /**
     * Событие смены кодировки (setEncoding, reopenWithEncoding или детект при
     * открытии другого файла). Подписка живёт на контроллере.
     */
    public onDidChangeEncoding(listener: () => void): IDisposable {
        this.encodingChangeListeners.push(listener);
        return {
            dispose: () => {
                const i = this.encodingChangeListeners.indexOf(listener);
                if (i >= 0) this.encodingChangeListeners.splice(i, 1);
            },
        };
    }

    /** Идентичность ресурса: `file:` — файл на диске, `untitled:` — безымянный буфер. */
    public get uri(): Uri {
        return this.uriValue;
    }

    /**
     * Путь ресурса на диске или `null`, если его там нет (безымянный буфер).
     *
     * Гейт по схеме, а не по «`fsPath` непустой»: `fsPath` у не-file схемы не бросает,
     * а отдаёт путь как есть (`untitled:Untitled-1` → `"Untitled-1"`), и такой «путь»
     * ушёл бы в `node:fs` как относительный.
     */
    private get filePath(): string | null {
        return this.uriValue.scheme === "file" ? this.uriValue.fsPath : null;
    }

    public get fileName(): string | null {
        const filePath = this.filePath;
        return filePath === null ? null : path.basename(filePath);
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
        this.tokenStore = new DocumentTokenStore(this.doc, this.ensureTokenizerForLanguage(this.doc.languageId));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.attachUndoRouting();
        this.view = new ScrollBarDecorator(this.editor);
        this.bindDocumentListeners();
        this.recomputeFoldingRegions();

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
                this.controllerDisposed = true;
                this.languageSubscription?.dispose();
                this.eolSubscription?.dispose();
                this.contentSubscription?.dispose();
                this.fileWatch?.dispose();
                this.foldingSubscription?.dispose();
            },
        });
        // Очищаем историю отмены этого редактора при закрытии вкладки.
        this.register({
            dispose: () => {
                this.undoRedoService.clear(this.undoContext);
            },
        });
    }

    /**
     * Открывает файл с диска. Принимает уже поднятый `file:`-uri: подъём (и `path.resolve`
     * относительных путей из CLI/дерева) делает группа — единственная точка, где строка
     * становится ресурсом. `Uri.file` относительный путь НЕ резолвит, поэтому резолвить
     * после подъёма было бы поздно.
     */
    /**
     * Присваивает буферу номер безымянного (`untitled:Untitled-N`). Номерами владеет
     * группа: счётчик общий на группу, а вызывать это надо до того, как редактор
     * попадёт в список вкладок и станет кому-то виден.
     */
    public setUntitled(untitledNumber: number): void {
        this.uriValue = Uri.from({ scheme: "untitled", path: `Untitled-${untitledNumber}` });
    }

    public openFile(uri: Uri): void {
        this.uriValue = uri;
        const filePath = uri.fsPath;
        this.loadDocumentFromDisk(filePath);
        this.startWatchingFile(filePath);
    }

    /**
     * Читает файл с диска в свежий документ/view-state (сбрасывает undo, курсор,
     * токен-кеш). Общий путь для {@link openFile}, {@link revertToDisk} и
     * {@link reopenWithEncoding}. Обновляет снимок `diskStat` и снимает флаг
     * конфликта. Кодировка: `explicitEncoding` побеждает BOM-сниф; без него —
     * сниф BOM, иначе utf-8 (revert пере-детектит, как reload в VS Code).
     */
    private loadDocumentFromDisk(filePath: string, explicitEncoding?: string): void {
        const buffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
        const { text: content, encoding } = decodeBuffer(buffer, explicitEncoding);
        this.applyEncoding(encoding);
        this.diskStat = this.readDiskStat(filePath);
        this.doc = new TextDocument(content, this.resolveLanguageId(filePath));
        this.editorViewState = new EditorViewState(this.doc);
        this.tokenStore.dispose();
        this.tokenStore = new DocumentTokenStore(this.doc, this.ensureTokenizerForLanguage(this.doc.languageId));
        this.editorViewState.tokenStore = this.tokenStore;
        this.editor = new EditorElement(this.editorViewState);
        this.editor.tokenStyleResolver = this.tokenStyleResolver;
        this.editor.tabIndex = 0;
        this.editor.contextMenuEntries = this.contextMenuEntriesValue;
        this.editor.menuColors = this.currentMenuColors;
        this.attachUndoRouting();
        this.view.setChild(this.editor);
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
        this.diskConflictValue = false;
        this.bindDocumentListeners();
        this.recomputeFoldingRegions();
    }

    public async save(options?: { overwrite?: boolean }): Promise<SaveOutcome> {
        if (this.filePath === null) return "no-file";
        // Защита от затирания параллельных правок: если файл на диске изменился
        // внешним процессом с момента открытия/последней записи — не пишем, а
        // сообщаем о конфликте. Повторный вызов с overwrite: true форсит запись.
        if (options?.overwrite !== true && this.hasExternalChange(this.filePath)) {
            this.setDiskConflict(true);
            return "conflict";
        }
        // Когда участник не задан — до writeFileSync нет ни одного await, запись
        // остаётся синхронной в текущем тике (вызовы save() без await работают).
        const participant = this.saveParticipant;
        if (participant !== undefined) {
            await this.runSaveParticipant(participant);
        }
        fs.writeFileSync(this.filePath, encodeText(this.doc.serialize(), this.encodingValue));
        this.diskStat = this.readDiskStat(this.filePath);
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
        this.setDiskConflict(false);
        this.onDidSave?.();
        return "saved";
    }

    /**
     * Меняет кодировку и сразу сохраняет («Save with Encoding»). Для буфера без
     * файла на диске возвращает "no-file" — вызывающий уводит в Save As
     * (кодировка при этом уже выставлена).
     */
    public async saveWithEncoding(encoding: string, options?: { overwrite?: boolean }): Promise<SaveOutcome> {
        this.setEncoding(encoding);
        return this.save(options);
    }

    /**
     * Перечитывает файл с диска, отбрасывая несохранённые правки (аналог
     * `Revert File` в VS Code). Используется авто-перечиткой чистого буфера при
     * внешнем изменении и вручную. Возвращает `false`, если файла нет.
     */
    public revertToDisk(): boolean {
        if (this.filePath === null) return false;
        this.loadDocumentFromDisk(this.filePath);
        return true;
    }

    /**
     * Перечитывает файл с диска в указанной кодировке («Reopen with Encoding»),
     * отбрасывая несохранённые правки — подтверждение у «грязного» буфера
     * спрашивает вызывающий. Возвращает `false` для буфера без файла на диске.
     */
    public reopenWithEncoding(encoding: string): boolean {
        if (this.filePath === null) return false;
        this.loadDocumentFromDisk(this.filePath, encoding);
        return true;
    }

    /**
     * Собирает снапшот, дожидается участника и применяет вернувшиеся правки к
     * буферу (undoable) до записи. Выделено, чтобы переиспользовать в saveAs.
     */
    private async runSaveParticipant(participant: SaveParticipant): Promise<void> {
        const snapshot: ISaveSnapshot = {
            uri: this.uriValue.toString(),
            languageId: this.doc.languageId,
            versionId: this.doc.versionId,
            isDirty: this.isModified,
            text: this.doc.getText(),
            eol: this.doc.eol,
            encoding: this.encodingValue,
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
     * preserved — the undo bucket is keyed by {@link undoContext}, which is tied to
     * the editor rather than to its path, so re-pointing does not strand the history
     * accumulated before the save. The language is re-resolved for the new extension;
     * the bound language listener re-tokenizes and repaints automatically. Firing
     * `onDidSave` lets the group controller rename the tab and clear the dirty
     * marker.
     */
    public async saveAs(newPath: string): Promise<void> {
        // Смена идентичности на месте: у безымянного буфера это переход untitled: → file:.
        this.uriValue = Uri.file(path.resolve(newPath));
        const participant = this.saveParticipant;
        if (participant !== undefined) {
            await this.runSaveParticipant(participant);
        }
        fs.writeFileSync(newPath, encodeText(this.doc.serialize(), this.encodingValue));
        this.diskStat = this.readDiskStat(newPath);
        this.doc.setLanguage(this.resolveLanguageId(newPath));
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
        this.setDiskConflict(false);
        this.startWatchingFile(newPath);
        this.onDidSave?.();
    }

    /** Читает stat файла (mtime + размер) или `null`, если файла нет/недоступен. */
    private readDiskStat(filePath: string): IDiskStat | null {
        try {
            const stat = fs.statSync(filePath);
            return { mtimeMs: stat.mtimeMs, size: stat.size };
        } catch {
            return null;
        }
    }

    /**
     * Изменился ли файл на диске внешним процессом с момента последней
     * синхронизации (`diskStat`). Сверяем mtime и размер — этого достаточно,
     * чтобы поймать чужую запись и не спутать её с собственной. Отсутствие файла
     * (удалён/недоступен) не считаем конфликтом: `save` просто пересоздаст его.
     */
    private hasExternalChange(filePath: string): boolean {
        if (this.diskStat === null) return false;
        const current = this.readDiskStat(filePath);
        if (current === null) return false;
        return current.mtimeMs !== this.diskStat.mtimeMs || current.size !== this.diskStat.size;
    }

    /** (Пере)подписывается на внешние изменения текущего файла через `fileWatcher`. */
    private startWatchingFile(filePath: string): void {
        this.fileWatch?.dispose();
        this.fileWatch =
            this.fileWatcher?.watchFile(filePath, () => {
                this.handleExternalFileChange(filePath);
            }) ?? null;
    }

    /**
     * Реакция на сигнал watcher'а. Собственную запись отсеиваем сверкой stat
     * (после save `diskStat` уже обновлён). Реальное внешнее изменение: чистый
     * буфер — тихо перечитываем с диска (как VS Code); «грязный» — взводим флаг
     * конфликта, чтобы предупредить при сохранении. Удаление/недоступность
     * игнорируем (частый промежуточный шаг атомарной записи чужим редактором).
     */
    private handleExternalFileChange(filePath: string): void {
        if (!this.hasExternalChange(filePath)) return;
        if (this.isModified) {
            this.setDiskConflict(true);
        } else {
            this.revertToDisk();
            this.fireDiskStateChange();
        }
    }

    private setDiskConflict(value: boolean): void {
        if (this.diskConflictValue === value) return;
        this.diskConflictValue = value;
        this.fireDiskStateChange();
    }

    private fireDiskStateChange(): void {
        for (const listener of [...this.diskStateListeners]) listener();
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
        void this.undoRedoService.undo(this.undoContext);
    }

    public redo(): void {
        void this.undoRedoService.redo(this.undoContext);
    }

    /**
     * Контекст-бакет истории отмены этого редактора — непрозрачный идентификатор,
     * выданный при создании. Намеренно НЕ путь и НЕ uri: история принадлежит
     * редактору, а не ресурсу, поэтому ключ обязан быть стабильным на всём времени
     * жизни. Путь бакетом быть не может — на нём ломались два бага: все безымянные
     * буферы сходились в общий бакет `"untitled"`, а `saveAs` менял ключ и осиротлял
     * уже накопленную историю.
     *
     * Ограничение: корректно, пока редактор и документ соотносятся 1:1 (дедуп вкладок
     * в `EditorGroupController.openFile` это держит). Появятся сплиты — два редактора
     * на один документ по семантике VS Code обязаны делить историю, и ключ переедет
     * на документ.
     */
    public readonly undoContext = `editor-${nextUndoContextId++}`;

    /**
     * Подключает текущий редактор к общей истории: каждый шаг `UndoManager` регистрирует
     * обёртку в `UndoRedoService` под контекстом этого редактора. Обёртка — токен порядка:
     * её undo/redo делегируют в `UndoManager` (LIFO 1:1, поэтому стеки идут в ногу).
     *
     * Ключ бакета ({@link undoContext}) и `resources` — разные вещи: первый адресует
     * историю и привязан к редактору, второй перечисляет затронутые пути и у безымянного
     * буфера пуст.
     */
    private attachUndoRouting(): void {
        const editor = this.editor;
        editor.undoManager.onDidPush = (element) => {
            const filePath = this.filePath;
            this.undoRedoService.pushElement(
                {
                    label: element.label,
                    resources: filePath === null ? [] : [filePath],
                    undo: () => {
                        editor.undoManager.undo();
                        editor.markDirty();
                    },
                    redo: () => {
                        editor.undoManager.redo();
                        editor.markDirty();
                    },
                },
                this.undoContext,
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
     * Enables/disables highlighting occurrences of the word under the cursor
     * (VS Code `editor.occurrencesHighlight`). Repaints so the change is visible.
     */
    public setOccurrenceHighlightEnabled(enabled: boolean): void {
        if (this.editor.occurrenceHighlightEnabled === enabled) return;
        this.editor.occurrenceHighlightEnabled = enabled;
        this.editor.markDirty();
    }

    /**
     * Sets how many lines to keep between the cursor and the viewport edge when
     * scrolling it into view (VS Code's `editor.cursorSurroundingLines`). Negative
     * or fractional values are normalized to a non-negative integer.
     */
    public setCursorSurroundingLines(lines: number): void {
        const normalized = Math.max(0, Math.floor(lines));
        if (this.editorViewState.cursorSurroundingLines === normalized) return;
        this.editorViewState.cursorSurroundingLines = normalized;
        this.editor.markDirty();
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

    /**
     * Sets the diagnostic squiggle decorations rendered by the editor and
     * repaints. Pushed by the diagnostics controller from the marker service.
     */
    public setMarkerDecorations(decorations: readonly IMarkerDecoration[]): void {
        this.editor.markerDecorations = decorations;
        this.editor.markDirty();
    }

    /**
     * Sets the gutter change-bar decorations (SCM/git dirty-diff) rendered by
     * the editor and repaints. Colours arrive already resolved — this does not
     * touch the theme. Pushed by the source-control/git controller.
     */
    public setGutterChangeDecorations(decorations: readonly IGutterChangeDecoration[]): void {
        this.editor.gutterChangeDecorations = decorations;
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
        this.currentMenuColors = menuColorsFromTheme(theme);
        const fg = theme.getRequiredColor("editor.foreground");
        const bg = theme.getRequiredColor("editor.background");
        this.editor.style = { fg, bg };
        this.editor.gutterBackground = theme.getColor("editorGutter.background") ?? bg;
        this.editor.lineNumberForeground = theme.getColor("editorLineNumber.foreground");
        this.editor.lineNumberActiveForeground = theme.getColor("editorLineNumber.activeForeground");
        this.editor.occurrenceHighlightBackground = theme.getColor("editor.wordHighlightBackground");
        this.editor.errorForeground = theme.getColor("editorError.foreground");
        this.editor.warningForeground = theme.getColor("editorWarning.foreground");
        this.editor.infoForeground = theme.getColor("editorInfo.foreground");
        this.editor.hintForeground = theme.getColor("editorHint.foreground");
        this.editor.menuColors = this.currentMenuColors;
        this.editor.foldingControlForeground = theme.getColor("editorGutter.foldingControlForeground");
        this.editor.indentGuideForeground = theme.getColor("editorIndentGuide.background1");
        this.editor.indentGuideActiveForeground = theme.getColor("editorIndentGuide.activeBackground1");
        applyScrollBarTheme(this.view, theme, "editor.background");
    }

    /**
     * Language detection is delegated to the {@link ILanguageService}
     * (implemented by `LanguageRegistry` from the Extensions layer).
     */
    private resolveLanguageId(filePath: string): string {
        return this.languageService.getLanguageIdForResource(filePath) ?? "plaintext";
    }

    /**
     * Отдаёт токенайзер языка, попутно запуская его ленивую загрузку. Это наш
     * аналог `onLanguage`-активации: грамматика читается только когда язык
     * реально понадобился документу. Пока она едет — работаем на fallback'е;
     * подписка на `tokenizationRegistry.onDidChange` пересадит нас, когда
     * support доедет.
     */
    private ensureTokenizerForLanguage(languageId: string): ITokenizationSupport {
        void this.tokenizationRegistry.load(languageId); // fire-and-forget: load() не реджектится
        return this.tokenizationRegistry.get(languageId) ?? new PlainTextTokenizer();
    }

    /** Пересаживает токен-кеш текущего документа на актуальный токенизатор. */
    private applyTokenizer(): void {
        this.tokenStore.setTokenizationSupport(this.ensureTokenizerForLanguage(this.doc.languageId));
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
        // Контент-подписка тоже ретранслируется через уровень контроллера, чтобы
        // пережить пересоздание документа (revertToDisk перечитывает диск в новый
        // TextDocument — прямые подписки на старый doc иначе бы протухли).
        this.contentSubscription?.dispose();
        this.contentSubscription = this.doc.onDidChangeContent(() => {
            for (const listener of [...this.contentChangeListeners]) listener();
        });
        this.foldingSubscription?.dispose();
        this.foldingSubscription = this.doc.onDidChangeContent(() => {
            this.scheduleFoldingRecompute();
        });
    }

    /**
     * Schedules a folding recompute for after the current edit finishes. The
     * document fires `onDidChangeContent` mid-edit, *before* the view-state has
     * shifted existing regions for the change ({@link EditorViewState.adjustFoldingRegionsForEdits}).
     * Recomputing on a microtask lets that shift land first, so the merge below
     * reads collapsed regions at their post-edit line numbers. Coalesced so a
     * burst of edits triggers a single recompute.
     */
    private scheduleFoldingRecompute(): void {
        if (this.foldingRecomputeScheduled) return;
        this.foldingRecomputeScheduled = true;
        queueMicrotask(() => {
            this.foldingRecomputeScheduled = false;
            if (this.controllerDisposed) return;
            this.recomputeFoldingRegions();
        });
    }

    /**
     * Recomputes indentation-based folding regions for the current document,
     * preserving the collapsed state of regions that still start on the same
     * line. This is the built-in default provider (VS Code recomputes ranges on
     * every content change the same way); a language/extension-contributed
     * provider is a future seam.
     */
    private recomputeFoldingRegions(): void {
        const collapsedStarts = new Set<number>();
        for (const region of this.editorViewState.foldedRegions) {
            if (region.isCollapsed) collapsedStarts.add(region.startLine);
        }
        const computed = computeIndentationFolds(this.doc, this.editorViewState.tabSize);
        for (const region of computed) {
            if (collapsedStarts.has(region.startLine)) region.isCollapsed = true;
        }
        this.editorViewState.setFoldingRegions(computed);
        // If the recompute re-collapsed a region around the just-edited line (e.g.
        // Tab indented the line below a collapsed block into it), keep the caret —
        // and the text under it — visible, matching VS Code.
        this.editorViewState.ensurePrimaryCursorVisible();
        this.editor.markDirty();
    }

    /** Collapses the innermost region at the primary cursor. */
    public foldAtCursor(): void {
        this.editorViewState.foldRegionContaining(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Expands the innermost collapsed region at the primary cursor. */
    public unfoldAtCursor(): void {
        this.editorViewState.unfoldRegionContaining(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Toggles the innermost region at the primary cursor. */
    public toggleFoldAtCursor(): void {
        this.editorViewState.toggleFoldContaining(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Collapses every folding region in the document. */
    public foldAll(): void {
        this.editorViewState.foldAll();
        this.editor.markDirty();
    }

    /** Expands every folding region in the document. */
    public unfoldAll(): void {
        this.editorViewState.unfoldAll();
        this.editor.markDirty();
    }

    /** Collapses the innermost region at the cursor and every region nested inside it. */
    public foldRecursivelyAtCursor(): void {
        this.editorViewState.foldRecursively(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Expands the innermost region at the cursor and every region nested inside it. */
    public unfoldRecursivelyAtCursor(): void {
        this.editorViewState.unfoldRecursively(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Folds the document down to the given nesting level. */
    public foldLevel(level: number): void {
        this.editorViewState.foldLevel(level);
        this.editor.markDirty();
    }

    /** Moves the caret to the header of the next foldable region. */
    public gotoNextFold(): void {
        this.editorViewState.gotoNextFold(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }

    /** Moves the caret to the header of the previous foldable region. */
    public gotoPreviousFold(): void {
        this.editorViewState.gotoPreviousFold(this.editorViewState.selections[0].active.line);
        this.editor.markDirty();
    }
}
