import { Point } from "../../../../base/common/geometry.ts";
import type { BodyElement } from "../../../../base/tui/bodyElement.ts";
import { AboutDialogElement } from "../../../../base/tui/ui/dialog/aboutDialogElement.tsx";
import type { ConfirmDialogOptions } from "../../../../base/tui/ui/dialog/confirmDialogElement.tsx";
import { ConfirmDialogElement } from "../../../../base/tui/ui/dialog/confirmDialogElement.tsx";
import { ConfirmSaveDialogElement } from "../../../../base/tui/ui/dialog/confirmSaveDialogElement.tsx";
import type { OverlaySessionHandle } from "../../../../base/tui/ui/contextview/overlayLayer.ts";
import type { WorkbenchTheme } from "../../themes/common/workbenchTheme.ts";

/**
 * Модальные диалоги воркбенча (аналог vscode `IDialogService`): подтверждение
 * сохранения при закрытии/выходе, генеричный confirm (delete/overwrite/undo)
 * и About. Владеет overlay-сессиями и центрирует диалоги по экрану; хост
 * прокидывает применение темы через {@link applyTheme}.
 */
export class DialogService {
    private confirmDialog: ConfirmSaveDialogElement | null = null;
    private confirmDialogSession: OverlaySessionHandle | null = null;
    private aboutDialog: AboutDialogElement | null = null;
    private aboutDialogSession: OverlaySessionHandle | null = null;
    private confirmActionSession: OverlaySessionHandle | null = null;

    public constructor(
        private readonly view: BodyElement,
        private theme: WorkbenchTheme,
    ) {}

    /** Перекрашивает уже созданные диалоги и запоминает тему для будущих. */
    public applyTheme(theme: WorkbenchTheme): void {
        this.theme = theme;
        this.confirmDialog?.applyTheme(theme);
        this.aboutDialog?.applyTheme(theme);
    }

    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        if (!this.confirmDialog) {
            this.confirmDialog = new ConfirmSaveDialogElement(filename);
            this.confirmDialog.applyTheme(this.theme);
            this.confirmDialogSession = this.view.overlayLayer.createSession(this.confirmDialog, new Point(0, 0), {
                visible: false,
                restoreFocus: true,
                closeOnEscape: true,
                pointerPolicy: "modal",
            });
        } else {
            this.confirmDialog.setFilename(filename);
        }

        this.confirmDialog.onSave = () => {
            this.hideConfirmSaveDialog();
            callbacks.onSave();
        };
        this.confirmDialog.onDontSave = () => {
            this.hideConfirmSaveDialog();
            callbacks.onDontSave();
        };
        this.confirmDialog.onCancel = () => {
            this.hideConfirmSaveDialog();
        };

        const screenW = this.view.layoutSize.width;
        const screenH = this.view.layoutSize.height;
        const dialogW = this.confirmDialog.getMaxIntrinsicWidth(0);
        const dialogH = this.confirmDialog.getMaxIntrinsicHeight(dialogW);
        const px = Math.max(0, Math.floor((screenW - dialogW) / 2));
        const py = Math.max(0, Math.floor((screenH - dialogH) / 2));
        this.confirmDialogSession?.setPosition(new Point(px, py));

        this.confirmDialogSession?.open();
        this.confirmDialog.focusDefault();
    }

    private hideConfirmSaveDialog(): void {
        /* v8 ignore start -- defensive: only invoked from dialog callbacks after showConfirmSaveDialog() created the dialog (which is never reset to null) */
        if (!this.confirmDialog) return;
        /* v8 ignore stop */
        this.confirmDialogSession?.close();
    }

    public showConfirmDialog(
        options: ConfirmDialogOptions,
        callbacks: { onConfirm: () => void; onCancel?: () => void },
    ): void {
        this.hideConfirmActionDialog();

        const dialog = new ConfirmDialogElement(options);
        dialog.applyTheme(this.theme);
        dialog.onConfirm = () => {
            this.hideConfirmActionDialog();
            callbacks.onConfirm();
        };
        dialog.onCancel = () => {
            this.hideConfirmActionDialog();
            callbacks.onCancel?.();
        };

        const session = this.view.overlayLayer.createSession(dialog, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            closeOnEscape: true,
            pointerPolicy: "modal",
            disposeOnClose: true,
        });
        this.confirmActionSession = session;

        const screenW = this.view.layoutSize.width;
        const screenH = this.view.layoutSize.height;
        const dialogW = dialog.getMaxIntrinsicWidth(0);
        const dialogH = dialog.getMaxIntrinsicHeight(dialogW);
        session.setPosition(
            new Point(
                Math.max(0, Math.floor((screenW - dialogW) / 2)),
                Math.max(0, Math.floor((screenH - dialogH) / 2)),
            ),
        );
        session.open();
        dialog.focusDefault();
    }

    private hideConfirmActionDialog(): void {
        this.confirmActionSession?.close();
        this.confirmActionSession = null;
    }

    public showAboutDialog(): void {
        if (!this.aboutDialog) {
            this.aboutDialog = new AboutDialogElement();
            this.aboutDialog.applyTheme(this.theme);
            this.aboutDialog.onClose = () => {
                this.hideAboutDialog();
            };
            this.aboutDialogSession = this.view.overlayLayer.createSession(this.aboutDialog, new Point(0, 0), {
                visible: false,
                restoreFocus: true,
                closeOnEscape: true,
                pointerPolicy: "modal",
            });
        }

        const screenW = this.view.layoutSize.width;
        const screenH = this.view.layoutSize.height;
        const dialogW = this.aboutDialog.getMaxIntrinsicWidth(0);
        const dialogH = this.aboutDialog.getMaxIntrinsicHeight(dialogW);
        const px = Math.max(0, Math.floor((screenW - dialogW) / 2));
        const py = Math.max(0, Math.floor((screenH - dialogH) / 2));
        this.aboutDialogSession?.setPosition(new Point(px, py));

        this.aboutDialogSession?.open();
        this.aboutDialog.focusDefault();
    }

    private hideAboutDialog(): void {
        /* v8 ignore start -- defensive: only invoked from the dialog callback after showAboutDialog() created the dialog */
        if (!this.aboutDialog) return;
        /* v8 ignore stop */
        this.aboutDialogSession?.close();
    }
}
