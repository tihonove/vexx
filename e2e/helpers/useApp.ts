import { onTestFinished } from "vitest";

import { type AppEnvOptions, type HeadlessApp, type PtyApp, type PtyAppOptions, startHeadlessApp, startPtyApp } from "./appSession.ts";

// Vitest-обёртки над `startHeadlessApp`/`startPtyApp`: сессия сама убирается по
// окончании теста (`onTestFinished`), поэтому в сьютах не нужен ни `afterEach`,
// ни ручной `dispose`. Держим отдельно от `appSession.ts`, чтобы тот оставался
// свободным от vitest (его импортит `runScenario`, живущий и вне раннера).

/**
 * Изолированная headless-сессия, привязанная к жизненному циклу теста.
 * `dispose` регистрируется в `onTestFinished` — гасится и на успехе, и на падении.
 */
export async function useHeadlessApp(options: AppEnvOptions = {}): Promise<HeadlessApp> {
    const app = await startHeadlessApp(options);
    onTestFinished(async () => {
        await app.dispose();
    });
    return app;
}

/** То же для PTY-транспорта (ANSI-уровень). */
export async function usePtyApp(options: PtyAppOptions = {}): Promise<PtyApp> {
    const app = await startPtyApp(options);
    onTestFinished(async () => {
        await app.dispose();
    });
    return app;
}
