import { describe, expect, it } from "vitest";

import { Uri } from "../Common/Uri.ts";
import type { MarkerService } from "../Editor/Markers/MarkerService.ts";
import { FakeTerminalSurface } from "../TestUtils/FakeTerminalSurface.ts";
import { TerminalViewElement } from "../TUIDom/Widgets/Terminal/TerminalViewElement.ts";

import { MarkerServiceDIToken } from "./CoreTokens.ts";
import { createTestContainer } from "./Modules/TestProfile.ts";
import { PanelControllerDIToken, TASK_OUTPUT_VIEW_ID } from "./PanelController.ts";
import type { ITask } from "./Tasks/ITask.ts";
import { TasksController, TasksControllerDIToken } from "./TasksController.ts";
import { TerminalSessionFactoryDIToken } from "./Terminal/TerminalSessionFactory.ts";

const WORKSPACE = "/ws";
const TSC_TASK: ITask = { label: "build", type: "shell", command: "tsc -p .", group: "build", problemMatcher: "$tsc" };

function buildHarness() {
    const { container } = createTestContainer();
    const sessions: FakeTerminalSurface[] = [];
    container.bind(TerminalSessionFactoryDIToken, () => () => {
        const surface = new FakeTerminalSurface();
        sessions.push(surface);
        return surface;
    });
    const controller = container.get(TasksControllerDIToken);
    controller.setWorkspaceFolder(WORKSPACE);
    return {
        controller,
        panel: container.get(PanelControllerDIToken),
        markers: container.get(MarkerServiceDIToken),
        sessions,
    };
}

function expectedResource(rel: string): string {
    return Uri.file(`${WORKSPACE}/${rel}`).toString();
}

describe("TasksController", () => {
    it("lazily creates the TASK tab and injects the terminal widget on run", () => {
        const { controller, panel, sessions } = buildHarness();
        expect(panel.view.getViewIds()).not.toContain(TASK_OUTPUT_VIEW_ID);

        controller.runTask(TSC_TASK);

        expect(sessions).toHaveLength(1);
        expect(panel.view.getViewIds()).toContain(TASK_OUTPUT_VIEW_ID);
        expect(panel.view.getActiveViewId()).toBe(TASK_OUTPUT_VIEW_ID);
        const content = panel.view.getChildren();
        expect(content[0]).toBeInstanceOf(TerminalViewElement);
    });

    it("parses matched output into markers on process exit", () => {
        const { controller, markers, sessions } = buildHarness();
        controller.runTask(TSC_TASK);
        const session = sessions[0];

        session.emitData("app.ts(3,5): error TS2322: Type mismatch\r\n");
        // До exit маркеров ещё нет — one-shot флашит на выходе процесса.
        expect(markers.read()).toHaveLength(0);

        session.emitExit(1);
        const written = markers.read({ owner: "typescript" });
        expect(written).toHaveLength(1);
        expect(written[0].resource).toBe(expectedResource("app.ts"));
        expect(written[0].code).toBe("TS2322");
        expect(written[0].range.start).toEqual({ line: 2, character: 4 });
    });

    it("strips ANSI colour codes from the tapped output before matching", () => {
        const { controller, markers, sessions } = buildHarness();
        controller.runTask(TSC_TASK);
        sessions[0].emitData("\x1b[31mapp.ts(1,1): error TS1: boom\x1b[0m\n");
        sessions[0].emitExit(1);
        expect(markers.read({ owner: "typescript" })).toHaveLength(1);
    });

    it("re-running replaces the previous run's markers", () => {
        const { controller, markers, sessions } = buildHarness();

        controller.runTask(TSC_TASK);
        sessions[0].emitData("a.ts(1,1): error TS1: boom\nb.ts(1,1): error TS2: bad\n");
        sessions[0].emitExit(1);
        expect(markers.read()).toHaveLength(2);

        // Второй прогон: осталась ошибка только в a.ts — b.ts должен очиститься.
        controller.runTask(TSC_TASK);
        expect(sessions).toHaveLength(2);
        sessions[1].emitData("a.ts(1,1): error TS1: boom\n");
        sessions[1].emitExit(1);

        const after = markers.read({ owner: "typescript" });
        expect(after).toHaveLength(1);
        expect(after[0].resource).toBe(expectedResource("a.ts"));
    });

    it("disposes the previous PTY session when a new run starts", () => {
        const { controller, sessions } = buildHarness();
        controller.runTask(TSC_TASK);
        controller.runTask(TSC_TASK);
        expect(sessions[0].disposed).toBe(true);
        expect(sessions[1].disposed).toBe(false);
    });
});
