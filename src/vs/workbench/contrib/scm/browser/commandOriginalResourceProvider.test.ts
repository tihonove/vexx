import { describe, expect, it } from "vitest";

import { Uri } from "../../../../base/common/uri.ts";
import { CommandRegistry } from "../../../../platform/commands/common/commandRegistry.ts";

import { CommandOriginalResourceProvider, ORIGINAL_RESOURCE_COMMAND } from "./commandOriginalResourceProvider.ts";

const FILE = Uri.file("/repo/a.ts");
const GIT_URI = "git:/repo/a.ts?%7B%22ref%22%3A%22HEAD%22%7D";

function withCommand(result: unknown) {
    const registry = new CommandRegistry();
    registry.register(ORIGINAL_RESOURCE_COMMAND, () => result);
    return new CommandOriginalResourceProvider(registry);
}

describe("CommandOriginalResourceProvider", () => {
    it("разбирает ответ расширения в ресурс оригинала", async () => {
        const resource = await withCommand(GIT_URI).provideOriginalResource(FILE);

        expect(resource?.scheme).toBe("git");
        expect(resource?.toString()).toBe(GIT_URI);
    });

    it("нет SCM-расширения — нет оригинала, и это не ошибка", async () => {
        const provider = new CommandOriginalResourceProvider(new CommandRegistry());

        await expect(provider.provideOriginalResource(FILE)).resolves.toBeNull();
    });

    it("расширение ответило null (untracked/вне репо) — оригинала нет", async () => {
        await expect(withCommand(null).provideOriginalResource(FILE)).resolves.toBeNull();
    });

    it("пустая строка не превращается в ресурс", async () => {
        await expect(withCommand("").provideOriginalResource(FILE)).resolves.toBeNull();
    });

    it("нестроковый ответ игнорируется", async () => {
        await expect(withCommand(42).provideOriginalResource(FILE)).resolves.toBeNull();
        await expect(withCommand(undefined).provideOriginalResource(FILE)).resolves.toBeNull();
    });

    it("ресурс передаётся расширению строкой", async () => {
        const registry = new CommandRegistry();
        const seen: unknown[] = [];
        registry.register(ORIGINAL_RESOURCE_COMMAND, (arg) => {
            seen.push(arg);
            return GIT_URI;
        });

        await new CommandOriginalResourceProvider(registry).provideOriginalResource(FILE);

        expect(seen).toEqual([FILE.toString()]);
    });
});
