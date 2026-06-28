import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { getBinaryPath } from "./helpers/buildOnce.ts";
import { findNode } from "./helpers/inspectorClient.ts";
import { VexxSession } from "./helpers/runVexx.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const fixturePath = resolve(here, "fixtures", "sample.ts");

// Trial test: launch the REAL vexx exactly like the sea-* e2e tests do (via
// VexxSession), but make the assertions from the TUIDom inspector's document
// tree instead of parsing the ANSI screen. Nothing here reads the console —
// readiness and assertions both come from inspector data. Because the data
// comes from the tree (not rendered cells) it is unaffected by the ConPTY
// clearing that gates the screen-content tests to Linux (see docs/TODO/E2E.md).
describe("SEA binary — inspector assertions on the real app", () => {
    let session: VexxSession | null = null;

    beforeAll(async () => {
        await getBinaryPath();
    }, 180_000);

    afterEach(async () => {
        if (session) {
            await session.dispose();
            session = null;
        }
    });

    it("serves the real app's document tree, with an 'Edit' menu label", async () => {
        // Same launch as the other e2e tests — only `inspect: true` differs, which
        // makes the harness inject --inspect-tui on a free port behind the scenes.
        session = await VexxSession.start({ args: [fixturePath], inspect: true });

        // Readiness + assertion, both via the inspector: wait until the menu bar
        // renders an "Edit" label (label text is padded, e.g. " Edit "). This is
        // the inspector-data analogue of sea-startup's screen `findText("Edit")`.
        const isEditLabel = (n: { type: string; text?: string }): boolean =>
            n.type === "TextLabelElement" && n.text?.trim() === "Edit";
        const root = await session.waitForDocument((r) => findNode(r, isEditLabel) !== null);

        expect(root.type).toBe("BodyElement");
        expect(findNode(root, isEditLabel)).not.toBeNull();
    });
});
