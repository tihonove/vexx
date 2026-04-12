import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import { packRgb } from "../Rendering/ColorUtils.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { StatusBarItem } from "../TUIDom/Widgets/StatusBarElement.ts";
import { StatusBarElement } from "../TUIDom/Widgets/StatusBarElement.ts";

import type { EditorGroupController } from "./EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import type { IController } from "./IController.ts";

export const StatusBarControllerDIToken = token<StatusBarController>("StatusBarController");

export class StatusBarController extends Disposable implements IController {
    public static dependencies = [EditorGroupControllerDIToken, ThemeServiceDIToken] as const;

    public readonly view: StatusBarElement;
    private editorGroupController: EditorGroupController;

    public constructor(editorGroupController: EditorGroupController, themeService: ThemeService) {
        super();
        this.editorGroupController = editorGroupController;
        this.view = new StatusBarElement();
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public mount(): void {
        // Initial update
        this.update();
    }

    public async activate(): Promise<void> {
        // Nothing needed
    }

    private applyTheme(theme: WorkbenchTheme): void {
        const bg = theme.getColorOrDefault("statusBar.background", packRgb(0, 122, 204));
        const fg = theme.getColorOrDefault("statusBar.foreground", packRgb(255, 255, 255));
        this.view.style = { fg, bg };
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
