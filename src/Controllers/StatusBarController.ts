import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { StatusBarItem } from "../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import type { EditorController } from "./EditorController.ts";
import { EditorControllerDIToken } from "./EditorController.ts";
import type { IController } from "./IController.ts";

export const StatusBarControllerDIToken = token<StatusBarController>("StatusBarController");

export class StatusBarController extends Disposable implements IController {
    public static dependencies = [EditorControllerDIToken] as const;

    public readonly view: StatusBarElement;
    private editorController: EditorController;

    public constructor(editorController: EditorController) {
        super();
        this.editorController = editorController;
        this.view = new StatusBarElement();
    }

    public mount(): void {
        // Initial update
        this.update();
    }

    public async activate(): Promise<void> {
        // Nothing needed
    }

    public update(): void {
        const items: StatusBarItem[] = [];
        const fileName = this.editorController.fileName;

        if (fileName) {
            items.push({ text: fileName });
        }

        if (this.editorController.isModified) {
            items.push({ text: "[Modified]" });
        }

        this.view.setItems(items);
    }
}
