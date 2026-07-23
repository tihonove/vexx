import { Disposable } from "../../../../../../tuidom/common/disposable.ts";
import { Uri } from "../../../../base/common/uri.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import type { EditorPane } from "../../../browser/parts/editor/editorPane.ts";
import type { PanelService } from "../../../browser/parts/panel/panelService.ts";
import { PanelServiceDIToken } from "../../../browser/parts/panel/panelService.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";
import { EditorServiceDIToken } from "../../../services/editor/browser/editorService.ts";
import { OUTPUT_LANGUAGE_ID, OUTPUT_URI_SCHEME, OUTPUT_VIEW_ID } from "../../../services/output/common/output.ts";
import type { OutputService } from "../../../services/output/common/outputService.ts";
import { formatOutputLine, OutputServiceDIToken } from "../../../services/output/common/outputService.ts";

export const OutputComponentDIToken = token<OutputComponent>("OutputComponent");

/**
 * View-владелец вкладки OUTPUT: держит ОДИН detached-редактор (см.
 * `EditorService.openDetached`) и переливает в него содержимое активного канала.
 * Как и в VS Code, контент Output — обычный read-only редактор над моделью с
 * языком `log`: выделение, копирование, Ctrl+F и подсветка достаются даром.
 *
 * Не `Component`: собственного корневого контрола нет — редактор попадает в
 * панель через `PanelService.setViewContent`, ровно как виджет терминала.
 */
export class OutputComponent extends Disposable {
    public static dependencies = [OutputServiceDIToken, PanelServiceDIToken, EditorServiceDIToken] as const;

    /** Редактор канала; создаётся лениво — до открытия вкладки он не нужен. */
    private pane: EditorPane | null = null;
    /** Канал, содержимое которого сейчас залито в редактор. */
    private loadedChannelId: string | null = null;

    public constructor(
        private readonly outputService: OutputService,
        private readonly panelService: PanelService,
        private readonly editorService: EditorService,
    ) {
        super();
        this.panelService.addView({
            id: OUTPUT_VIEW_ID,
            title: "OUTPUT",
            content: null,
            placeholder: "No output yet.",
        });

        this.register(
            this.outputService.onDidChangeActiveChannel(() => {
                this.syncActiveChannel();
            }),
        );
        // Живой хвост: дописываем строку от имени владельца документа — read-only
        // запрещает правки пользователя, но не владельца (см. appendOwnedContent).
        this.register(
            this.outputService.onDidAppendToActiveChannel((entry) => {
                if (this.pane === null) return;
                this.pane.model.appendOwnedContent(`${formatOutputLine(entry)}\n`);
                this.revealLastLine(this.pane);
            }),
        );
        // Ленивая инициализация: вкладку открыли — только тогда поднимаем редактор.
        this.register(
            this.panelService.onDidActivateView((id) => {
                if (id === OUTPUT_VIEW_ID) this.syncActiveChannel();
            }),
        );
    }

    /** Фокус в редактор Output (для toggle-команды). */
    public focus(): void {
        this.syncActiveChannel();
        this.pane?.focusEditor();
    }

    /** Приводит редактор к активному каналу: контент + метка вкладки. */
    private syncActiveChannel(): void {
        const channelId = this.outputService.getActiveChannelId();
        if (channelId === null) return;
        const pane = this.ensurePane();
        if (this.loadedChannelId !== channelId) {
            this.loadedChannelId = channelId;
            pane.model.replaceOwnedContent(this.outputService.renderChannel(channelId));
        }
        this.revealLastLine(pane);
    }

    private ensurePane(): EditorPane {
        if (this.pane !== null) return this.pane;
        // Ресурс канала синтетический (`output:<id>`), как в VS Code: файла нет,
        // содержимое даёт сервис.
        const pane = this.editorService.openDetached(
            Uri.from({ scheme: OUTPUT_URI_SCHEME, path: "channel" }),
            OUTPUT_LANGUAGE_ID,
        );
        pane.readOnly = true;
        this.pane = pane;
        this.panelService.setViewContent(OUTPUT_VIEW_ID, pane.view);
        return pane;
    }

    /**
     * Автоскролл к последней строке (VS Code `revealLastLine`). Курсор в конец
     * документа — скролл подтягивается за ним. Read-only движению курсора не
     * мешает: он запрещает правки, а не навигацию.
     */
    private revealLastLine(pane: EditorPane): void {
        const lastLine = Math.max(0, pane.viewState.document.lineCount - 1);
        pane.goToPosition(lastLine, 0);
    }
}
