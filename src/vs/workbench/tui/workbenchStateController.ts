import * as fs from "node:fs";

import { Disposable } from "../../base/common/lifecycle.ts";
import type { IStateService } from "../../platform/state/node/state.ts";
import type { WorkbenchLayoutElement } from "./workbenchLayoutElement.ts";

import type { EditorGroupController } from "./parts/editor/editorGroupController.ts";
import {
    OPEN_EDITORS_STATE,
    PANEL_HEIGHT_STATE,
    PANEL_VISIBLE_STATE,
    SIDEBAR_VISIBLE_STATE,
    SIDEBAR_WIDTH_STATE,
} from "../common/stateKeys.ts";

/**
 * Единый координатор персистентности workbench-состояния (headless, без `view`).
 * Изолирует всю проводку «состояние ↔ UI» в одном тестируемом месте вместо
 * размазывания по `AppController` (см. docs/arch/State.md, раздел «Жизненный
 * цикл»).
 *
 * TUIDom остаётся чистым: `WorkbenchLayoutElement` про DI/StateService не знает —
 * координатор читает/пишет его через публичные геттеры/сеттеры. Ссылку на элемент
 * даёт `AppController` (владелец), поэтому она приходит в конструктор, а не через
 * DI.
 */
export class WorkbenchStateController extends Disposable {
    /** Пока идёт restore, сеттеры элемента фаерят `onDidChangeLayout` — глушим авто-capture. */
    private restoring = false;

    public constructor(
        private readonly state: IStateService,
        private readonly editorGroup: EditorGroupController,
        private readonly layout: WorkbenchLayoutElement,
    ) {
        super();
    }

    /** Открывает/переключает per-project стор состояния на папку `folderPath`. */
    public openWorkspace(folderPath: string): void {
        this.state.openWorkspace(folderPath);
    }

    /** Применяет сохранённый layout к элементу через его публичные сеттеры. */
    public restoreLayout(): void {
        this.restoring = true;
        try {
            this.layout.setLeftPanelWidth(this.state.get(SIDEBAR_WIDTH_STATE));
            this.layout.setLeftPanelVisible(this.state.get(SIDEBAR_VISIBLE_STATE));
            this.layout.setBottomPanelHeight(this.state.get(PANEL_HEIGHT_STATE));
            this.layout.setBottomPanelVisible(this.state.get(PANEL_VISIBLE_STATE));
            this.layout.markDirty();
        } finally {
            this.restoring = false;
        }
    }

    /** Снимает текущий layout из элемента в стор (write-through). No-op во время restore. */
    public captureLayout(): void {
        if (this.restoring) return;
        this.state.store(SIDEBAR_WIDTH_STATE, this.layout.getLeftPanelWidth());
        this.state.store(SIDEBAR_VISIBLE_STATE, this.layout.getLeftPanelVisible());
        this.state.store(PANEL_HEIGHT_STATE, this.layout.getBottomPanelHeight());
        this.state.store(PANEL_VISIBLE_STATE, this.layout.getBottomPanelVisible());
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
        const surviving = snapshot.files.filter((f) => fs.existsSync(f));
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
        const activePath = this.editorGroup.getActiveEditor()?.absoluteFilePath ?? null;
        const activeIndex = activePath !== null ? files.indexOf(activePath) : -1;
        this.state.store(OPEN_EDITORS_STATE, { files, activeIndex });
    }
}
