import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import type { NodeSnapshot } from "../tuidom/inspector/protocol.ts";

import { getBinaryPath } from "./helpers/buildOnce.ts";
import { HeadlessSession } from "./helpers/headlessSession.ts";
import { findNode } from "./helpers/inspectorClient.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const fixturePath = resolve(here, "fixtures", "sample.ts");

// Проверяем `TUIDom.sendMouse` на настоящем бинаре: находим узел в дереве
// инспектора, целимся в его `box` и кликаем. Ровно так e2e будет покрывать мышь
// (вкладки панели, сэш, колесо) — см. docs/TODO/TerminalPanelBugs.md.
describe("SEA binary — mouse injection via the inspector", () => {
    let session: HeadlessSession | null = null;

    beforeAll(async () => {
        await getBinaryPath();
    }, 180_000);

    afterEach(async () => {
        if (session) {
            await session.dispose();
            session = null;
        }
    });

    const isEditLabel = (n: NodeSnapshot): boolean => n.type === "TextLabelElement" && n.text?.trim() === "Edit";
    const isPopupMenu = (n: NodeSnapshot): boolean => n.type === "PopupMenuElement";

    it("opens the Edit menu when its menu-bar item is clicked", async () => {
        session = await HeadlessSession.start({ args: [fixturePath] });

        const root = await session.waitForDocument((r) => findNode(r, isEditLabel) !== null);
        expect(findNode(root, isPopupMenu)).toBeNull();

        const label = findNode(root, isEditLabel);
        expect(label).not.toBeNull();
        // Координаты протокола — 0-based экранные ячейки, ровно как в `box`.
        await session.click(label!.box.x, label!.box.y);

        const opened = await session.waitForDocument((r) => findNode(r, isPopupMenu) !== null);
        expect(findNode(opened, isPopupMenu)).not.toBeNull();
    }, 60_000);
});
