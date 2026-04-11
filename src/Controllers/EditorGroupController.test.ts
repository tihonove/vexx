import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EditorGroupController } from "./EditorGroupController.ts";

describe("EditorGroupController", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFile(name: string, content: string): string {
        const filePath = path.join(tmpDir, name);
        fs.writeFileSync(filePath, content, "utf-8");
        return filePath;
    }

    describe("openFile", () => {
        it("opens a file and creates a tab", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            const fp = writeFile("hello.ts", "const x = 1;");

            ctrl.openFile(fp);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("hello.ts");
        });

        it("opens multiple files", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            const fp1 = writeFile("a.ts", "a");
            const fp2 = writeFile("b.ts", "b");

            ctrl.openFile(fp1);
            ctrl.openFile(fp2);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(1);
        });

        it("switches to existing tab if file already open", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            const fp = writeFile("a.ts", "a");

            ctrl.openFile(fp);
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.openFile(fp);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(0);
        });
    });

    describe("activateTab", () => {
        it("switches to the specified tab", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.activateTab(0);

            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("ignores out-of-range index", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            ctrl.activateTab(5);

            expect(ctrl.activeIndex).toBe(0);
        });

        it("updates view content to the active editor", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            const editorA = ctrl.getActiveEditor();
            ctrl.activateTab(0);
            const content = ctrl.view.getContent();
            expect(content).toBeDefined();
        });
    });

    describe("closeTab", () => {
        it("closes the only tab", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));

            ctrl.closeTab(0);

            expect(ctrl.editorCount).toBe(0);
            expect(ctrl.activeIndex).toBe(-1);
            expect(ctrl.view.getContent()).toBeNull();
        });

        it("closes middle tab and adjusts activeIndex", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.openFile(writeFile("c.ts", "c"));
            ctrl.activateTab(1);

            ctrl.closeTab(1);

            expect(ctrl.editorCount).toBe(2);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("closes last tab and activates previous", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.closeTab(1);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("a.ts");
        });

        it("closes first tab when second is active", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));
            ctrl.activateTab(1);

            ctrl.closeTab(0);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.activeIndex).toBe(0);
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
        });
    });

    describe("syncTabs", () => {
        it("updates tab strip with current file names", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            const items = ctrl.view.tabStrip.getItemElements();
            expect(items).toHaveLength(2);
            expect(items[0].getLabel()).toBe("a.ts");
            expect(items[1].getLabel()).toBe("b.ts");
        });

        it("sets active index on tab strip", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            expect(ctrl.view.tabStrip.activeIndex).toBe(1);

            ctrl.activateTab(0);
            expect(ctrl.view.tabStrip.activeIndex).toBe(0);
        });
    });

    describe("tab callbacks", () => {
        it("onTabActivate switches to the clicked tab", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.view.tabStrip.onTabActivate?.(0);

            expect(ctrl.activeIndex).toBe(0);
        });

        it("onTabClose closes the clicked tab", () => {
            const ctrl = new EditorGroupController();
            ctrl.mount();
            ctrl.openFile(writeFile("a.ts", "a"));
            ctrl.openFile(writeFile("b.ts", "b"));

            ctrl.view.tabStrip.onTabClose?.(0);

            expect(ctrl.editorCount).toBe(1);
            expect(ctrl.getActiveEditor()?.fileName).toBe("b.ts");
        });
    });
});
