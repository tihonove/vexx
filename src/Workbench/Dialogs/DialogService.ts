import { token } from "../../Common/DiContainer.ts";
import { Disposable } from "../../Common/Disposable.ts";
import { Point } from "../../Common/GeometryPromitives.ts";
import type { ThemeService } from "../../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../../Theme/ThemeTokens.ts";
import type { BodyElement } from "../../TUIDom/Widgets/BodyElement.ts";
import type { OverlaySessionHandle } from "../../TUIDom/Widgets/OverlayLayer.ts";

import { AboutDialog } from "./AboutDialog.tsx";
import { ConfirmDialog, type ConfirmDialogOptions } from "./ConfirmDialog.tsx";
import { ConfirmSaveDialog } from "./ConfirmSaveDialog.tsx";
import type { DialogComponent } from "./DialogComponent.ts";

export const DialogServiceDIToken = token<DialogService>("DialogService");

/**
 * Сервис модальных диалогов (аналог vscode `IDialogService`): владеет
 * компонентами диалогов и их overlay-сессиями. Компоненты общаются только с
 * сервисами (тема), а хост (корневой BodyElement с overlay-слоем) прикрепляет
 * оркестратор через {@link attachHost} после построения своей view.
 */
export class DialogService extends Disposable {
    public static dependencies = [ThemeServiceDIToken] as const;

    private themeService: ThemeService;
    private host: BodyElement | null = null;

    private confirmSaveDialog: ConfirmSaveDialog | null = null;
    private confirmSaveSession: OverlaySessionHandle | null = null;

    private confirmDialog: ConfirmDialog | null = null;
    private confirmSession: OverlaySessionHandle | null = null;

    private aboutDialog: AboutDialog | null = null;
    private aboutSession: OverlaySessionHandle | null = null;

    public constructor(themeService: ThemeService) {
        super();
        this.themeService = themeService;
        this.register({
            dispose: () => {
                this.confirmSaveDialog?.dispose();
                this.confirmDialog?.dispose();
                this.aboutDialog?.dispose();
            },
        });
    }

    /** Вызывается владельцем корневой view до первого показа диалога. */
    public attachHost(host: BodyElement): void {
        this.host = host;
    }

    /**
     * Диалог «сохранить изменения?» для файла `filename`. Живёт один экземпляр
     * на всё приложение — повторный показ обновляет имя файла и колбэки.
     */
    public showConfirmSaveDialog(
        filename: string,
        callbacks: { onSave: () => void; onDontSave: () => void; onCancel: () => void },
    ): void {
        const host = this.requireHost();
        if (!this.confirmSaveDialog) {
            this.confirmSaveDialog = new ConfirmSaveDialog(this.themeService, filename);
            this.confirmSaveDialog.mount();
            this.confirmSaveSession = host.overlayLayer.createSession(this.confirmSaveDialog.view, new Point(0, 0), {
                visible: false,
                restoreFocus: true,
                closeOnEscape: true,
                pointerPolicy: "modal",
            });
        } else {
            this.confirmSaveDialog.setFilename(filename);
        }
        const dialog = this.confirmSaveDialog;

        dialog.onSave = () => {
            this.confirmSaveSession?.close();
            callbacks.onSave();
        };
        dialog.onDontSave = () => {
            this.confirmSaveSession?.close();
            callbacks.onDontSave();
        };
        dialog.onCancel = () => {
            this.confirmSaveSession?.close();
            callbacks.onCancel();
        };

        this.openCentered(this.confirmSaveSession, dialog);
        dialog.focusDefault();
    }

    /** Открыт ли сейчас диалог «сохранить изменения?» — и какой (для тестов/оркестрации). */
    public getOpenConfirmSaveDialog(): ConfirmSaveDialog | null {
        return (this.confirmSaveSession?.isOpen() ?? false) ? this.confirmSaveDialog : null;
    }

    /**
     * Универсальный диалог подтверждения. Под каждый вопрос создаётся новый
     * компонент; закрытие (в т.ч. по Escape) освобождает его.
     */
    public showConfirmDialog(
        options: ConfirmDialogOptions,
        callbacks: { onConfirm: () => void; onCancel?: () => void },
    ): void {
        const host = this.requireHost();
        this.hideConfirmDialog();

        const dialog = new ConfirmDialog(this.themeService, options);
        dialog.mount();
        dialog.onConfirm = () => {
            this.hideConfirmDialog();
            callbacks.onConfirm();
        };
        dialog.onCancel = () => {
            this.hideConfirmDialog();
            callbacks.onCancel?.();
        };

        const session = host.overlayLayer.createSession(dialog.view, new Point(0, 0), {
            visible: false,
            restoreFocus: true,
            closeOnEscape: true,
            pointerPolicy: "modal",
            disposeOnClose: true,
            onClose: () => {
                // Любой путь закрытия (колбэк, Escape, замена новым диалогом)
                // проходит через сессию — освобождаем компонент здесь.
                this.confirmDialog = null;
                this.confirmSession = null;
                dialog.dispose();
            },
        });
        this.confirmDialog = dialog;
        this.confirmSession = session;

        this.openCentered(session, dialog);
        dialog.focusDefault();
    }

    /** Открыт ли сейчас универсальный confirm-диалог (для тестов/оркестрации). */
    public getOpenConfirmDialog(): ConfirmDialog | null {
        return (this.confirmSession?.isOpen() ?? false) ? this.confirmDialog : null;
    }

    public hideConfirmDialog(): void {
        this.confirmSession?.close();
        this.confirmSession = null;
        this.confirmDialog = null;
    }

    /** Диалог «About»: единственный экземпляр, повторный показ переоткрывает. */
    public showAboutDialog(): void {
        const host = this.requireHost();
        if (!this.aboutDialog) {
            this.aboutDialog = new AboutDialog(this.themeService);
            this.aboutDialog.mount();
            this.aboutDialog.onClose = () => {
                this.aboutSession?.close();
            };
            this.aboutSession = host.overlayLayer.createSession(this.aboutDialog.view, new Point(0, 0), {
                visible: false,
                restoreFocus: true,
                closeOnEscape: true,
                pointerPolicy: "modal",
            });
        }

        this.openCentered(this.aboutSession, this.aboutDialog);
        this.aboutDialog.focusDefault();
    }

    /** Открыт ли сейчас диалог «About» (для тестов/оркестрации). */
    public getOpenAboutDialog(): AboutDialog | null {
        return (this.aboutSession?.isOpen() ?? false) ? this.aboutDialog : null;
    }

    /** Центрирует окно по экрану хоста и открывает сессию. */
    private openCentered(session: OverlaySessionHandle | null, dialog: DialogComponent): void {
        const host = this.requireHost();
        const screenW = host.layoutSize.width;
        const screenH = host.layoutSize.height;
        const dialogW = dialog.view.getMaxIntrinsicWidth(0);
        const dialogH = dialog.view.getMaxIntrinsicHeight(dialogW);
        const px = Math.max(0, Math.floor((screenW - dialogW) / 2));
        const py = Math.max(0, Math.floor((screenH - dialogH) / 2));
        session?.setPosition(new Point(px, py));
        session?.open();
    }

    private requireHost(): BodyElement {
        if (this.host === null) {
            throw new Error("DialogService: host is not attached (attachHost must be called before showing dialogs)");
        }
        return this.host;
    }
}
