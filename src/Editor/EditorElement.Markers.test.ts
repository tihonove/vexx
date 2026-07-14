import { describe, expect, it } from "vitest";

import { Point, Size } from "../Common/GeometryPromitives.ts";
import { packRgb } from "../vs/tui/rendering/colorUtils.ts";
import { TestApp } from "../TestUtils/TestApp.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { createRange } from "./IRange.ts";
import { MarkerSeverity } from "./Markers/IMarker.ts";
import { TextDocument } from "./TextDocument.ts";

function makeEditor(content: string): EditorElement {
    const doc = new TextDocument(content);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    editor.occurrenceHighlightEnabled = false; // isolate the squiggle pass from word highlighting
    return editor;
}

const WARNING_FG = packRgb(1, 2, 3);

describe("EditorElement — marker squiggle decorations", () => {
    it("paints the severity foreground over the marker range only", () => {
        const editor = makeEditor("abcdef");
        editor.warningForeground = WARNING_FG;
        editor.markerDecorations = [{ range: createRange(0, 0, 0, 3), severity: MarkerSeverity.Warning }];

        const app = TestApp.createWithContent(editor, new Size(40, 4));
        app.render();

        const gw = editor.gutterWidth;
        // Covered cells (a, b, c) take the warning colour.
        expect(app.backend.getFgAt(new Point(gw + 0, 0))).toBe(WARNING_FG);
        expect(app.backend.getFgAt(new Point(gw + 2, 0))).toBe(WARNING_FG);
        // The cell just past the range keeps the editor foreground.
        expect(app.backend.getFgAt(new Point(gw + 3, 0))).toBe(editor.resolvedStyle.fg);
    });

    it("maps each severity to its configured colour", () => {
        const cases = [
            { severity: MarkerSeverity.Error, field: "errorForeground" as const, color: packRgb(200, 0, 0) },
            { severity: MarkerSeverity.Warning, field: "warningForeground" as const, color: packRgb(200, 160, 0) },
            { severity: MarkerSeverity.Info, field: "infoForeground" as const, color: packRgb(0, 120, 255) },
            { severity: MarkerSeverity.Hint, field: "hintForeground" as const, color: packRgb(180, 180, 180) },
        ];
        for (const { severity, field, color } of cases) {
            const editor = makeEditor("abcdef");
            editor[field] = color;
            editor.markerDecorations = [{ range: createRange(0, 0, 0, 2), severity }];
            const app = TestApp.createWithContent(editor, new Size(40, 4));
            app.render();
            expect(app.backend.getFgAt(new Point(editor.gutterWidth, 0))).toBe(color);
        }
    });

    it("falls back to the built-in colours when the theme has not set them", () => {
        // Every severity foreground left undefined → the VS Code dark defaults.
        const fallbacks = [
            { severity: MarkerSeverity.Error, color: packRgb(0xf1, 0x4c, 0x4c) },
            { severity: MarkerSeverity.Warning, color: packRgb(0xcc, 0xa7, 0x00) },
            { severity: MarkerSeverity.Info, color: packRgb(0x37, 0x94, 0xff) },
            { severity: MarkerSeverity.Hint, color: packRgb(0xee, 0xee, 0xee) },
        ];
        for (const { severity, color } of fallbacks) {
            const editor = makeEditor("abcdef");
            editor.markerDecorations = [{ range: createRange(0, 0, 0, 2), severity }];
            const app = TestApp.createWithContent(editor, new Size(40, 4));
            app.render();
            expect(app.backend.getFgAt(new Point(editor.gutterWidth, 0))).toBe(color);
        }
    });
});
