import { EndOfLine } from "../../Editor/EndOfLine.ts";
import type { ICoreCompletionItem } from "../../Editor/ICompletionSource.ts";
import { createRange } from "../../Editor/IRange.ts";
import type { ISaveEdit } from "../../Editor/ISaveParticipant.ts";

/**
 * Wire-форма правки save-участника (subprocess → host). Либо замена текста в
 * диапазоне (позиции 0-based, как в ядре — прямой маппинг на `IRange`), либо
 * смена EOL всего документа. Общий формат для обеих сторон RPC.
 */
export type WireTextEdit =
    | {
          readonly range: {
              readonly startLine: number;
              readonly startCharacter: number;
              readonly endLine: number;
              readonly endCharacter: number;
          };
          readonly text: string;
      }
    | { readonly setEndOfLine: 1 | 2 };

/** Параметры запроса will-save (host → subprocess). */
export interface IWireWillSaveParams {
    readonly fileName: string;
    readonly languageId: string;
    readonly version: number;
    readonly isDirty: boolean;
    readonly text: string;
    /** `vscode.TextDocumentSaveReason` (1=Manual, 2=AfterDelay, 3=FocusOut). */
    readonly reason: number;
    /** Текущий EOL документа (`vscode.EndOfLine`: 1=LF, 2=CRLF). */
    readonly eol: number;
}

function isFiniteNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

/** Валидирует одну wire-правку; `null`, если форма не распознана. */
function parseWireTextEdit(raw: unknown): WireTextEdit | null {
    if (typeof raw !== "object" || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if ("setEndOfLine" in obj) {
        const eol = obj.setEndOfLine;
        if (eol === 1 || eol === 2) return { setEndOfLine: eol };
        return null;
    }
    const range = obj.range;
    if (typeof range !== "object" || range === null) return null;
    const r = range as Record<string, unknown>;
    if (
        !isFiniteNumber(r.startLine) ||
        !isFiniteNumber(r.startCharacter) ||
        !isFiniteNumber(r.endLine) ||
        !isFiniteNumber(r.endCharacter) ||
        typeof obj.text !== "string"
    ) {
        return null;
    }
    return {
        range: {
            startLine: r.startLine,
            startCharacter: r.startCharacter,
            endLine: r.endLine,
            endCharacter: r.endCharacter,
        },
        text: obj.text,
    };
}

/**
 * Разбирает сырой ответ will-save в массив валидных {@link WireTextEdit}.
 * Невалидные элементы отбрасываются (drop+skip), а не роняют весь ответ.
 */
export function parseWireTextEdits(raw: unknown): WireTextEdit[] {
    if (!Array.isArray(raw)) return [];
    const result: WireTextEdit[] = [];
    for (const item of raw) {
        const parsed = parseWireTextEdit(item);
        if (parsed !== null) result.push(parsed);
    }
    return result;
}

/** Переводит wire-правки в core-правки ({@link ISaveEdit}). */
export function wireToSaveEdits(wire: readonly WireTextEdit[]): ISaveEdit[] {
    return wire.map((edit) =>
        "setEndOfLine" in edit
            ? { kind: "eol", eol: edit.setEndOfLine === 2 ? EndOfLine.CRLF : EndOfLine.LF }
            : {
                  kind: "text",
                  range: createRange(
                      edit.range.startLine,
                      edit.range.startCharacter,
                      edit.range.endLine,
                      edit.range.endCharacter,
                  ),
                  text: edit.text,
              },
    );
}

/**
 * Запрашивает у subprocess'а правки will-save с таймаутом. Возвращает пустой
 * массив на таймаут, ошибку RPC или невалидный ответ — сохранение никогда не
 * блокируется навсегда и не портит данные. `request` — голая функция (обычно
 * `rpc.request`), чтобы логику можно было юнит-тестировать через
 * {@link InProcessChannelPair} без форка subprocess'а.
 */
export async function requestWillSaveEdits(
    request: (method: string, params: unknown) => Promise<unknown>,
    params: IWireWillSaveParams,
    timeoutMs: number,
): Promise<ISaveEdit[]> {
    const TIMEOUT = Symbol("timeout");
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
    });
    try {
        const outcome = await Promise.race([
            request("workspace.willSaveTextDocument", params).catch(() => TIMEOUT),
            timeout,
        ]);
        if (outcome === TIMEOUT) return [];
        return wireToSaveEdits(parseWireTextEdits(outcome));
    } finally {
        clearTimeout(timer);
    }
}

// ─── Completion (WP8) ────────────────────────────────────────────────────────

/** Wire-форма диапазона (0-based, прямой маппинг на `IRange`). */
interface IWireRange {
    readonly startLine: number;
    readonly startCharacter: number;
    readonly endLine: number;
    readonly endCharacter: number;
}

/**
 * Wire-форма элемента автодополнения (subprocess → host). `insertText` уже
 * нормализован хостом-сериализатором (fallback на `label`).
 */
