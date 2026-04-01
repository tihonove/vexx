import { MockTerminalBackend } from "../Backend/MockTerminalBackend.ts";
import { Size } from "../Common/GeometryPromitives.ts";
import { TuiApplication } from "../TUIDom/TuiApplication.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";

export class TestApp {
    public readonly backend: MockTerminalBackend;
    public readonly app: TuiApplication;

    private constructor(backend: MockTerminalBackend, root: TUIElement) {
        this.backend = backend;
        this.app = new TuiApplication(backend);
        this.app.root = root;
        this.app.run();
    }

    public static create(root: TUIElement, size: Size = new Size(80, 24)): TestApp {
        return new TestApp(new MockTerminalBackend(size), root);
    }

    public get root(): TUIElement {
        return this.app.root!;
    }

    public get focusedElement(): TUIElement | null {
        return this.app.focusManager?.activeElement ?? null;
    }

    public sendKey(name: string): void {
        this.backend.sendKey(name);
    }

    public querySelector(selector: string): TUIElement | null {
        return this.root.querySelector(selector);
    }

    public querySelectorAll(selector: string): TUIElement[] {
        return this.root.querySelectorAll(selector);
    }

    public render(): void {
        // Force a synchronous render (app.run already did the initial one,
        // and handleInput renders after each key, but this is useful
        // if the test mutates state without going through input).
        this.app["renderFrame"]();
    }
}
