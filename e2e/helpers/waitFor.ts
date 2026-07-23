// Единый примитив ожидания для e2e. Все предикатные ожидания (дерево, кадр,
// фокус, состояние) строятся поверх `waitUntil` — один цикл опроса, один формат
// ошибки по таймауту. Идея — заменить россыпь `sleep()` в пробах на предикаты,
// которые говорят, чего именно ждали и что видели в последний раз.

export interface WaitUntilOptions {
    timeoutMs?: number;
    intervalMs?: number;
    /** Человекочитаемое «чего ждём» — попадает в сообщение об ошибке. */
    describe?: string;
    /** Диагностика последнего наблюдения — дописывается к таймаут-ошибке. */
    diagnose?: (last: unknown) => string;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_INTERVAL_MS = 100;

/**
 * Опрашивает `probe()` каждые `intervalMs`, пока `predicate` не станет истинным;
 * возвращает удовлетворившее значение. По таймауту бросает с `describe` и
 * `diagnose(last)`. Единственная точка, где e2e ждёт по времени.
 */
export async function waitUntil<T>(
    probe: () => Promise<T> | T,
    predicate: (value: T) => boolean,
    opts: WaitUntilOptions = {},
): Promise<T> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    let last: T | undefined;
    let observed = false;
    while (Date.now() < deadline) {
        last = await probe();
        observed = true;
        if (predicate(last)) return last;
        await sleep(intervalMs);
    }
    const what = opts.describe ?? "condition";
    const tail = observed && opts.diagnose !== undefined ? `\n${opts.diagnose(last)}` : "";
    throw new Error(`waitUntil(${what}) timed out after ${String(timeoutMs)}ms${tail}`);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
