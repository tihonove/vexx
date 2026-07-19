import { describe, expect, it, vi } from "vitest";

import type { ServiceAccessor, Token } from "../../../../platform/instantiation/common/diContainer.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";

import type { IQuickAccessProvider } from "./iQuickAccessProvider.ts";
import type { IQuickAccessProviderDescriptor } from "./quickAccessRegistry.ts";
import { QuickAccessRegistry } from "./quickAccessRegistry.ts";

function makeProvider(): IQuickAccessProvider {
    return {
        getPlaceholder: () => "",
        getItems: () => [],
    };
}

function makeRegistry(prefixes: string[]): {
    registry: QuickAccessRegistry;
    providers: Map<string, IQuickAccessProvider>;
    accessorGet: ReturnType<typeof vi.fn>;
} {
    const providers = new Map<string, IQuickAccessProvider>();
    const byToken = new Map<Token<IQuickAccessProvider>, IQuickAccessProvider>();
    const descriptors: IQuickAccessProviderDescriptor[] = prefixes.map((prefix) => {
        const provider = makeProvider();
        const providerToken = token<IQuickAccessProvider>(`test.quickAccess[${prefix}]`);
        providers.set(prefix, provider);
        byToken.set(providerToken, provider);
        return { prefix, provider: providerToken };
    });
    const accessorGet = vi.fn((diToken: Token<IQuickAccessProvider>) => byToken.get(diToken) as never);
    const accessor: ServiceAccessor = { get: accessorGet as ServiceAccessor["get"] };
    return { registry: new QuickAccessRegistry(accessor, descriptors), providers, accessorGet };
}

describe("QuickAccessRegistry", () => {
    it("resolves the provider whose prefix starts the query", () => {
        const { registry, providers } = makeRegistry(["", ">", ":"]);
        expect(registry.getProvider(">rename").provider).toBe(providers.get(">"));
        expect(registry.getProvider(":42").provider).toBe(providers.get(":"));
    });

    it("falls back to the empty-prefix (default) provider", () => {
        const { registry, providers } = makeRegistry(["", ">", ":"]);
        expect(registry.getProvider("main.ts").provider).toBe(providers.get(""));
        expect(registry.getProvider("").provider).toBe(providers.get(""));
    });

    it("picks the longest matching prefix, regardless of registration order", () => {
        const { registry, providers } = makeRegistry(["", ">>", ">"]);
        expect(registry.getProvider(">>deep").provider).toBe(providers.get(">>"));
        expect(registry.getProvider(">>deep").prefix).toBe(">>");
        expect(registry.getProvider(">shallow").provider).toBe(providers.get(">"));
    });

    it("resolves providers lazily — only the matched one is instantiated", () => {
        const { registry, accessorGet } = makeRegistry(["", ">", ":"]);
        expect(accessorGet).not.toHaveBeenCalled();
        registry.getProvider(">cmd");
        expect(accessorGet).toHaveBeenCalledTimes(1);
    });

    it("throws when no provider matches (no default registered)", () => {
        const { registry } = makeRegistry([">", ":"]);
        expect(() => registry.getProvider("main.ts")).toThrow(/default provider/);
    });
});
