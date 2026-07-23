// Ожидание «рендер устоялся» для инспектора. Клиент (e2e) после инъекции ввода
// хочет дождаться, пока приложение перестанет перерисовываться, — не угадывая
// паузу `sleep`, а наблюдая за реальным счётчиком кадров. «Устоялся» = frameCount
// не менялся в течение `quietMs` И нет отложенного (setImmediate) рендера.
//
// Важно: это «рендер устоялся», а НЕ «все эффекты завершились». Асинхронные
// хвосты (ответ ext-host'а, дебаунс StateService) idle не ловит — под них клиент
// использует предикат по дереву/кадру, а не увеличенный quietMs.

/** Наблюдаемое состояние отрисовки — то, что даёт `TuiApplication`. */
export interface IdleSource {
    /** Монотонный счётчик отрисованных кадров. */
    frameCount(): number;
    /** Есть ли ещё не выполненный отложенный рендер. */
    isRenderScheduled(): boolean;
}

/** Часы: вынесены параметром ради детерминированных юнит-тестов. */
export interface IdleClock {
    now(): number;
    sleep(ms: number): Promise<void>;
}

export interface WaitForIdleOptions {
    /** Сколько кадр должен простоять неизменным, чтобы считаться устоявшимся. */
    quietMs?: number;
    /** Предел ожидания; по истечении возвращаем `idle: false` (не бросаем). */
    timeoutMs?: number;
    /** Период опроса источника. */
    pollMs?: number;
    /** Подменяемые часы (по умолчанию — реальные). */
    clock?: IdleClock;
}

export interface WaitForIdleResult {
    /** `true` — дождались тишины; `false` — упёрлись в `timeoutMs`. */
    idle: boolean;
    /** `frameCount` на момент возврата. */
    frames: number;
}

const DEFAULT_QUIET_MS = 40;
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_POLL_MS = 10;

const realClock: IdleClock = {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Ждёт, пока `source` перестанет перерисовываться. Возвращает `{ idle, frames }`;
 * по таймауту — `idle: false` (решение, ждать ли дальше, за вызывающим). Никогда
 * не бросает.
 */
export async function waitForIdle(source: IdleSource, options: WaitForIdleOptions = {}): Promise<WaitForIdleResult> {
    const quietMs = options.quietMs ?? DEFAULT_QUIET_MS;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    const clock = options.clock ?? realClock;

    const start = clock.now();
    let lastFrame = source.frameCount();
    let lastChange = start;

    for (;;) {
        const now = clock.now();
        const frame = source.frameCount();
        const busy = frame !== lastFrame || source.isRenderScheduled();
        if (busy) {
            lastFrame = frame;
            lastChange = now;
        } else if (now - lastChange >= quietMs) {
            return { idle: true, frames: frame };
        }
        if (now - start >= timeoutMs) {
            return { idle: false, frames: frame };
        }
        await clock.sleep(pollMs);
    }
}
