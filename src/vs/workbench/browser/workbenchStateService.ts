import * as fs from "node:fs";

import { Disposable } from "../../../../tuidom/common/disposable.ts";
import { token } from "../../platform/instantiation/common/diContainer.ts";
import type { IStateService } from "../../platform/state/common/iStateService.ts";
import { StateServiceDIToken } from "../common/coreTokens.ts";
import { OPEN_EDITORS_STATE } from "../common/stateKeys.ts";
import type { EditorService } from "../services/editor/browser/editorService.ts";
import { EditorServiceDIToken } from "../services/editor/browser/editorService.ts";

export const WorkbenchStateServiceDIToken = token<WorkbenchStateService>("WorkbenchStateService");

/**
 * Персистентность открытых редакторов (headless, без `view`): снимает открытые
 * файлы + активную вкладку в {@link IStateService} и реплеит их при старте
 * (см. docs/arch/State.md, раздел «Жизненный цикл»). Write-through — собственная
 * подписка на `EditorService.onActiveEditorChanged`.
 *
 * Layout-состояние (сайдбар/панель) персистит `LayoutService` — он владеет
 * швом к `WorkbenchLayoutElement`.
 */
export class WorkbenchStateService extends Disposable {
    public static dependencies = [StateServiceDIToken, EditorServiceDIToken] as const;

    public constructor(
        private readonly state: IStateService,
        private readonly editorGroup: EditorService,
    ) {
        super();
        this.register(
            this.editorGroup.onActiveEditorChanged(() => {
                this.captureOpenEditors();
            }),
        );
    }

    /** Открывает/переключает per-project стор состояния на папку `folderPath`. */
    public openWorkspace(folderPath: string): void {
        this.state.openWorkspace(folderPath);
    }

    /**
     * Пути, которые реально откроет {@link restoreOpenEditors} — сохранённые в
     * сессии файлы, пережившие удаление с диска. Отдельно от `restoreOpenEditors`,
     * потому что бутстрапу нужно узнать их **до** открытия: он прогревает их
     * грамматики, чтобы первый кадр вкладки был уже подсвеченным.
     */
    public getOpenEditorsToRestore(): string[] {
        return this.state.get(OPEN_EDITORS_STATE).files.filter((f) => fs.existsSync(f));
    }

    /**
     * Восстанавливает открытые файлы: реплеит пути через `openFile` и активирует
     * ранее активную вкладку. Отсутствующие на диске файлы пропускаются (как в
     * VS Code), индекс активной вкладки переотображается на выжившие.
     */
    public restoreOpenEditors(): void {
        const snapshot = this.state.get(OPEN_EDITORS_STATE);
        const activePath =
            snapshot.activeIndex >= 0 && snapshot.activeIndex < snapshot.files.length
                ? snapshot.files[snapshot.activeIndex]
                : undefined;
        const surviving = this.getOpenEditorsToRestore();
        for (const file of surviving) {
            this.editorGroup.openFile(file, { focus: false });
        }
        if (surviving.length === 0) return;
        const target = activePath !== undefined ? surviving.indexOf(activePath) : -1;
        this.editorGroup.activateTab(target >= 0 ? target : 0, { focus: false });
    }

    /** Снимает открытые файлы + активную вкладку в стор (индекс — относительно `files`). */
    public captureOpenEditors(): void {
        const files = this.editorGroup.getOpenFilePaths();
        // Вкладка, а не focus-aware активный редактор: при фокусе в нижней панели
        // путь был бы null, и восстановление теряло бы активную вкладку.
        const activePath = this.editorGroup.getActiveTabEditor()?.absoluteFilePath ?? null;
        const activeIndex = activePath !== null ? files.indexOf(activePath) : -1;
        this.state.store(OPEN_EDITORS_STATE, { files, activeIndex });
    }
}
