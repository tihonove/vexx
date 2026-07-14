import type { IDisposable } from "../../base/common/lifecycle.ts";
import type { TUIElement } from "../../base/tui/tuiElement.ts";

export interface IController extends IDisposable {
    readonly view: TUIElement;

    mount(): void;
    activate(): Promise<void>;
}
