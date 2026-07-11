import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { TUIKeyboardEvent } from "../TUIDom/Events/TUIKeyboardEvent.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { ModifierReleaseArmory, ModifierReleaseArmoryDIToken } from "./ModifierReleaseArmory.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

/**
 * Проверяет маршрутизацию keyup в AppController: любое отпускание клавиши идёт в
 * ModifierReleaseArmory.fireRelease. Сама механика MRU покрыта в
 * EditorGroupController.test.ts, взведение — в TabActions.test.ts и
 * ModifierReleaseArmory.test.ts; здесь — только связка keyup → armory.
 */
describe("AppController — modifier-release routing (Ctrl release commits MRU cycle)", () => {
    let tmpDir: string;
    let testApp: TestApp;
    let controller: AppController;
    let group: EditorGroupController;
    let armory: ModifierReleaseArmory;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-mru-"));
        fs.writeFileSync(path.join(tmpDir, "a.ts"), "a");
        fs.writeFileSync(path.join(tmpDir, "b.ts"), "b");

        const { container, bindApp } = createTestContainer();
        controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(tmpDir);
        controller.mount();
        testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        await controller.activate();

        group = container.get(EditorGroupControllerDIToken);
        armory = container.get(ModifierReleaseArmoryDIToken);
        group.openFile(path.join(tmpDir, "a.ts"));
        group.openFile(path.join(tmpDir, "b.ts")); // MRU: b, a — active b
    });

    afterEach(() => {
        controller.dispose();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function keyup(key: string): void {
        controller.view.dispatchEvent(new TUIKeyboardEvent("keyup", { key }));
    }

    it("routes a modifier keyup into the armory, committing the in-progress MRU cycle", () => {
        // Mimic what the Ctrl+Tab action does: step + arm on Control release.
        group.cycleMru(1); // → a (frozen, not yet committed)
        armory.arm("Control", () => {
            group.endMruCycle();
        });
        expect(group.getActiveEditor()?.fileName).toBe("a.ts");

        keyup("Control"); // release Ctrl → armory fires → commit

        expect(group.getMruOrder().map((e) => e.fileName)).toEqual(["a.ts", "b.ts"]);
    });

    it("routes non-modifier keyups too, but they match no armed modifier", () => {
        const commit = vi.fn();
        armory.arm("Control", commit);

        keyup("a"); // released a normal key — no armed modifier matches
        keyup("Shift"); // wrong modifier
        expect(commit).not.toHaveBeenCalled();

        keyup("Control"); // the armed modifier
        expect(commit).toHaveBeenCalledTimes(1);
    });

    // Kitty keyup for the left Control key (codepoint 57442, event type 3 = release).
    const CONTROL_RELEASE = "\x1b[57442;1:3u";

    it("end-to-end: Ctrl+Tab cycles via the real key pipeline and Ctrl release commits", () => {
        controller.focusEditor(); // focus the EditorElement → textInputFocus is active
        testApp.render();

        // Ctrl held, Tab pressed → MRU step from b to a.
        testApp.sendKey("Ctrl+Tab");
        expect(group.getActiveEditor()?.fileName).toBe("a.ts");

        // Release Ctrl → armory commits the selection to the MRU front.
        testApp.backend.sendRaw(CONTROL_RELEASE);
        testApp.backend.flushInput();
        expect(group.getMruOrder().map((e) => e.fileName)).toEqual(["a.ts", "b.ts"]);

        // A second press-release toggles back to b (two-newest toggle, not deeper).
        testApp.sendKey("Ctrl+Tab");
        expect(group.getActiveEditor()?.fileName).toBe("b.ts");
        testApp.backend.sendRaw(CONTROL_RELEASE);
        testApp.backend.flushInput();
        expect(group.getActiveEditor()?.fileName).toBe("b.ts");
    });
});
