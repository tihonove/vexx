import type { TuiApplication } from "../TUIDom/TuiApplication.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import type { BodyElement } from "../TUIDom/Widgets/BodyElement.ts";

export interface StoryContext {
    readonly app: TuiApplication;
    readonly body: BodyElement;
    readonly args: string[];
    afterRun(cb: () => void | Promise<void>): void;
}

export type StoryFunction = (ctx: StoryContext) => TUIElement | void | Promise<TUIElement | void>;

export interface StoryMeta {
    title?: string;
}

export interface StoryModule {
    meta?: StoryMeta;
    [key: string]: StoryFunction | StoryMeta | undefined;
}
