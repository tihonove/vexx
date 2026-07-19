import * as fs from "node:fs";
import * as path from "node:path";

import { Disposable, type IDisposable } from "../../../../base/common/disposable.ts";
import type { IFileWatcher } from "../../../../platform/files/common/iFileWatcher.ts";
import { Uri } from "../../../../base/common/uri.ts";
import { decodeBuffer, DEFAULT_ENCODING, encodeText, getEncodingInfo } from "../../../../editor/common/model/encoding.ts";
import type { EndOfLine } from "../../../../editor/common/core/endOfLine.ts";
import type { IDocumentLanguageChange } from "../../../../editor/common/model/iDocumentLanguageChange.ts";
import type { IRange } from "../../../../editor/common/core/iRange.ts";
import { createRange } from "../../../../editor/common/core/iRange.ts";
import type { ISaveEdit, ISaveSnapshot, SaveParticipant } from "./iSaveParticipant.ts";
import type { ISelection } from "../../../../editor/common/core/iSelection.ts";
import type { ITextEdit } from "../../../../editor/common/core/iTextEdit.ts";
import { createTextEdit } from "../../../../editor/common/core/iTextEdit.ts";
import type { IUndoElement } from "../../../../editor/common/model/iUndoElement.ts";
import { TextDocument } from "../../../../editor/common/model/textDocument.ts";
import type { ILanguageService } from "../../../../editor/common/languages/iLanguageService.ts";
import type { UndoManager } from "../../../../editor/common/model/undoManager.ts";
import type { UndoRedoService } from "../../../../platform/undoRedo/common/undoRedoService.ts";

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

/** Источник непрозрачных ключей истории отмены (см. {@link TextFileModel.undoContext}). */
let nextUndoContextId = 1;

/**
 * Ресурс свежесозданной модели: безымянный буфер без номера. Номер назначает группа
 * ({@link TextFileModel.setUntitled}) — она владеет счётчиком; до этого модель ещё
 * никто не видит.
 */
const UNTITLED_PLACEHOLDER_URI = Uri.from({ scheme: "untitled", path: "Untitled" });

/**
 * Швы модели к редактирующей поверхности (view). Правки, которые модель применяет
 * сама (save-участник, смена EOL, программные батчи), обязаны идти через view-state
 * редактора — там живут выделения и inverse-edits для undo. Устанавливает владелец
 * view (`EditorComponent.attachEditTarget` в своём конструкторе); модель без
 * прикреплённой цели не используется — пара создаётся атомарно.
 */
export interface ITextFileEditTarget {
    cloneSelections(): ISelection[];
    applyEdits(edits: readonly ITextEdit[], label: string): IUndoElement | undefined;
    pushUndo(element: IUndoElement | undefined): void;
    markDirty(): void;
}

/**
 * Per-file модель текстового файла без view (аналог `ITextFileEditorModel` VS Code):
 * владеет {@link TextDocument}, dirty-статусом, осями encoding/EOL/language, записью
 * на диск (save/saveAs + save-участник) и слежением за файлом на диске (авто-перечитка
 * чистого буфера / флаг конфликта у «грязного»). Не singleton-сервис: экземпляр на
 * файл, создаёт владелец (`EditorService`) вместе с парным
 * `EditorComponent`.
 */
export class TextFileModel extends Disposable {
    private doc: TextDocument;
    private languageSubscription: IDisposable | null = null;
    private languageChangeListeners: ((change: IDocumentLanguageChange) => void)[] = [];
    private eolSubscription: IDisposable | null = null;
    private eolChangeListeners: (() => void)[] = [];
    /**
     * Кодировка байтового представления на диске (id из SUPPORTED_ENCODINGS).
     * В отличие от EOL это состояние модели, а не документа: документ видит
     * только строки, а кодировка применяется на дисковой границе (read/write).
     * Не undoable и не входит в isModified — Reopen заменяет документ целиком,
     * Save with Encoding сохраняет сразу (как в VS Code).
     */
    private encodingValue: string = DEFAULT_ENCODING;
    private encodingChangeListeners: (() => void)[] = [];
    private contentSubscription: IDisposable | null = null;
    private contentChangeListeners: (() => void)[] = [];
    private reloadListeners: (() => void)[] = [];
    /**
     * Идентичность ресурса этой модели — первичное состояние, из которого выводится
     * всё остальное (путь, имя, признак безымянности). Не `null`: у свежей модели
     * это `untitled:`-буфер, а не «модель без ресурса», поэтому ветку «пути нет»
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
    private readonly languageService: ILanguageService;
    private readonly undoRedoService: UndoRedoService;
    /**
     * Шов к редактирующей поверхности; прикрепляет парный `EditorComponent` в своём
     * конструкторе — модель никогда не живёт без него (см. {@link ITextFileEditTarget}).
     */
    private editTarget!: ITextFileEditTarget;

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

