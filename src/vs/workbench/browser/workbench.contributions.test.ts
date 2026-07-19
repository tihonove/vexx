import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAppTestHarness, type IAppHarness } from "../../../TestUtils/AppTestHarness.ts";
import { StatusBarServiceDIToken } from "../services/statusbar/common/statusBarService.ts";

describe("Workbench contributions", () => {
    let h: IAppHarness;

    beforeEach(() => {
        h = createAppTestHarness();
    });

    afterEach(() => {
        h.dispose();
    });

    it("фаза Restored поднимается в mount(): статус-contribution'ы опубликовали сегменты", () => {
        // Terminal env + editor-status contribution'ы инстанцируются в mount()
        // (Restored), поэтому к этому моменту в статус-баре уже есть записи.
        const statusBar = h.container.get(StatusBarServiceDIToken);
        expect(statusBar.entries().length).toBeGreaterThan(0);
    });

    it("runEventuallyPhase не падает при пустой фазе Eventually", () => {
        expect(() => {
            h.workbench.runEventuallyPhase();
        }).not.toThrow();
    });
});
