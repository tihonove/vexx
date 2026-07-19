import { packRgb } from "../../../../tuidom/common/colorUtils.ts";
import type { StoryContext, StoryMeta } from "../../../StoryRunner/StoryTypes.ts";
import { TextDocument } from "../common/model/textDocument.ts";
import { EditorViewState } from "../common/viewModel/editorViewState.ts";

import { EditorElement, unthemedEditorStyles } from "./editorElement.ts";

export const meta: StoryMeta = {
    title: "EditorElement",
};

export function withSampleText(ctx: StoryContext): void {
    const sampleText = `Hello, World!
Welcome to vexx — a TUI text editor.
Start typing to edit this document.

Line 5 is here.
And line 6.
Have fun!`;

    const doc = new TextDocument(sampleText);
    const viewState = new EditorViewState(doc);
    const editor = new EditorElement(viewState);
    editor.style = { fg: packRgb(212, 212, 212), bg: packRgb(30, 30, 30) };
    editor.setStyles({
        ...unthemedEditorStyles,
        gutterBackground: packRgb(30, 30, 30),
        lineNumberForeground: packRgb(133, 133, 133),
        lineNumberActiveForeground: packRgb(198, 198, 198),
    });
    ctx.body.setContent(editor);
}
