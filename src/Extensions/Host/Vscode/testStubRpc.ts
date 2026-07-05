import type { RpcEndpoint } from "../RpcEndpoint.ts";

/**
 * Лёгкий стаб {@link RpcEndpoint} для unit-тестов namespace'ов subprocess.
 * Захватывает зарегистрированные notification-хендлеры (чтобы «прислать» notif
 * с хоста) и записывает исходящие request/notify.
 */
export interface IStubRpc {
    readonly rpc: RpcEndpoint;
    /** Имитирует приход notif от хоста. */
    fire(method: string, params: unknown): void;
    readonly requests: { method: string; params: unknown }[];
    readonly notifies: { method: string; params: unknown }[];
}

export function makeStubRpc(): IStubRpc {
    const handlers = new Map<string, (params: unknown) => void>();
    const requests: { method: string; params: unknown }[] = [];
    const notifies: { method: string; params: unknown }[] = [];
    const rpc = {
        handleNotification: (method: string, handler: (params: unknown) => void) => {
            handlers.set(method, handler);
            return { dispose: () => handlers.delete(method) };
        },
        handleRequest: () => ({ dispose: () => undefined }),
        request: (method: string, params: unknown) => {
            requests.push({ method, params });
            return Promise.resolve(undefined);
        },
        notify: (method: string, params: unknown) => {
            notifies.push({ method, params });
        },
        dispose: () => undefined,
    } as unknown as RpcEndpoint;

    return {
        rpc,
        fire: (method, params) => {
            const handler = handlers.get(method);
            if (handler === undefined) throw new Error(`no handler for "${method}"`);
            handler(params);
        },
        requests,
        notifies,
    };
}
