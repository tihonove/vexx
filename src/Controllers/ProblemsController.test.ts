import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { createRange } from "../Editor/IRange.ts";
import type { IMarkerData } from "../Editor/Markers/IMarker.ts";
import { MarkerSeverity } from "../Editor/Markers/IMarker.ts";
import type { MarkerService } from "../Editor/Markers/MarkerService.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { settle } from "../TestUtils/timing.ts";

import { MarkerServiceDIToken } from "../Workbench/Services/CoreTokens.ts";
import type { ProblemNode } from "../Workbench/Services/Diagnostics/ProblemsTreeDataProvider.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { PanelController, PanelControllerDIToken } from "./PanelController.ts";
import { ProblemsController, ProblemsControllerDIToken } from "./ProblemsController.ts";

function warning(message: string, line = 0): IMarkerData {
    return { severity: MarkerSeverity.Warning, range: createRange(line, 0, line, 3), message };
}

describe("ProblemsController", () => {
    let ws: ITempWorkspace;
    let controller: ProblemsController;
    let panel: PanelController;
    let markerService: MarkerService;
    let editorGroup: ReturnType<typeof buildHarness>["editorGroup"];
    let testApp: TestApp;

    function buildHarness() {
        const { container, bindApp } = createTestContainer();
        const c = container.get(ProblemsControllerDIToken);
        const p = container.get(PanelControllerDIToken);
        const ms = container.get(MarkerServiceDIToken);
        const eg = container.get(EditorGroupControllerDIToken);
        const app = TestApp.createWithContent(p.view, new Size(70, 12));
        bindApp(app.app);
        c.mount();
        return { controller: c, panel: p, markerService: ms, editorGroup: eg, testApp: app };
    }

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-problems-" });
        const h = buildHarness();
        controller = h.controller;
        panel = h.panel;
        markerService = h.markerService;
        editorGroup = h.editorGroup;
        testApp = h.testApp;
    });

    afterEach(() => {
        ws.dispose();
    });

    it("shows the placeholder (no content) until markers appear, then the tree", async () => {
        // No markers → Problems view content is null → panel renders its placeholder.
        expect(panel.view.getChildren()).toEqual([]);

        markerService.changeOne("settings", ws.path("settings.json"), [warning("Unknown Setting: x", 1)]);
        // Content is swapped synchronously on the marker change.
        expect(panel.view.getChildren()).toHaveLength(1);

        await settle(0);
        testApp.render();
        const screen = testApp.backend.screenToString();
        expect(screen).toContain("settings.json");
        expect(screen).toContain("Unknown Setting: x");
        expect(screen).toContain("[Ln 2, Col 1]");
    });

    it("falls back to the placeholder when the markers clear", () => {
        const resource = ws.path("settings.json");
        markerService.changeOne("settings", resource, [warning("x")]);
        expect(panel.view.getChildren()).toHaveLength(1);

        markerService.changeOne("settings", resource, []);
        expect(panel.view.getChildren()).toEqual([]);
    });

    it("reveals a marker's location in the editor on activation", () => {
        const file = ws.writeFile("settings.json", ["{", '  "a": 1,', '  "bad": 2', "}"].join("\n"));
        editorGroup.openFile(file);

        const markerNode: ProblemNode = {
            kind: "marker",
            resource: file,
            marker: {
                owner: "settings",
                resource: file,
                severity: MarkerSeverity.Warning,
                range: createRange(2, 2, 2, 7),
                message: "bad",
            },
            index: 0,
        };
        controller.tree.onActivate?.(markerNode);

        expect(editorGroup.getActiveEditor()?.primaryCursorLine).toBe(2);
    });

    it("does nothing when a file node is activated", () => {
        const file = ws.writeFile("settings.json", "line0\nline1\n");
        editorGroup.openFile(file);
        editorGroup.getActiveEditor()?.goToPosition(0, 0);

        const fileNode: ProblemNode = { kind: "file", resource: file };
        controller.tree.onActivate?.(fileNode);

        expect(editorGroup.getActiveEditor()?.primaryCursorLine).toBe(0);
    });

    it("focuses the Problems tree", async () => {
        markerService.changeOne("settings", ws.path("settings.json"), [warning("x")]);
        await settle(0);
        testApp.render();
        controller.focus();
        expect(controller.tree.isFocused).toBe(true);
    });

    it("focus is a no-op when there are no problems (tree detached)", () => {
        // With no markers the tree is not attached to the panel; focus must not throw.
        expect(() => {
            controller.focus();
        }).not.toThrow();
    });

    it("keeps file nodes expanded across successive marker updates", async () => {
        const resource = ws.path("settings.json");
        markerService.changeOne("settings", resource, [warning("a", 1)]);
        await settle(0);
        // A second update to the same (already-expanded) file must stay expanded.
        markerService.changeOne("settings", resource, [warning("a", 1), warning("b", 2)]);
        await settle(0);
        testApp.render();
        const screen = testApp.backend.screenToString();
        expect(screen).toContain("[Ln 2, Col 1]");
        expect(screen).toContain("[Ln 3, Col 1]");
    });
});
