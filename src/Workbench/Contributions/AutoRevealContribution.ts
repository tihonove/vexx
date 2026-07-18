import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import { EditorService, EditorServiceDIToken } from "../Services/EditorService.ts";
import { ExplorerService, ExplorerServiceDIToken } from "../Services/ExplorerService.ts";

import type { IWorkbenchContribution } from "./IWorkbenchContribution.ts";

export const AutoRevealContributionDIToken = token<AutoRevealContribution>("AutoRevealContribution");

/**
 * Автоподсветка активного файла в дереве Explorer'а при смене активного
 * редактора (`explorer.autoReveal`). Сам gate по настройке и reveal живут в
 * {@link ExplorerService.autoRevealActiveFile}; contribution лишь связывает
 * смену активного редактора с этим вызовом.
 */
export class AutoRevealContribution extends Disposable implements IWorkbenchContribution {
    public static dependencies = [EditorServiceDIToken, ExplorerServiceDIToken] as const;

    public constructor(
        private readonly editorService: EditorService,
        private readonly explorerService: ExplorerService,
    ) {
        super();
        this.register(
            this.editorService.onActiveEditorChanged(() => {
                this.explorerService.autoRevealActiveFile(
                    this.editorService.getActiveEditor()?.absoluteFilePath ?? null,
                );
            }),
        );
    }
}
