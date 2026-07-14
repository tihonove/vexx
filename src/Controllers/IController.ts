import type { IDisposable } from "../vs/base/common/lifecycle.ts";
import type { TUIElement } from "../vs/base/tui/tuiElement.ts";

export interface IController extends IDisposable {
    readonly view: TUIElement;

    mount(): void;
    activate(): Promise<void>;
}
