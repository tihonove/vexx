import { EndOfLine, Position, Range, Uri } from "./VscodeTypes.ts";

/**
 * Реестр документов на стороне subprocess со СТАБИЛЬНОЙ идентичностью.
 *
 * editorconfig сравнивает документы по ссылке (`activeTextEditor.document ===
 * doc`), поэтому на один `fileName` должен приходиться ровно один
 * {@link ExtHostTextDocument}, живущий весь жизненный цикл сессии.
 * Обновления метаданных/текста мутируют существующий объект, а не создают новый.
 *
 * Полные снапшоты текста приходят только на пути will-save (WP6); до тех пор
 * текст — пустая строка, а `lineAt`/`lineCount` отражают последний снапшот.
 */

/** Метаданные документа (путь active-editor-change; без текста). */
export interface ExtHostDocumentMeta {
    readonly fileName: string;
    readonly languageId?: string;
    readonly isDirty?: boolean;
}

/** Полный снапшот документа (путь will-save; с текстом). */
export interface ExtHostDocumentSnapshot extends ExtHostDocumentMeta {
    readonly text: string;
}

/** Строка документа (`vscode.TextLine`). */
export interface TextLine {
    readonly lineNumber: number;
    readonly text: string;
    readonly range: Range;
    readonly rangeIncludingLineBreak: Range;
    readonly firstNonWhitespaceCharacterIndex: number;
    readonly isEmptyOrWhitespace: boolean;
}

/** Стабильный объект документа. Идентичность сохраняется между upsert'ами. */
export class ExtHostTextDocument {
    public readonly fileName: string;
    public readonly uri: Uri;
    public readonly isUntitled = false;
    public readonly isClosed = false;
    public readonly encoding = "utf8";
    public readonly eol = EndOfLine.LF;

    public languageId = "plaintext";
    public isDirty = false;
    public version = 0;

    private text = "";
    private lineCache: string[] | null = null;

    public constructor(fileName: string) {
        this.fileName = fileName;
        this.uri = Uri.file(fileName);
    }

    /** Обновляет метаданные без смены текста/версии (active-editor-change). */
    public applyMeta(meta: ExtHostDocumentMeta): void {
        if (meta.languageId !== undefined) this.languageId = meta.languageId;
        if (meta.isDirty !== undefined) this.isDirty = meta.isDirty;
    }

    /** Обновляет текст + метаданные и инкрементирует версию (will-save). */
    public applyFull(snapshot: ExtHostDocumentSnapshot): void {
        this.applyMeta(snapshot);
        this.text = snapshot.text;
        this.lineCache = null;
        this.version += 1;
    }

    public getText(range?: Range): string {
        if (range === undefined) return this.text;
        const lines = this.lines();
        if (range.start.line === range.end.line) {
            return lines[range.start.line].slice(range.start.character, range.end.character);
        }
        const parts: string[] = [lines[range.start.line].slice(range.start.character)];
        for (let n = range.start.line + 1; n < range.end.line; n++) {
            parts.push(lines[n]);
        }
        parts.push(lines[range.end.line].slice(0, range.end.character));
        return parts.join("\n");
    }

    public get lineCount(): number {
        return this.lines().length;
    }

    public lineAt(lineOrPosition: number | Position): TextLine {
        const lineNumber = typeof lineOrPosition === "number" ? lineOrPosition : lineOrPosition.line;
        const lines = this.lines();
        if (lineNumber < 0 || lineNumber >= lines.length) {
            throw new RangeError(`Illegal line number ${lineNumber} (lineCount=${lines.length})`);
        }
        const text = lines[lineNumber];
        const firstNonWhitespaceCharacterIndex = firstNonWhitespace(text);
        const isLast = lineNumber === lines.length - 1;
        return {
            lineNumber,
            text,
            range: new Range(lineNumber, 0, lineNumber, text.length),
            rangeIncludingLineBreak: isLast
                ? new Range(lineNumber, 0, lineNumber, text.length)
                : new Range(lineNumber, 0, lineNumber + 1, 0),
            firstNonWhitespaceCharacterIndex,
            isEmptyOrWhitespace: firstNonWhitespaceCharacterIndex === text.length,
        };
    }

    private lines(): string[] {
        if (this.lineCache === null) {
            this.lineCache = this.text.split("\n");
        }
        return this.lineCache;
    }
}

/** Индекс первого не-whitespace символа; длина строки, если вся whitespace. */
function firstNonWhitespace(text: string): number {
    for (let i = 0; i < text.length; i++) {
        if (!/\s/.test(text[i])) return i;
    }
    return text.length;
}

/** Реестр `Map<fileName, ExtHostTextDocument>` со стабильной идентичностью. */
export class DocumentRegistry {
    private readonly documents = new Map<string, ExtHostTextDocument>();

    public get(fileName: string): ExtHostTextDocument | undefined {
        return this.documents.get(fileName);
    }

    /** Лениво создаёт стабильный документ (нужен ДО прихода снапшота). */
    public getOrCreate(fileName: string): ExtHostTextDocument {
        let doc = this.documents.get(fileName);
        if (doc === undefined) {
            doc = new ExtHostTextDocument(fileName);
            this.documents.set(fileName, doc);
        }
        return doc;
    }

    public upsertMeta(meta: ExtHostDocumentMeta): ExtHostTextDocument {
        const doc = this.getOrCreate(meta.fileName);
        doc.applyMeta(meta);
        return doc;
    }

    public upsertFull(snapshot: ExtHostDocumentSnapshot): ExtHostTextDocument {
        const doc = this.getOrCreate(snapshot.fileName);
        doc.applyFull(snapshot);
        return doc;
    }

    /** Все известные документы (задел под `workspace.textDocuments`, WP3). */
    public all(): ExtHostTextDocument[] {
        return [...this.documents.values()];
    }
}
