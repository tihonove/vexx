import { afterEach, describe, expect, it, vi } from "vitest";

import { onUnexpectedError, setUnexpectedErrorHandler } from "./errors.ts";

/**
 * Шим `base/common/errors`: обработчик непредвиденных ошибок. Дефолт у нас —
 * запись в консоль (upstream перебрасывает через setTimeout и роняет процесс);
 * обоснование отклонения — в шапке errors.ts.
 */

afterEach(() => {
    setUnexpectedErrorHandler((e) => {
        console.error(e);
    });
});

describe("onUnexpectedError", () => {
    it("по умолчанию пишет в консоль и не бросает", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const error = new Error("бум");
            expect(() => {
                onUnexpectedError(error);
            }).not.toThrow();
            expect(spy).toHaveBeenCalledWith(error);
        } finally {
            spy.mockRestore();
        }
    });

    it("зовёт установленный обработчик вместо дефолтного", () => {
        const handler = vi.fn();
        setUnexpectedErrorHandler(handler);
        const error = new Error("свой");
        onUnexpectedError(error);
        expect(handler).toHaveBeenCalledExactlyOnceWith(error);
    });
});
