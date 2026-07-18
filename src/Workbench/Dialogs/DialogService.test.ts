import { describe, expect, it, vi } from "vitest";

import { Size } from "../../Common/GeometryPromitives.ts";
import { TestApp } from "../../TestUtils/TestApp.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";
import { BodyElement } from "../../TUIDom/Widgets/BodyElement.ts";

import { DialogService } from "./DialogService.ts";

function makeHost() {
    const body = new BodyElement();
    const testApp = TestApp.create(body, new Size(80, 24));
    const service = new DialogService(new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)));
    service.attachHost(body);
    testApp.render();
    return { body, testApp, service };
}

const saveCallbacks = () => ({ onSave: vi.fn(), onDontSave: vi.fn(), onCancel: vi.fn() });

describe("DialogService — confirm save", () => {
    it("show открывает диалог по центру, колбэки закрывают его", () => {
        const { testApp, service } = makeHost();

        service.showConfirmSaveDialog("a.txt", saveCallbacks());
        testApp.render();

        const dialog = service.getOpenConfirmSaveDialog();
        expect(dialog).not.toBeNull();
        expect(testApp.querySelector("#confirmSaveDialog")).not.toBeNull();

        const cb = saveCallbacks();
        service.showConfirmSaveDialog("b.txt", cb);
        dialog!.onSave?.();
        expect(cb.onSave).toHaveBeenCalledOnce();
        expect(service.getOpenConfirmSaveDialog()).toBeNull();
    });

    it("повторный показ переиспользует компонент и обновляет имя файла", () => {
        const { testApp, service } = makeHost();

        service.showConfirmSaveDialog("first.txt", saveCallbacks());
        const first = service.getOpenConfirmSaveDialog();
        first!.onDontSave?.();

        service.showConfirmSaveDialog("second.txt", saveCallbacks());
        testApp.render();

        expect(service.getOpenConfirmSaveDialog()).toBe(first);
        expect(testApp.backend.screenToString()).toContain("second.txt?");
    });

    it("onCancel закрывает диалог и зовёт колбэк", () => {
        const { service } = makeHost();
        const cb = saveCallbacks();

        service.showConfirmSaveDialog("a.txt", cb);
        service.getOpenConfirmSaveDialog()!.onCancel?.();

        expect(cb.onCancel).toHaveBeenCalledOnce();
        expect(service.getOpenConfirmSaveDialog()).toBeNull();
    });
});

describe("DialogService — confirm", () => {
    it("onConfirm закрывает диалог и зовёт колбэк; элемент уходит из дерева", () => {
        const { testApp, service } = makeHost();
        const onConfirm = vi.fn();

        service.showConfirmDialog(
            { title: "Delete", message: "Sure?", confirmLabel: "Yes" },
            { onConfirm },
        );
        testApp.render();
        expect(testApp.querySelector("#confirmDialog")).not.toBeNull();

        service.getOpenConfirmDialog()!.onConfirm?.();
        testApp.render();

        expect(onConfirm).toHaveBeenCalledOnce();
        expect(service.getOpenConfirmDialog()).toBeNull();
        expect(testApp.querySelector("#confirmDialog")).toBeNull();
    });

    it("onCancel зовёт опциональный колбэк, повторный показ заменяет диалог", () => {
        const { service } = makeHost();
        const onCancel = vi.fn();

        service.showConfirmDialog(
            { title: "A", message: "?", confirmLabel: "Yes" },
            { onConfirm: vi.fn(), onCancel },
        );
        const first = service.getOpenConfirmDialog();

        service.showConfirmDialog(
            { title: "B", message: "?", confirmLabel: "Yes" },
            { onConfirm: vi.fn() },
        );
        const second = service.getOpenConfirmDialog();

        expect(second).not.toBe(first);
        second!.onCancel?.();
        expect(onCancel).not.toHaveBeenCalled();
        expect(service.getOpenConfirmDialog()).toBeNull();
    });

    it("после dispose сервиса смена темы не роняет закрытые диалоги", () => {
        const { service } = makeHost();
        service.showConfirmSaveDialog("a.txt", saveCallbacks());

        expect(() => {
            service.dispose();
        }).not.toThrow();
    });
});

describe("DialogService — about", () => {
    it("показывает, закрывает по onClose и переиспользует компонент", () => {
        const { testApp, service } = makeHost();

        service.showAboutDialog();
        testApp.render();
        const dialog = service.getOpenAboutDialog();
        expect(dialog).not.toBeNull();
        expect(testApp.querySelector("#aboutDialog")).not.toBeNull();

        dialog!.onClose?.();
        expect(service.getOpenAboutDialog()).toBeNull();

        service.showAboutDialog();
        expect(service.getOpenAboutDialog()).toBe(dialog);
    });
});

describe("DialogService — до первого показа", () => {
    it("геттеры открытых диалогов отдают null на свежем сервисе", () => {
        const service = new DialogService(new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)));

        expect(service.getOpenConfirmSaveDialog()).toBeNull();
        expect(service.getOpenConfirmDialog()).toBeNull();
        expect(service.getOpenAboutDialog()).toBeNull();
    });
});

describe("DialogService — host", () => {
    it("бросает понятную ошибку, если host не прикреплён", () => {
        const service = new DialogService(new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)));

        expect(() => {
            service.showAboutDialog();
        }).toThrow(/attachHost/);
    });
});
