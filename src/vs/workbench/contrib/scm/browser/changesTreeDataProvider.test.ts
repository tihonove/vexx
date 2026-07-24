import { describe, expect, it } from "vitest";

import { Uri } from "../../../../base/common/uri.ts";

import type { IScmChange } from "./changesService.ts";
import { ChangesTreeDataProvider } from "./changesTreeDataProvider.ts";

function change(fsPath: string, status: string, colorId = "gitDecoration.modifiedResourceForeground"): IScmChange {
    return { uri: Uri.file(fsPath), status, colorId };
}

describe("ChangesTreeDataProvider", () => {
    it("плоский список: дети только у корня, отсортированы по пути", () => {
        const provider = new ChangesTreeDataProvider();
        provider.setChanges([change("/repo/src/b.ts", "M"), change("/repo/a.ts", "A")]);

        const nodes = provider.getChildren();
        expect(nodes.map((n) => n.uri.fsPath)).toEqual(["/repo/a.ts", "/repo/src/b.ts"]);
        expect(provider.getChildren(nodes[0])).toEqual([]);
    });

    it("метка — путь относительно корня воркспейса", () => {
        const provider = new ChangesTreeDataProvider();
        provider.rootPath = "/repo";
        provider.setChanges([change("/repo/src/a.ts", "M")]);

        expect(provider.getTreeItem(provider.getChildren()[0]).label).toBe("src/a.ts");
    });

    it("без корня (и вне корня) — basename", () => {
        const provider = new ChangesTreeDataProvider();
        provider.setChanges([change("/repo/src/a.ts", "M")]);
        expect(provider.getTreeItem(provider.getChildren()[0]).label).toBe("a.ts");

        provider.rootPath = "/other";
        expect(provider.getTreeItem(provider.getChildren()[0]).label).toBe("a.ts");
    });

    it("буква-статус и цвет из карты colorId → RGB", () => {
        const provider = new ChangesTreeDataProvider();
        provider.statusColors = { "gitDecoration.untrackedResourceForeground": 0x33bb77 };
        provider.setChanges([change("/repo/a.ts", "U", "gitDecoration.untrackedResourceForeground")]);

        const item = provider.getTreeItem(provider.getChildren()[0]);
        expect(item.badge).toBe("U");
        expect(item.labelColor).toBe(0x33bb77);
        expect(item.collapsible).toBe(false);
    });

    it("неизвестный colorId → цвет не задан (fallback на fg темы у виджета)", () => {
        const provider = new ChangesTreeDataProvider();
        provider.setChanges([change("/repo/a.ts", "M", "gitDecoration.unknown")]);

        expect(provider.getTreeItem(provider.getChildren()[0]).labelColor).toBeUndefined();
    });

    it("ключ узла — строка URI", () => {
        const provider = new ChangesTreeDataProvider();
        const node = change("/repo/a.ts", "M");
        provider.setChanges([node]);

        expect(provider.getKey(provider.getChildren()[0])).toBe(Uri.file("/repo/a.ts").toString());
    });
});
