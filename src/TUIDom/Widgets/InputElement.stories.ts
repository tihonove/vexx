import type { StoryContext, StoryMeta } from "../../StoryRunner/StoryTypes.ts";
import { VStackElement } from "./VStackElement.ts";
import { InputElement } from "./InputElement.ts";

export const meta: StoryMeta = {
    title: "InputElement",
};

/** Plain input without border. Type text, use arrow keys, Backspace. */
export function basicInput(ctx: StoryContext): void {
    ctx.body.title = "InputElement — basic (no border)";
    const input = new InputElement();
    ctx.body.setContent(input);

    ctx.afterRun(() => {
        input.focus();
    });
}

/** Input with Unicode box-drawing border. Border colour changes on focus. */
export function withBorder(ctx: StoryContext): void {
    ctx.body.title = "InputElement — showBorder = true";
    const input = new InputElement();
    input.showBorder = true;

    const stack = new VStackElement();
    stack.addChild(input, { width: "fill", height: 3 });
    ctx.body.setContent(stack);

    ctx.afterRun(() => {
        input.focus();
    });
}

/** Input with placeholder text shown when empty. */
export function withPlaceholder(ctx: StoryContext): void {
    ctx.body.title = "InputElement — placeholder";
    const input = new InputElement();
    input.placeholder = "Type to search…";

    ctx.body.setContent(input);

    ctx.afterRun(() => {
        input.focus();
    });
}

/** Input with border and placeholder — both focused and unfocused variants in a stack. */
export function focusCycling(ctx: StoryContext): void {
    ctx.body.title = "InputElement — Tab to cycle focus (see border colour change)";
    const stack = new VStackElement();

    const first = new InputElement();
    first.showBorder = true;
    first.placeholder = "First input…";

    const second = new InputElement();
    second.showBorder = true;
    second.placeholder = "Second input…";

    stack.addChild(first, { width: "fill", height: 3 });
    stack.addChild(second, { width: "fill", height: 3 });
    ctx.body.setContent(stack);

    ctx.afterRun(() => {
        first.focus();
    });
}

/** Input pre-filled with long text to test horizontal scrolling. */
export function longText(ctx: StoryContext): void {
    ctx.body.title = "InputElement — long text / horizontal scroll";
    const input = new InputElement();
    input.inputState.value = "The quick brown fox jumps over the lazy dog — a very long sentence to test scrolling behaviour.";
    input.placeholder = "Type something long…";

    ctx.body.setContent(input);

    ctx.afterRun(() => {
        input.focus();
    });
}