    /** Открытый документ. Пересоздаётся при перечитке с диска (см. {@link onDidReloadDocument}). */
    public get document(): TextDocument {
        return this.doc;
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

    public onDidSave?: () => void;

    /**
     * Наблюдатель за файлами (инъектируется группой перед openFile). Когда задан,
     * модель следит за открытым файлом и реагирует на внешние изменения
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
     * Событие смены «дискового» состояния модели: файл перечитан с диска
     * (чистый буфер) либо взведён/снят флаг конфликта. Подписка живёт на
     * модели и переживает пересоздание документа в openFile.
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
     * Инъектируется извне (EditorService ← host/харнесс); ядро не знает
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

    /**
     * Событие «документ пересоздан после чтения с диска» (openFile / revertToDisk /
     * reopenWithEncoding). Парный `EditorComponent` пересобирает по нему view-state,
     * токен-кеш и `EditorElement` — undo, курсор и скролл сбрасываются, как при
     * открытии файла заново.
     */
    public onDidReloadDocument(listener: () => void): IDisposable {
        this.reloadListeners.push(listener);
        return {
            dispose: () => {
                const i = this.reloadListeners.indexOf(listener);
                if (i >= 0) this.reloadListeners.splice(i, 1);
            },
        };
    }

    /** Language id открытого документа (`plaintext`, если язык не определён). */
    public get languageId(): string {
        return this.doc.languageId;
    }

    /**
     * Меняет язык документа вручную (закладка под будущий language picker,
     * аналог `editor.action.changeLanguage` из VS Code). Токенизатор
     * пересаживает парный компонент через подписку на onDidChangeLanguage.
     */
    public setLanguage(languageId: string): void {
        this.doc.setLanguage(languageId);
    }

    /**
     * Событие смены языка документа. Подписка живёт на модели, а не на
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
     * doc.setEol). Подписка живёт на модели, а не на конкретном
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
     * открытии другого файла). Подписка живёт на модели.
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

    public constructor(languageService: ILanguageService, undoRedoService: UndoRedoService) {
        super();

        this.languageService = languageService;
        this.undoRedoService = undoRedoService;

        this.doc = new TextDocument("");
        this.savedEol = this.doc.eol;
        this.bindDocumentListeners();

        this.register({
            dispose: () => {
                this.languageSubscription?.dispose();
                this.eolSubscription?.dispose();
                this.contentSubscription?.dispose();
                this.fileWatch?.dispose();
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
     * Прикрепляет редактирующую поверхность (см. {@link ITextFileEditTarget}).
     * Вызывает парный `EditorComponent` в своём конструкторе.
     */
    public attachEditTarget(target: ITextFileEditTarget): void {
        this.editTarget = target;
    }

    /**
     * Присваивает буферу номер безымянного (`untitled:Untitled-N`). Номерами владеет
     * группа: счётчик общий на группу, а вызывать это надо до того, как редактор
     * попадёт в список вкладок и станет кому-то виден.
     */
    public setUntitled(untitledNumber: number): void {
        this.uriValue = Uri.from({ scheme: "untitled", path: `Untitled-${untitledNumber}` });
    }

    /**
     * Открывает файл с диска. Принимает уже поднятый `file:`-uri: подъём (и `path.resolve`
     * относительных путей из CLI/дерева) делает группа — единственная точка, где строка
     * становится ресурсом. `Uri.file` относительный путь НЕ резолвит, поэтому резолвить
     * после подъёма было бы поздно.
     */
    public openFile(uri: Uri): void {
        this.uriValue = uri;
        const filePath = uri.fsPath;
        this.loadDocumentFromDisk(filePath);
        this.startWatchingFile(filePath);
    }

    /**
     * Читает файл с диска в свежий документ (сбрасывает undo, курсор, токен-кеш —
     * view пересобирается по {@link onDidReloadDocument}). Общий путь для
     * {@link openFile}, {@link revertToDisk} и {@link reopenWithEncoding}. Обновляет
     * снимок `diskStat` и снимает флаг конфликта. Кодировка: `explicitEncoding`
     * побеждает BOM-сниф; без него — сниф BOM, иначе utf-8 (revert пере-детектит,
     * как reload в VS Code).
     */
    private loadDocumentFromDisk(filePath: string, explicitEncoding?: string): void {
        const buffer = fs.existsSync(filePath) ? fs.readFileSync(filePath) : Buffer.alloc(0);
        const { text: content, encoding } = decodeBuffer(buffer, explicitEncoding);
        this.applyEncoding(encoding);
        this.diskStat = this.readDiskStat(filePath);
        this.doc = new TextDocument(content, this.resolveLanguageId(filePath));
        this.savedVersionId = this.doc.versionId;
        this.savedEol = this.doc.eol;
        this.diskConflictValue = false;
        this.bindDocumentListeners();
        for (const listener of [...this.reloadListeners]) listener();
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
     * marks the buffer dirty (EOL is tracked as a separate axis from content —
     * see {@link isModified}).
     */
    public setEol(eol: EndOfLine): void {
        const previous = this.doc.eol;
        if (previous === eol) return;

        const selections = this.editTarget.cloneSelections();
        const version = this.doc.versionId;
        this.doc.setEol(eol);
        this.editTarget.pushUndo({
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
        this.editTarget.markDirty();
    }

    /**
     * Writes the document to a new path and re-points the model to it.
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

    /**
     * Applies a programmatic batch of edits as a single undoable operation.
     *
     * A seam for edits that don't originate from user input — editor commands
     * (trim-trailing-whitespace, insert-final-newline) and save participants.
     * Pushes an undo element (if anything changed) and repaints. Document
     * dirtiness follows automatically from the version bump.
     */
    public applyExternalEdits(edits: readonly ITextEdit[], label: string): void {
        this.editTarget.pushUndo(this.editTarget.applyEdits(edits, label));
        this.editTarget.markDirty();
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
     * в `EditorService.openFile` это держит). Появятся сплиты — два редактора
     * на один документ по семантике VS Code обязаны делить историю, и ключ переедет
     * на документ.
     */
    public readonly undoContext = `editor-${nextUndoContextId++}`;

    /**
     * Подключает редактор к общей истории: каждый шаг `UndoManager` регистрирует
     * обёртку в `UndoRedoService` под контекстом этой модели. Обёртка — токен порядка:
     * её undo/redo делегируют в `UndoManager` (LIFO 1:1, поэтому стеки идут в ногу).
     * Движок undo (`UndoManager`) остаётся во view-слое (`EditorElement`); парный
     * `EditorComponent` перепривязывает роутинг при каждом пересоздании редактора.
     *
     * Ключ бакета ({@link undoContext}) и `resources` — разные вещи: первый адресует
     * историю и привязан к редактору, второй перечисляет затронутые пути и у безымянного
     * буфера пуст.
     */
    public attachUndoRouting(undoManager: UndoManager, markDirty: () => void): void {
        undoManager.onDidPush = (element) => {
            const filePath = this.filePath;
            this.undoRedoService.pushElement(
                {
                    label: element.label,
                    resources: filePath === null ? [] : [filePath],
                    undo: () => {
                        undoManager.undo();
                        markDirty();
                    },
                    redo: () => {
                        undoManager.redo();
                        markDirty();
                    },
                },
                this.undoContext,
            );
        };
    }

    /**
     * Language detection is delegated to the {@link ILanguageService}
     * (implemented by `LanguageRegistry` from the Extensions layer).
     */
    private resolveLanguageId(filePath: string): string {
        return this.languageService.getLanguageIdForResource(filePath) ?? "plaintext";
    }

    /**
     * Переподписывается на события текущего документа (документ пересоздаётся
     * в openFile): смена языка, смена EOL и правки контента ретранслируются
     * подписчикам модели — прямые подписки на старый doc иначе бы протухли
     * (revertToDisk перечитывает диск в новый TextDocument).
     */
    private bindDocumentListeners(): void {
        this.languageSubscription?.dispose();
        this.languageSubscription = this.doc.onDidChangeLanguage((change) => {
            for (const listener of [...this.languageChangeListeners]) listener(change);
        });
        this.eolSubscription?.dispose();
        this.eolSubscription = this.doc.onDidChangeEol(() => {
            for (const listener of [...this.eolChangeListeners]) listener();
        });
        this.contentSubscription?.dispose();
        this.contentSubscription = this.doc.onDidChangeContent(() => {
            for (const listener of [...this.contentChangeListeners]) listener();
        });
    }
}
