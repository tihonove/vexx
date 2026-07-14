import * as path from "node:path";

import { token } from "../vs/platform/instantiation/common/instantiation.ts";
import { Disposable, type IDisposable } from "../vs/base/common/lifecycle.ts";
import { getDefaultConfiguration } from "../vs/platform/configuration/common/defaults.ts";
import type { IMarkerDecoration } from "../vs/platform/markers/common/markers.ts";
import type { MarkerService } from "../vs/platform/markers/common/markerService.ts";

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
    /** Resolved path of the Vexx settings.json we validate, or null when unknown. */
    private settingsResource: string | null;
    private activeContentSubscription: IDisposable | null = null;

    public constructor(
        editorGroup: EditorGroupController,
        markerService: MarkerService,
        settingsResource: string | null,
    ) {
        super();
        this.editorGroup = editorGroup;
        this.markerService = markerService;
        this.settingsResource = settingsResource === null ? null : path.resolve(settingsResource);
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
        // Only the active-profile Vexx settings.json is validated — matched by exact
        // path, not basename, so an unrelated settings.json (e.g. VS Code's own, or a
        // workspace .vscode/settings.json) is left alone. Editors reach validate only
        // through the group, which always opens files with a resolved path.
        if (this.settingsResource === null) return;
        const resource = editor.absoluteFilePath;
        /* v8 ignore start -- defensive: editors reach validate only through the group, which always opens files with a resolved path */
        if (resource === null) return;
        /* v8 ignore stop */
        if (path.resolve(resource) !== this.settingsResource) return;

        const markers = validateSettingsJson(editor.getText(), (key) => this.knownSettingKeys.has(key));
        this.markerService.changeOne(SETTINGS_OWNER, resource, markers);
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
        const resolved = path.resolve(resource);
        const result: EditorController[] = [];
        for (let i = 0; i < this.editorGroup.editorCount; i++) {
            // i is bounded by editorCount, and open editors always have a path.
            const editor = this.editorGroup.getEditor(i);
            /* v8 ignore start -- defensive: i is bounded by editorCount, so getEditor always returns an open editor */
            if (editor === null) continue;
            /* v8 ignore stop */
            const editorPath = editor.absoluteFilePath;
            if (editorPath !== null && path.resolve(editorPath) === resolved) result.push(editor);
        }
        return result;
    }
}