export interface WireCompletionItem {
    readonly label: string;
    readonly insertText: string;
    readonly kind?: number;
    readonly detail?: string;
    readonly documentation?: string;
    readonly command?: { readonly command: string; readonly arguments?: readonly unknown[] };
    readonly range?: IWireRange;
    readonly sortText?: string;
    readonly filterText?: string;
}

/** Параметры запроса completion (host → subprocess). */
export interface IWireCompletionParams {
    readonly fileName: string;
    readonly languageId: string;
    readonly text: string;
    readonly line: number;
    readonly character: number;
}

function parseWireRange(raw: unknown): IWireRange | undefined {
    if (typeof raw !== "object" || raw === null) return undefined;
    const r = raw as Record<string, unknown>;
    if (
        !isFiniteNumber(r.startLine) ||
        !isFiniteNumber(r.startCharacter) ||
        !isFiniteNumber(r.endLine) ||
        !isFiniteNumber(r.endCharacter)
    ) {
        return undefined;
    }
    return {
        startLine: r.startLine,
        startCharacter: r.startCharacter,
        endLine: r.endLine,
        endCharacter: r.endCharacter,
    };
}

function parseWireCommand(raw: unknown): WireCompletionItem["command"] {
    if (typeof raw !== "object" || raw === null) return undefined;
    const c = raw as Record<string, unknown>;
    if (typeof c.command !== "string" || c.command === "") return undefined;
    return {
        command: c.command,
        ...(Array.isArray(c.arguments) ? { arguments: c.arguments as readonly unknown[] } : {}),
    };
}

/** Валидирует один wire-элемент completion; `null`, если форма не распознана. */
function parseWireCompletionItem(raw: unknown): WireCompletionItem | null {
    if (typeof raw !== "object" || raw === null) return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj.label !== "string" || obj.label === "") return null;
    const insertText = typeof obj.insertText === "string" ? obj.insertText : obj.label;
    const range = parseWireRange(obj.range);
    const command = parseWireCommand(obj.command);
    return {
        label: obj.label,
        insertText,
        ...(isFiniteNumber(obj.kind) ? { kind: obj.kind } : {}),
        ...(typeof obj.detail === "string" ? { detail: obj.detail } : {}),
        ...(typeof obj.documentation === "string" ? { documentation: obj.documentation } : {}),
        ...(command !== undefined ? { command } : {}),
        ...(range !== undefined ? { range } : {}),
        ...(typeof obj.sortText === "string" ? { sortText: obj.sortText } : {}),
        ...(typeof obj.filterText === "string" ? { filterText: obj.filterText } : {}),
    };
}

/**
 * Разбирает сырой ответ completion в массив валидных {@link WireCompletionItem}.
 * Невалидные элементы отбрасываются (drop+skip), а не роняют весь ответ.
 */
export function parseWireCompletionItems(raw: unknown): WireCompletionItem[] {
    if (!Array.isArray(raw)) return [];
    const result: WireCompletionItem[] = [];
    for (const item of raw) {
        const parsed = parseWireCompletionItem(item);
        if (parsed !== null) result.push(parsed);
    }
    return result;
}

/** Переводит wire-элементы в core-элементы ({@link ICoreCompletionItem}). */
export function wireToCoreCompletionItems(wire: readonly WireCompletionItem[]): ICoreCompletionItem[] {
    return wire.map((item) => ({
        label: item.label,
        insertText: item.insertText,
        ...(item.kind !== undefined ? { kind: item.kind } : {}),
        ...(item.detail !== undefined ? { detail: item.detail } : {}),
        ...(item.documentation !== undefined ? { documentation: item.documentation } : {}),
        ...(item.command !== undefined
            ? {
                  command: {
                      command: item.command.command,
                      ...(item.command.arguments !== undefined ? { arguments: item.command.arguments } : {}),
                  },
              }
            : {}),
        ...(item.range !== undefined
            ? {
                  range: createRange(
                      item.range.startLine,
                      item.range.startCharacter,
                      item.range.endLine,
                      item.range.endCharacter,
                  ),
              }
            : {}),
        ...(item.sortText !== undefined ? { sortText: item.sortText } : {}),
        ...(item.filterText !== undefined ? { filterText: item.filterText } : {}),
    }));
}

/**
 * Запрашивает у subprocess'а элементы автодополнения с таймаутом. Возвращает
 * пустой массив на таймаут, ошибку RPC или невалидный ответ (completion —
 * best-effort, не блокирует UI). `request` — голая функция для юнит-тестов через
 * {@link InProcessChannelPair} без форка subprocess'а (как {@link requestWillSaveEdits}).
 */
export async function requestCompletionItems(
    request: (method: string, params: unknown) => Promise<unknown>,
    params: IWireCompletionParams,
    timeoutMs: number,
): Promise<ICoreCompletionItem[]> {
    const TIMEOUT = Symbol("timeout");
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), timeoutMs);
    });
    try {
        const outcome = await Promise.race([
            request("languages.provideCompletionItems", params).catch(() => TIMEOUT),
            timeout,
        ]);
        if (outcome === TIMEOUT) return [];
        return wireToCoreCompletionItems(parseWireCompletionItems(outcome));
    } finally {
        clearTimeout(timer);
    }
}
