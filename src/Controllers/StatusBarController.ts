import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { StatusBarItem } from "../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import type { EditorGroupController } from "./EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import type { IController } from "./IController.ts";

export const StatusBarControllerDIToken = token<StatusBarController>("StatusBarController");

export class StatusBarController extends Disposable implements IController {
    public static dependencies = [EditorGroupControllerDIToken] as const;

    public readonly view: StatusBarElement;
    private editorGroupController: EditorGroupController;

    public constructor(editorGroupController: EditorGroupController) {
        super();
        this.editorGroupController = editorGroupController;
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
        const activeEditor = this.editorGroupController.getActiveEditor();

        if (activeEditor?.fileName) {
            items.push({ text: activeEditor.fileName });
        }

        if (activeEditor?.isModified) {
            items.push({ text: "[Modified]" });
        }

        this.view.setItems(items);
    }
}
