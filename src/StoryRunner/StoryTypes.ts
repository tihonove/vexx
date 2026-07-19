import type { TuiApplication } from "../../tuidom/dom/tuiApplication.ts";
import type { TUIElement } from "../../tuidom/dom/tuiElement.ts";
import type { BodyElement } from "../vs/base/browser/ui/body/bodyElement.ts";

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
