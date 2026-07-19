import { TUIEventBase } from "./tuiEventBase.ts";

/**
 * Bracketed-paste event: the terminal delivered a clipboard paste as one literal
 * text block. Dispatched to the focused element so it can insert the whole text in
 * a single edit (newlines preserved), instead of replaying it as keystrokes.
 */
export class TUIPasteEvent extends TUIEventBase {
    public readonly text: string;

    public constructor(text: string, bubbles = true) {
        super("paste", bubbles);
        this.text = text;
    }
}
