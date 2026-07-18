import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Size } from "../Common/GeometryPromitives.ts";
import { Uri } from "../Common/Uri.ts";
import type { EditorElement } from "../Editor/EditorElement.ts";
import { createInsertEdit } from "../Editor/ITextEdit.ts";
import { MarkerSeverity } from "../Editor/Markers/IMarker.ts";
import type { MarkerService } from "../Editor/Markers/MarkerService.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { AppController, AppControllerDIToken } from "./AppController.ts";
import { CommandRegistry, CommandRegistryDIToken } from "../Workbench/Services/CommandRegistry.ts";
import { MarkerServiceDIToken, SettingsResourceDIToken } from "../Workbench/Services/CoreTokens.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";

const UNKNOWN_SETTINGS = ["{", '    "editor.tabSize": 2,', '    "editor.fontSize": 12', "}"].join("\n");
const KNOWN_SETTINGS = ["{", '    "editor.tabSize": 2', "}"].join("\n");

interface Harness {
    testApp: TestApp;
    controller: AppController;
    commands: CommandRegistry;
    markerService: MarkerService;
    group: EditorGroupController;
}

describe("DiagnosticsController — settings.json validation", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-diagnostics-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    /** Builds an app whose recognised Vexx settings file is `settingsResource` (null = none). */
    function createHarness(settingsResource: string | null): Harness {
        const { container, bindApp } = createTestContainer();
        // Re-bind before the first resolve so DiagnosticsController picks it up.
        container.bind(SettingsResourceDIToken, () => settingsResource);
        const controller = container.get(AppControllerDIToken);
        controller.setWorkspaceFolder(ws.dir);
        controller.mount();
        const testApp = TestApp.create(controller.view, new Size(80, 24));
        bindApp(testApp.app);
        return {
            testApp,
            controller,
            commands: container.get(CommandRegistryDIToken),
            markerService: container.get(MarkerServiceDIToken),
            group: container.get(EditorGroupControllerDIToken),
        };
    }

    function write(relPath: string, content: string): string {
        return ws.writeFile(relPath, content);
    }

    function activeEditorElement(h: Harness): EditorElement {
        return h.testApp.querySelector("EditorElement") as EditorElement;
    }

    /** Ключ маркера — ресурс (`uri.toString()`), а не путь на диске. */
    function resourceOf(filePath: string): string {
        return Uri.file(filePath).toString();
    }

    it("warns on unknown settings and pushes squiggle decorations to the editor", () => {
        const filePath = write("settings.json", UNKNOWN_SETTINGS);
        const h = createHarness(filePath);
        h.commands.execute("workbench.openFile", filePath);
        h.testApp.render();

        const markers = h.markerService.read({ resource: resourceOf(filePath) });
        expect(markers).toHaveLength(1);
        expect(markers[0].severity).toBe(MarkerSeverity.Warning);
        expect(markers[0].message).toContain("editor.fontSize");

        const decorations = activeEditorElement(h).markerDecorations;
        expect(decorations).toHaveLength(1);
        expect(decorations[0].severity).toBe(MarkerSeverity.Warning);
        expect(decorations[0].range.start.line).toBe(2);

        h.controller.dispose();
    });

    it("reports no markers when every setting is known", () => {
        const filePath = write("settings.json", KNOWN_SETTINGS);
        const h = createHarness(filePath);
        h.commands.execute("workbench.openFile", filePath);
        h.testApp.render();

        expect(h.markerService.read({ resource: resourceOf(filePath) })).toEqual([]);
        expect(activeEditorElement(h).markerDecorations).toEqual([]);

        h.controller.dispose();
    });

    it("ignores a settings.json that is not the Vexx settings file", () => {
        // A settings.json from elsewhere (e.g. VS Code's own, or a workspace one)
        // shares the basename but not the path — it must not be validated.
        const vexxSettings = write("settings.json", KNOWN_SETTINGS);
        const foreignSettings = write("other/settings.json", UNKNOWN_SETTINGS);
        const h = createHarness(vexxSettings);

        h.commands.execute("workbench.openFile", foreignSettings);
        h.testApp.render();

        expect(h.markerService.read()).toEqual([]);
        expect(activeEditorElement(h).markerDecorations).toEqual([]);

        h.controller.dispose();
    });

    it("does not validate anything when no settings resource is configured", () => {
        const filePath = write("settings.json", UNKNOWN_SETTINGS);
        const h = createHarness(null);

        h.commands.execute("workbench.openFile", filePath);
        h.testApp.render();

        expect(h.markerService.read()).toEqual([]);

        h.controller.dispose();
    });

    it("re-validates and repositions markers as the document changes", () => {
        const filePath = write("settings.json", UNKNOWN_SETTINGS);
        const h = createHarness(filePath);
        h.commands.execute("workbench.openFile", filePath);
        h.testApp.render();
        expect(h.markerService.read({ resource: resourceOf(filePath) })[0].range.start.line).toBe(2);

        // Insert a blank first line; the unknown key shifts down and must be re-flagged there.
        h.group.getActiveEditor()?.applyExternalEdits([createInsertEdit(0, 0, "\n")], "test");

        const markers = h.markerService.read({ resource: resourceOf(filePath) });
        expect(markers).toHaveLength(1);
        expect(markers[0].range.start.line).toBe(3);
        expect(activeEditorElement(h).markerDecorations[0].range.start.line).toBe(3);

        h.controller.dispose();
    });

    it("ignores marker changes for resources with no open editor", () => {
        const filePath = write("settings.json", UNKNOWN_SETTINGS);
        const h = createHarness(filePath);
        h.commands.execute("workbench.openFile", filePath);
        h.testApp.render();

        // A marker for a file that is not open must not throw and must not touch
        // the active editor's decorations.
        expect(() => {
            h.markerService.changeOne("other", ws.path("closed.json"), [
                { severity: MarkerSeverity.Error, range: createInsertEdit(0, 0, "").range, message: "x" },
            ]);
        }).not.toThrow();
        expect(activeEditorElement(h).markerDecorations).toHaveLength(1);

        h.controller.dispose();
    });
});
