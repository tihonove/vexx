import { EndOfLine } from "../../Editor/EndOfLine.ts";
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
