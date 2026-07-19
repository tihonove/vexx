import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import { Disposable } from "../../../../base/common/disposable.ts";
import { MenuId } from "../../../../platform/actions/common/menuId.ts";
import type { MenuService } from "../../../../platform/actions/common/menuService.ts";
import { MenuServiceDIToken } from "../../../../platform/actions/common/menuService.ts";
import { EditorService, EditorServiceDIToken } from "../../../services/editor/browser/editorService.ts";

import type { IWorkbenchContribution } from "../../../common/iWorkbenchContribution.ts";

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
