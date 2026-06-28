import { describe, expect, it } from "vitest";

import { APP_NAME, REPO_URL, VEXX_VERSION } from "./Version.ts";

describe("Version", () => {
    it("exposes a non-empty version string", () => {
        expect(typeof VEXX_VERSION).toBe("string");
        expect(VEXX_VERSION.length).toBeGreaterThan(0);
    });

    it("falls back to the dev marker when not injected at build time", () => {
        // В тестах (vitest, без tsup `define`) глобал `__VEXX_VERSION__` отсутствует.
        expect(VEXX_VERSION).toBe("0.0.0-dev");
    });

    it("exposes app name and repo url for the About dialog", () => {
        expect(APP_NAME).toBe("Vexx");
        expect(REPO_URL).toMatch(/^https:\/\//);
    });
});
