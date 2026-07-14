import type { TuiApplication } from "../vs/base/tui/tuiApplication.ts";
import type { TUIElement } from "../vs/base/tui/tuiElement.ts";
import type { BodyElement } from "../vs/base/tui/bodyElement.ts";

export interface StoryContext {
    readonly app: TuiApplication;
    readonly body: BodyElement;
    readonly args: string[];
    afterRun(cb: () => void | Promise<void>): void;
}

export type StoryFunction = (ctx: StoryContext) => TUIElement | undefined | Promise<TUIElement | undefined>;

export interface StoryMeta {
    title?: string;
}

export interface StoryModule {
    meta?: StoryMeta;
    [key: string]: StoryFunction | StoryMeta | undefined;
}
