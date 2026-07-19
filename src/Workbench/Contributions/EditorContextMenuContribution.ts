import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import { MenuId } from "../Menus/MenuId.ts";
import type { MenuService } from "../Menus/MenuService.ts";
import { MenuServiceDIToken } from "../Menus/MenuService.ts";
import { EditorService, EditorServiceDIToken } from "../Services/EditorService.ts";

import type { IWorkbenchContribution } from "./IWorkbenchContribution.ts";

export const EditorContextMenuContributionDIToken = token<EditorContextMenuContribution>(
    "EditorContextMenuContribution",
);

/**
 * Наполняет контекст-меню каждого создаваемого редактора живым меню
 * {@link MenuService.createMenu} (`MenuId.EditorContext`). Ставит провайдер,
 * который резолвит пункты в момент ОТКРЫТИЯ меню (учитывая `when`-контекст), в
 * `EditorService.onEditorCreate` — до открытия первого редактора.
 */
export class EditorContextMenuContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [EditorServiceDIToken, MenuServiceDIToken] as const;

    public constructor(
        private readonly editorService: EditorService,
        menuService: MenuService,
    ) {
        super();
        const menu = this.register(menuService.createMenu(MenuId.EditorContext));
        this.editorService.onEditorCreate = (editor) => {
            editor.contextMenuProvider = () => menu.getEntries();
        };
    }
}
