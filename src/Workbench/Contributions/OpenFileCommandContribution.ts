import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import type { CommandRegistry } from "../Services/CommandRegistry.ts";
import { CommandRegistryDIToken } from "../Services/CommandRegistry.ts";
import { EditorService, EditorServiceDIToken } from "../Services/EditorService.ts";
import { WorkbenchContextKeys, WorkbenchContextKeysDIToken } from "../Services/WorkbenchContextKeys.ts";

import type { IWorkbenchContribution } from "./IWorkbenchContribution.ts";

export const OpenFileCommandContributionDIToken = token<OpenFileCommandContribution>("OpenFileCommandContribution");

/**
 * Регистрирует программную команду `workbench.openFile` (открыть файл по
 * абсолютному пути) — её дёргают Explorer (активация файла) и Quick Open.
 * Команда без title: в палитру команд не попадает (как и раньше).
 */
export class OpenFileCommandContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [CommandRegistryDIToken, EditorServiceDIToken, WorkbenchContextKeysDIToken] as const;

    public constructor(
        commands: CommandRegistry,
        private readonly editorService: EditorService,
        private readonly contextKeys: WorkbenchContextKeys,
    ) {
        super();
        this.register(
            commands.register("workbench.openFile", (absolutePath: unknown) => {
                this.editorService.openFile(absolutePath as string);
                this.contextKeys.update();
            }),
        );
    }
}
