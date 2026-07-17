// Движок проблем-матчера: строки вывода → диагностики.
//
// Провайдер-агностичный и чистый: не знает про PTY, DI и файловую систему. Резолв пути
// в ресурс инъектируется (`resolveResource`) — в нём и живёт логика `fileLocation`.
// Однострочный паттерн матчит каждую строку независимо; массив паттернов — маленькая
// стейт-машина (накопление capture'ов до последнего паттерна, `loop` на хвосте).

import { createRange } from "../../Editor/IRange.ts";
import type { IMarkerData } from "../../Editor/Markers/IMarker.ts";
import { MarkerSeverity } from "../../Editor/Markers/IMarker.ts";

import type { IProblemMatcher, IProblemPattern } from "./ITask.ts";

/** Резолвер пути из матча в строковый ресурс (`uri.toString()`). */
export type ResolveResource = (file: string) => string;

/** Накопленные поля будущего маркера (заполняются по мере матча цепочки паттернов). */
interface ProblemData {
    file?: string;
    line?: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    severity?: string;
    code?: string;
    message?: string;
}

export class ProblemMatcher {
    private readonly patterns: readonly IProblemPattern[];
    private readonly regexps: readonly RegExp[];
    private readonly resolveResource: ResolveResource;
    private readonly defaultSeverity: MarkerSeverity;
    private readonly source: string | undefined;

    /** Собранные маркеры по ресурсам. */
    private readonly markers = new Map<string, IMarkerData[]>();
    /** Индекс ожидаемого паттерна в многострочной цепочке. */
    private patternIndex = 0;
    private data: ProblemData = {};

    public constructor(matcher: IProblemMatcher, resolveResource: ResolveResource) {
        this.patterns = Array.isArray(matcher.pattern) ? matcher.pattern : [matcher.pattern as IProblemPattern];
        this.regexps = this.patterns.map((p) => new RegExp(p.regexp));
        this.resolveResource = resolveResource;
        this.defaultSeverity = matcher.severity !== undefined ? toSeverity(matcher.severity) : MarkerSeverity.Error;
        this.source = matcher.source;
    }

    /** Скормить одну строку вывода. */
    public processLine(line: string): void {
        if (this.patterns.length === 1) {
            const m = this.regexps[0].exec(line);
            if (m !== null) this.emit(collect({}, this.patterns[0], m));
            return;
        }
        this.processMultiline(line);
    }

    /** Итоговые маркеры по ресурсам (после прогона всех строк). */
    public getMarkers(): ReadonlyMap<string, IMarkerData[]> {
        return this.markers;
    }

    private processMultiline(line: string): void {
        const pattern = this.patterns[this.patternIndex];
        const isLast = this.patternIndex === this.patterns.length - 1;
        const m = this.regexps[this.patternIndex].exec(line);

        if (m !== null) {
            this.data = collect(this.data, pattern, m);
            if (!isLast) {
                this.patternIndex++;
                return;
            }
            this.emit(this.data);
            if (pattern.loop !== true) this.reset();
            return;
        }

        // Не совпало. На loop-хвосте или в середине цепочки — сбрасываемся и пробуем
        // начать новую запись с этой же строки (одна безопасная переигровка: на индексе 0
        // несовпадение просто игнорируется).
        if (this.patternIndex > 0) {
            this.reset();
            this.processMultiline(line);
        }
    }

    private reset(): void {
        this.patternIndex = 0;
        this.data = {};
    }

    private emit(data: ProblemData): void {
        if (data.file === undefined || data.message === undefined) return;
        const resource = this.resolveResource(data.file);
        const marker: IMarkerData = {
            severity: data.severity !== undefined ? toSeverity(data.severity) : this.defaultSeverity,
            range: buildRange(data),
            message: data.message,
            ...(data.code !== undefined ? { code: data.code } : {}),
            ...(this.source !== undefined ? { source: this.source } : {}),
        };
        const list = this.markers.get(resource);
        if (list !== undefined) list.push(marker);
        else this.markers.set(resource, [marker]);
    }
}

/** Заполнить `ProblemData` из совпадения по индексам capture-групп паттерна. */
function collect(base: ProblemData, pattern: IProblemPattern, match: RegExpExecArray): ProblemData {
    const data: ProblemData = { ...base };
    const at = (index?: number): string | undefined => (index !== undefined ? match[index] : undefined);

    const file = at(pattern.file);
    if (file !== undefined) data.file = file;

    // `location` — компактная запись `line[,col[,endLine,endCol]]`; берётся только если
    // явные line/column не заданы этим паттерном.
    const location = at(pattern.location);
    if (location !== undefined && pattern.line === undefined) {
        const parts = location.split(",").map((p) => Number.parseInt(p, 10));
        if (parts[0] !== undefined && !Number.isNaN(parts[0])) data.line = parts[0];
        if (parts[1] !== undefined && !Number.isNaN(parts[1])) data.column = parts[1];
        if (parts[2] !== undefined && !Number.isNaN(parts[2])) data.endLine = parts[2];
        if (parts[3] !== undefined && !Number.isNaN(parts[3])) data.endColumn = parts[3];
    }

    assignNumber(data, "line", at(pattern.line));
    assignNumber(data, "column", at(pattern.column));
    assignNumber(data, "endLine", at(pattern.endLine));
    assignNumber(data, "endColumn", at(pattern.endColumn));

    const severity = at(pattern.severity);
    if (severity !== undefined) data.severity = severity;
    const code = at(pattern.code);
    if (code !== undefined) data.code = code;
    const message = at(pattern.message);
    if (message !== undefined) data.message = message;

    return data;
}

function assignNumber(data: ProblemData, key: "line" | "column" | "endLine" | "endColumn", raw?: string): void {
    if (raw === undefined) return;
    const n = Number.parseInt(raw, 10);
    if (!Number.isNaN(n)) data[key] = n;
}

/** Построить 0-based `IRange` из 1-based line/column (с guard'ами и минимум 1 символ). */
function buildRange(data: ProblemData) {
    const startLine = toZeroBased(data.line);
    const startChar = toZeroBased(data.column);
    const endLine = data.endLine !== undefined ? toZeroBased(data.endLine) : startLine;
    const endChar =
        data.endColumn !== undefined
            ? toZeroBased(data.endColumn)
            : endLine === startLine
              ? startChar + 1
              : startChar;
    return createRange(startLine, startChar, endLine, endChar);
}

function toZeroBased(value?: number): number {
    if (value === undefined) return 0;
    return value > 0 ? value - 1 : 0;
}

/** VS Code severity-слово → `MarkerSeverity` (по умолчанию Error). */
function toSeverity(word: string): MarkerSeverity {
    switch (word.toLowerCase()) {
        case "warning":
        case "warn":
            return MarkerSeverity.Warning;
        case "info":
        case "information":
            return MarkerSeverity.Info;
        case "hint":
            return MarkerSeverity.Hint;
        default:
            return MarkerSeverity.Error;
    }
}
