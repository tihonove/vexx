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
    ctx.body.setContent(editor);
}
