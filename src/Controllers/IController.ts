import type { IDisposable } from "../Common/Disposable.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";

export interface IController extends IDisposable {
    readonly view: TUIElement;

    mount(): void;
    activate(): Promise<void>;
}
