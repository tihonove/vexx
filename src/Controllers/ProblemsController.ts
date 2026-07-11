import { token } from "../Common/DiContainer.ts";
import { Disposable } from "../Common/Disposable.ts";
import type { MarkerService } from "../Editor/Markers/MarkerService.ts";
import type { ThemeService } from "../Theme/ThemeService.ts";
import { ThemeServiceDIToken } from "../Theme/ThemeTokens.ts";
import type { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";
import type { TUIElement } from "../TUIDom/TUIElement.ts";
import { ScrollBarDecorator } from "../TUIDom/Widgets/ScrollContainerElement.ts";
import { TreeViewElement } from "../TUIDom/Widgets/TreeViewElement.ts";

import { MarkerServiceDIToken } from "./CoreTokens.ts";
import { type ProblemNode, ProblemsTreeDataProvider } from "./Diagnostics/ProblemsTreeDataProvider.ts";
import { EditorGroupController, EditorGroupControllerDIToken } from "./EditorGroupController.ts";
import { PanelController, PanelControllerDIToken, PROBLEMS_VIEW_ID } from "./PanelController.ts";

export const ProblemsControllerDIToken = token<ProblemsController>("ProblemsController");

/**
 * Fills the Problems view (in the bottom {@link PanelController Panel}) with a
 * tree "file → diagnostic markers" and reveals a marker's location on activation.
 *
 * A second consumer of the shared {@link MarkerService} (the editor squiggles are
 * the first). Headless — its UI is the tree it injects into the Problems view, so
 * there is no `view` of its own. When there are no markers the view falls back to
 * the panel's placeholder empty-state (content = null).
 */
export class ProblemsController extends Disposable {
    public static dependencies = [
        MarkerServiceDIToken,
        PanelControllerDIToken,
        EditorGroupControllerDIToken,
        ThemeServiceDIToken,
    ] as const;

    /** The Problems tree — the controller's UI artifact, injected into the Panel view. */
    public readonly tree: TreeViewElement<ProblemNode>;

    private markerService: MarkerService;
    private panel: PanelController;
    private editorGroup: EditorGroupController;
    private provider: ProblemsTreeDataProvider;
    private treeContent: TUIElement;
    private treeShown = false;

    public constructor(
        markerService: MarkerService,
        panel: PanelController,
        editorGroup: EditorGroupController,
        themeService: ThemeService,
    ) {
        super();
        this.markerService = markerService;
        this.panel = panel;
        this.editorGroup = editorGroup;
        this.provider = new ProblemsTreeDataProvider();
        this.tree = new TreeViewElement(this.provider);
        this.treeContent = new ScrollBarDecorator(this.tree);

        this.tree.onActivate = (node) => {
            this.revealMarker(node);
        };

        this.register(
            this.markerService.onDidChangeMarkers(() => {
                this.rebuild();
            }),
        );
        this.register(
            themeService.onThemeChange((theme) => {
                this.applyTheme(theme);
            }),
        );
    }

    public mount(): void {
        this.rebuild();
    }

    /** Focuses the Problems tree (used by the "Toggle Problems" command). */
    public focus(): void {
        // The command shows the panel (which re-attaches its subtree to the live
        // root) before calling this, so the tree's `root` is wired here.
        this.tree.focus();
    }

    /**
     * Re-reads the marker snapshot into the tree. Swaps the Problems view between
     * the tree (markers present) and the placeholder empty-state (none).
     */
    private rebuild(): void {
        const markers = this.markerService.read();
        this.provider.setMarkers(markers);

        const shouldShowTree = markers.length > 0;
        if (shouldShowTree !== this.treeShown) {
            this.panel.view.setViewContent(PROBLEMS_VIEW_ID, shouldShowTree ? this.treeContent : null);
            this.treeShown = shouldShowTree;
        }
        if (shouldShowTree) void this.refreshTree();
    }

    /** Rebuilds the tree and auto-expands each file node (like VS Code's Problems view). */
    private async refreshTree(): Promise<void> {
        await this.tree.refresh();
        for (const file of this.provider.getChildren()) {
            await this.tree.expand(file);
        }
    }

    private revealMarker(node: ProblemNode): void {
        if (node.kind !== "marker") return;
        // openFile always opens/activates an editor for the resource.
        this.editorGroup.openFile(node.resource);
        const editor = this.editorGroup.getActiveEditor();
        if (editor === null) return;
        const start = node.marker.range.start;
        editor.goToPosition(start.line, start.character);
        editor.revealRange(node.marker.range);
    }

    private applyTheme(theme: WorkbenchTheme): void {
        this.tree.activeSelectionBg = theme.getRequiredColor("list.activeSelectionBackground");
        this.tree.activeSelectionFg = theme.getRequiredColor("list.activeSelectionForeground");
        this.tree.inactiveSelectionBg = theme.getRequiredColor("list.inactiveSelectionBackground");
        this.tree.inactiveSelectionFg = theme.getRequiredColor("list.inactiveSelectionForeground");
        this.tree.hoverBg = theme.getRequiredColor("list.hoverBackground");
        this.tree.hoverFg = theme.getColor("list.hoverForeground");
        this.tree.style = {
            fg: theme.getRequiredColor("editor.foreground"),
            bg: theme.getRequiredColor("panel.background"),
        };
        this.provider.severityColors = {
            error: theme.getRequiredColor("editorError.foreground"),
            warning: theme.getRequiredColor("editorWarning.foreground"),
            info: theme.getRequiredColor("editorInfo.foreground"),
            hint: theme.getRequiredColor("editorHint.foreground"),
        };
        this.rebuild();
    }
}
