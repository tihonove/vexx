import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { NULL_CONFIGURATION_SERVICE } from "../Configuration/NullConfigurationService.ts";
import { createSelection } from "../Editor/ISelection.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { TestApp } from "../TestUtils/TestApp.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import { TUIMouseEvent } from "../TUIDom/Events/TUIMouseEvent.ts";
import { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

import type { EditorController } from "./EditorController.ts";
import { EditorGroupController } from "./EditorGroupController.ts";
import { FindController } from "./FindController.ts";
import { UndoRedoService } from "./Workspace/UndoRedoService.ts";

function makeGroup(): EditorGroupController {
    const themeService = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
    return new EditorGroupController(
        themeService,
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
    );
}

/** Simulates typing into the find input (drives the onChange → recompute chain). */
function typeQuery(find: FindController, query: string): void {
    find.view.inputElement.inputState.value = query;
    find.view.inputElement.onChange?.(query);
}

describe("FindController", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vexx-find-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function setup(text: string): {
        find: FindController;
        group: EditorGroupController;
        editor: EditorController;
        testApp: TestApp;
    } {
        const filePath = path.join(tmpDir, "file.txt");
        fs.writeFileSync(filePath, text);
        const group = makeGroup();
        group.openFile(filePath);

        const body = new BodyElement();
        body.setContent(group.view);
        const testApp = TestApp.create(body, new Size(80, 24));
        testApp.render();

        const find = new FindController(group);
        find.setHostView();

        // getActiveEditor() is non-null right after openFile.
        const editor = group.getActiveEditor()!;
        return { find, group, editor, testApp };
    }

    it("open() shows the widget and close() hides it", () => {
        const { find } = setup("foo bar foo");
        expect(find.isVisible()).toBe(false);
        find.open();
        expect(find.isVisible()).toBe(true);
        find.close();
        expect(find.isVisible()).toBe(false);
    });

    it("an outside pointer press does NOT close the widget", () => {
        // Unlike QuickPick, the find widget is non-modal and stays open when the
        // user clicks into the editor (so they can keep navigating matches).
        const { find, testApp } = setup("foo bar foo");
        find.open();
        expect(find.isVisible()).toBe(true);

        testApp.root.dispatchEvent(
            new TUIMouseEvent("mousedown", {
                screenX: 0,
                screenY: 0,
                localX: 0,
                localY: 0,
                button: "left",
            }),
        );

        expect(find.isVisible()).toBe(true);
    });

    it("typing seeds match highlights on the editor", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "foo");
        expect(editor.viewState.searchMatches).toHaveLength(2);
        expect(editor.viewState.currentSearchMatchIndex).toBe(0);
    });

    it("next() and prev() cycle through matches with wrap-around", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "foo");
        expect(editor.viewState.currentSearchMatchIndex).toBe(0);
        find.next();
        expect(editor.viewState.currentSearchMatchIndex).toBe(1);
        find.next(); // wraps
        expect(editor.viewState.currentSearchMatchIndex).toBe(0);
        find.prev(); // wraps backwards
        expect(editor.viewState.currentSearchMatchIndex).toBe(1);
    });

    it("right-aligns the widget one column shy of the group's edge", () => {
        const { find, group, testApp } = setup("foo bar foo");
        find.open();
        testApp.render();

        const groupWidth = group.view.layoutSize.width;
        const widgetW = Math.min(60, Math.max(28, groupWidth - 2));
        const borderRow = 1; // directly under the tab strip

        const charAt = (x: number): string => testApp.backend.getTextAt(new Point(x, borderRow), 1);

        // 1-col margin: the group's last column stays empty, the corner sits just inside it.
        expect(charAt(groupWidth - 1)).toBe(" ");
        expect(charAt(groupWidth - 2)).toBe("┐");
        // Top-left corner lands exactly widgetW columns to the left of the corner.
        expect(charAt(groupWidth - 1 - widgetW)).toBe("┌");
    });

    it("seeds the query from a single-line selection on open", () => {
        const { find, editor } = setup("foo bar foo");
        editor.viewState.selections = [createSelection(0, 0, 0, 3)]; // selects "foo"
        find.open();
        expect(find.view.getQuery()).toBe("foo");
        expect(editor.viewState.searchMatches).toHaveLength(2);
    });

    it("close() clears highlights and moves the cursor to the current match", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "foo");
        find.next(); // current = match at char 8
        find.close();

        expect(editor.viewState.searchMatches).toEqual([]);
        expect(editor.viewState.currentSearchMatchIndex).toBe(-1);
        const sel = editor.viewState.selections[0];
        expect(sel.anchor).toEqual({ line: 0, character: 8 });
        expect(sel.active).toEqual({ line: 0, character: 11 });
    });

    it("next() is a no-op when there are no matches", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "zzz");
        expect(editor.viewState.searchMatches).toEqual([]);
        expect(() => {
            find.next();
        }).not.toThrow();
        expect(editor.viewState.currentSearchMatchIndex).toBe(-1);
    });

    it("open() on an already-open widget just refocuses without re-seeding", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "foo");
        find.next(); // current = second match
        expect(editor.viewState.currentSearchMatchIndex).toBe(1);

        find.open(); // already open — must not reset the query or the current match
        expect(find.isVisible()).toBe(true);
        expect(find.view.getQuery()).toBe("foo");
        expect(editor.viewState.currentSearchMatchIndex).toBe(1);
    });

    it("wraps the current match to the first when the cursor sits past every match", () => {
        const { find, editor } = setup("foo bar foo");
        // Collapsed cursor at end of line — after both matches.
        editor.viewState.selections = [createSelection(0, 11, 0, 11)];
        find.open();
        typeQuery(find, "foo");
        expect(editor.viewState.currentSearchMatchIndex).toBe(0);
    });

    it("prev() is a no-op when there are no matches", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "zzz");
        expect(() => {
            find.prev();
        }).not.toThrow();
        expect(editor.viewState.currentSearchMatchIndex).toBe(-1);
    });

    it("wires the widget callbacks to next / prev / close", () => {
        const { find, editor } = setup("foo bar foo");
        find.open();
        typeQuery(find, "foo");

        find.view.onNext?.();
        expect(editor.viewState.currentSearchMatchIndex).toBe(1);
        find.view.onPrev?.();
        expect(editor.viewState.currentSearchMatchIndex).toBe(0);
        find.view.onClose?.();
        expect(find.isVisible()).toBe(false);
    });

    it("dispose() tears down the overlay session", () => {
        const { find } = setup("foo bar foo");
        find.open();
        expect(find.isVisible()).toBe(true);
        find.dispose();
        expect(find.isVisible()).toBe(false);
    });

    it("isVisible() is false before the host view is attached", () => {
        const group = makeGroup();
        const find = new FindController(group);
        expect(find.isVisible()).toBe(false);
    });

    it("next() tolerates the active editor disappearing after matches were found", () => {
        const { find, group } = setup("foo bar foo");
        find.open();
        typeQuery(find, "foo");

        // Editor closes (or detaches) while the widget is still open with stale matches.
        vi.spyOn(group, "getActiveEditor").mockReturnValue(null);
        expect(() => {
            find.next();
        }).not.toThrow();
    });

    it("opens without an active editor (empty group)", () => {
        const group = makeGroup();
        const body = new BodyElement();
        body.setContent(group.view);
        TestApp.create(body, new Size(80, 24)).render();
        const find = new FindController(group);
        find.setHostView();

        expect(() => {
            find.open();
        }).not.toThrow();
        expect(find.isVisible()).toBe(true);
        expect(() => {
            typeQuery(find, "foo");
        }).not.toThrow();
        // close() with no active editor must still hide the widget (skips cursor restore).
        expect(() => {
            find.close();
        }).not.toThrow();
        expect(find.isVisible()).toBe(false);
    });
});
