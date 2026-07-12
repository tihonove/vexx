/**
 * Прокачивает `turns` оборотов microtask-очереди. Дефолт 3 — хватает
 * continuation'ам QuickInput/QuickOpen-промисов после `commands.execute(...)`.
 */
export async function flushMicrotasks(turns = 3): Promise<void> {
    for (let i = 0; i < turns; i++) {
        await Promise.resolve();
    }
}

/**
 * Real-time ожидание асинхронных сайд-эффектов, которые нельзя прокачать
 * микротасками (subprocess/RPC round-trip в ExtensionHost-тестах).
 */
export async function settle(ms = 200): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
