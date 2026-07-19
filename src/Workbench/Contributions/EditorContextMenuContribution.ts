import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import { MenuId } from "../Menus/MenuId.ts";
import type { MenuRegistry } from "../Menus/MenuRegistry.ts";
import { MenuRegistryDIToken } from "../Menus/MenuRegistry.ts";
import { EditorService, EditorServiceDIToken } from "../Services/EditorService.ts";

import type { IWorkbenchContribution } from "./IWorkbenchContribution.ts";

export const EditorContextMenuContributionDIToken = token<EditorContextMenuContribution>(
    "EditorContextMenuContribution",
);

/**
 * Наполняет контекст-меню каждого создаваемого редактора пунктами из
 * {@link MenuRegistry} (`MenuId.EditorContext`). Ставит провайдер, который
 * резолвит пункты в момент ОТКРЫТИЯ меню (учитывая `when`-контекст), в
 * `EditorService.onEditorCreate` — до открытия первого редактора.
 */
export class EditorContextMenuContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [EditorServiceDIToken, MenuRegistryDIToken] as const;

    public constructor(
        private readonly editorService: EditorService,
        private readonly menuRegistry: MenuRegistry,
    ) {
        super();
        this.editorService.onEditorCreate = (editor) => {
            editor.contextMenuProvider = () => this.menuRegistry.getMenuItems(MenuId.EditorContext);
        };
    }
}
