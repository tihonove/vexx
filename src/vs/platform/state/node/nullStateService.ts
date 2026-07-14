import type { IStateDescriptor, IStateService } from "./state.ts";

/**
 * Заглушка {@link IStateService} для тестов и demo, где состояние не
 * персистится. `get` всегда отдаёт `descriptor.default`; `store`/`openWorkspace`/
 * `flushSync` — no-op. Зеркало `NULL_CONFIGURATION_SERVICE`.
 */
export const NULL_STATE_SERVICE: IStateService = {
    get<T>(descriptor: IStateDescriptor<T>): T {
        return descriptor.default;
    },
    store<T>(_descriptor: IStateDescriptor<T>, _value: T): void {
        /* no-op */
    },
    openWorkspace(_folderPath: string): void {
        /* no-op */
    },
    flushSync(): void {
        /* no-op */
    },
};
