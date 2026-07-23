import { onTestFailed, onTestFinished } from "vitest";

import { type AppEnvOptions, type HeadlessApp, type PtyApp, type PtyAppOptions, startHeadlessApp, startPtyApp } from "./appSession.ts";
import { dumpSession } from "./diagnostics.ts";

// Vitest-обёртки над `startHeadlessApp`/`startPtyApp`: сессия сама убирается по
// окончании теста (`onTestFinished`), поэтому в сьютах не нужен ни `afterEach`,
// ни ручной `dispose`. Держим отдельно от `appSession.ts`, чтобы тот оставался
// свободным от vitest (его импортит `runScenario`, живущий и вне раннера).

/**
 * Изолированная headless-сессия, привязанная к жизненному циклу теста. При
 * падении печатает пост-мортем (кадр, фокус, дерево) до уборки; `dispose`
 * регистрируется в `onTestFinished` — гасится и на успехе, и на падении.
 */
export async function useHeadlessApp(options: AppEnvOptions = {}): Promise<HeadlessApp> {
    const app = await startHeadlessApp(options);
    onTestFailed(async () => {
        // onTestFailed идёт до onTestFinished — сессия ещё жива, можно снять снимок.
        try {
            console.error(`\n${await dumpSession(app.session, { root: app.env.root, label: "e2e failure" })}`);
        } catch {
            // диагностика не должна маскировать исходное падение
        }
    });
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
