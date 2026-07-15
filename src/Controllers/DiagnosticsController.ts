import * as path from "node:path";

import { token } from "../Common/DiContainer.ts";
import { Disposable, type IDisposable } from "../Common/Disposable.ts";
import { Uri } from "../Common/Uri.ts";
import { getDefaultConfiguration } from "../Configuration/defaults.ts";
import type { IMarkerDecoration } from "../Editor/Markers/IMarker.ts";
import type { MarkerService } from "../Editor/Markers/MarkerService.ts";

import { MarkerServiceDIToken, SettingsResourceDIToken } from "./CoreTokens.ts";
import { collectKnownSettingKeys, validateSettingsJson } from "./Diagnostics/SettingsDiagnostics.ts";
import type { EditorController } from "./EditorController.ts";
import type { EditorGroupController } from "./EditorGroupController.ts";
import { EditorGroupControllerDIToken } from "./EditorGroupController.ts";

export const DiagnosticsControllerDIToken = token<DiagnosticsController>("DiagnosticsController");

/** Marker owner used by the built-in settings.json validator. */
const SETTINGS_OWNER = "settings";

/**
 * Wires the built-in diagnostic providers into the {@link MarkerService} and
 * pushes the resulting markers back to open editors as squiggle decorations.
 *
 * MVP: a single provider — the settings.json validator — and a single consumer
 * — editor squiggles. The problems panel (future) is just another consumer of
 * the same service. No language server or problem matcher involved.
 *
 * Not an {@link IController} (no view yet): a headless observer that AppController
 * mounts alongside the UI controllers.
 */
export class DiagnosticsController extends Disposable {
    public static dependencies = [EditorGroupControllerDIToken, MarkerServiceDIToken, SettingsResourceDIToken] as const;

    private editorGroup: EditorGroupController;
    private markerService: MarkerService;
    private knownSettingKeys: Set<string>;
    /**
     * Ресурс настроек, который валидируем, или `null`, если он неизвестен.
     *
     * Шов между инфраструктурой и документами: `UserDataPaths` отдаёт settings.json
     * строкой-путём (он там честный путь на диске), а поднимает его в ресурс тот, кто
     * открывает файл как документ, — то есть мы, один раз в конструкторе.
     */
    private settingsResource: Uri | null;
    private activeContentSubscription: IDisposable | null = null;

    public constructor(
        editorGroup: EditorGroupController,
        markerService: MarkerService,
        settingsResource: string | null,
    ) {
        super();
        this.editorGroup = editorGroup;
        this.markerService = markerService;
        // path.resolve строго ДО Uri.file: Uri.file относительный путь не резолвит.
        this.settingsResource = settingsResource === null ? null : Uri.file(path.resolve(settingsResource));
        this.knownSettingKeys = collectKnownSettingKeys(getDefaultConfiguration());

        this.register(
            this.editorGroup.onActiveEditorChanged((editor) => {
                this.bindActiveEditor(editor);
                this.validate(editor);
            }),
        );
        this.register(
            this.markerService.onDidChangeMarkers((resources) => {
                this.pushDecorations(resources);
            }),
        );
        this.register({ dispose: () => this.activeContentSubscription?.dispose() });
    }

    public mount(): void {
        // Pick up an editor that became active before this subscription existed.
        const active = this.editorGroup.getActiveEditor();
        this.bindActiveEditor(active);
        this.validate(active);
    }

    /** Re-validates the active editor whenever its content changes. */
    private bindActiveEditor(editor: EditorController | null): void {
        this.activeContentSubscription?.dispose();
        this.activeContentSubscription =
            editor?.onDidChangeContent(() => {
                this.validate(editor);
            }) ?? null;
    }

    /**
     * Runs the applicable providers for `editor` and publishes their markers.
     * Currently only the settings.json validator; no-op for other files.
     */
    private validate(editor: EditorController | null): void {
        if (editor === null) return;
        // Валидируем только settings.json активного профиля — сверяем ресурс целиком,
        // а не basename, чтобы чужой settings.json (например, самого VS Code или
        // workspace-ный .vscode/settings.json) остался нетронутым.
        if (this.settingsResource === null) return;
        const resource = editor.uri;
        if (resource.toString() !== this.settingsResource.toString()) return;

        const markers = validateSettingsJson(editor.getText(), (key) => this.knownSettingKeys.has(key));
        this.markerService.changeOne(SETTINGS_OWNER, resource.toString(), markers);
    }

    /** Pushes the current markers for each changed resource to its open editor(s). */
    private pushDecorations(resources: readonly string[]): void {
        for (const resource of resources) {
            const decorations: IMarkerDecoration[] = this.markerService
                .read({ resource })
                .map((marker) => ({ range: marker.range, severity: marker.severity }));
            for (const editor of this.editorsForResource(resource)) {
                editor.setMarkerDecorations(decorations);
            }
        }
    }

    private editorsForResource(resource: string): EditorController[] {
        const result: EditorController[] = [];
        for (let i = 0; i < this.editorGroup.editorCount; i++) {
            const editor = this.editorGroup.getEditor(i);
            /* v8 ignore start -- defensive: i is bounded by editorCount, so getEditor always returns an open editor */
            if (editor === null) continue;
            /* v8 ignore stop */
            if (editor.uri.toString() === resource) result.push(editor);
        }
        return result;
    }
}
