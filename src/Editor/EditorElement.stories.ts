import { packRgb } from "../Rendering/ColorUtils.ts";
import type { StoryContext, StoryMeta } from "../StoryRunner/StoryTypes.ts";

import { EditorElement } from "./EditorElement.ts";
import { EditorViewState } from "./EditorViewState.ts";
import { TextDocument } from "./TextDocument.ts";

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
    editor.gutterBackground = packRgb(30, 30, 30);
    editor.lineNumberForeground = packRgb(133, 133, 133);
    editor.lineNumberActiveForeground = packRgb(198, 198, 198);
    ctx.body.setContent(editor);
}
