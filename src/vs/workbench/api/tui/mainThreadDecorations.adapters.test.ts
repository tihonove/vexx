import { describe, expect, it } from "vitest";

import type { EditorGroupController } from "../../tui/parts/editor/editorGroupController.ts";
import type { FileTreeController } from "../../contrib/files/tui/fileTreeController.ts";
import type { IGutterChangeDecoration } from "../../../editor/common/model/gutterChangeDecoration.ts";
import { createRange } from "../../../editor/common/core/range.ts";
import { darkPlusTheme } from "../../services/themes/common/themes/darkPlus.ts";
import { lightPlusTheme } from "../../services/themes/common/themes/lightPlus.ts";
import { ThemeService } from "../../services/themes/common/themeService.ts";
import { WorkbenchTheme } from "../../../platform/theme/common/workbenchTheme.ts";

import { EditorDecorationsServiceAdapter } from "./mainThreadEditorDecorations.ts";
import { FileDecorationsServiceAdapter } from "./mainThreadDecorations.ts";
import { ThemeColorResolverAdapter } from "./mainThreadThemeColors.ts";

/** Мини-редактор с наблюдаемым setGutterChangeDecorations. */
function fakeEditor(absoluteFilePath: string | null) {
    const received: (readonly IGutterChangeDecoration[])[] = [];
    return {
        absoluteFilePath,
        setGutterChangeDecorations: (d: readonly IGutterChangeDecoration[]) => received.push(d),
        received,
    };
}

function fakeGroup(editors: ReturnType<typeof fakeEditor>[]): EditorGroupController {
    return {
        editorCount: editors.length,
        getEditor: (i: number) => editors[i] ?? null,
    } as unknown as EditorGroupController;
}

describe("EditorDecorationsServiceAdapter", () => {
    it("проталкивает декорации в редакторы совпадающего пути (и только в них)", () => {
        const match = fakeEditor("/proj/a.ts");
        const other = fakeEditor("/proj/b.ts");
        const adapter = new EditorDecorationsServiceAdapter(fakeGroup([match, other]));
        const decos = [{ range: createRange(1, 0, 1, 0), color: 0x123456 }];

        adapter.setGutterChangeDecorations("/proj/a.ts", decos);

        expect(match.received).toEqual([decos]);
        expect(other.received).toEqual([]);
    });

    it("нормализует путь через path.resolve (относительный vs абсолютный)", () => {
        const match = fakeEditor("/proj/a.ts");
        const adapter = new EditorDecorationsServiceAdapter(fakeGroup([match]));
        adapter.setGutterChangeDecorations("/proj/./sub/../a.ts", []);
        expect(match.received).toEqual([[]]);
    });

    it("редакторы без пути (null) пропускаются", () => {
        const untitled = fakeEditor(null);
        const adapter = new EditorDecorationsServiceAdapter(fakeGroup([untitled]));
        adapter.setGutterChangeDecorations("/proj/a.ts", [{ range: createRange(0, 0, 0, 0), color: 1 }]);
        expect(untitled.received).toEqual([]);
    });

    it("пустой слот группы (getEditor === null) пропускается", () => {
        // editorCount > фактического числа редакторов → getEditor(1) === null.
        const group = { editorCount: 2, getEditor: (i: number) => (i === 0 ? fakeEditor("/proj/a.ts") : null) };
        const adapter = new EditorDecorationsServiceAdapter(group as unknown as EditorGroupController);
        expect(() => adapter.setGutterChangeDecorations("/proj/a.ts", [])).not.toThrow();
    });
});

describe("FileDecorationsServiceAdapter", () => {
    it("делегирует setFileDecorations в FileTreeController", () => {
        const calls: unknown[] = [];
        const fileTree = { setFileDecorations: (e: unknown) => calls.push(e) } as unknown as FileTreeController;
        const adapter = new FileDecorationsServiceAdapter(fileTree);
        const entries = [{ path: "/proj/notes.md", color: 0xe2c08d, badge: "M" }];
        adapter.setFileDecorations(entries);
        expect(calls).toEqual([entries]);
    });
});

describe("ThemeColorResolverAdapter", () => {
    it("резолвит id цвета активной темы в packed-RGB; неизвестный id → undefined", () => {
        const theme = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const adapter = new ThemeColorResolverAdapter(theme);
        expect(adapter.resolve("editorGutter.modifiedBackground")).toBe(
            theme.theme.getColor("editorGutter.modifiedBackground"),
        );
        expect(adapter.resolve("no.such.color")).toBeUndefined();
    });

    it("onDidChange глотает немедленный вызов, стреляет только на смене темы", () => {
        const theme = new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        const adapter = new ThemeColorResolverAdapter(theme);
        let fired = 0;
        const disposable = adapter.onDidChange(() => fired++);
        expect(fired).toBe(0); // начальный синхронный вызов проглочен

        theme.setTheme(WorkbenchTheme.fromThemeFile(lightPlusTheme));
        expect(fired).toBe(1);

        disposable.dispose();
        theme.setTheme(WorkbenchTheme.fromThemeFile(darkPlusTheme));
        expect(fired).toBe(1); // после dispose — тишина
    });
});
