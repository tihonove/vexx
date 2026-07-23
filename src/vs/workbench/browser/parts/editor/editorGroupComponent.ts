import * as path from "node:path";

import { EditorGroupElement } from "../../../../../../tuidom/ui/editorgroup/editorGroupElement.ts";
import type { TabInfo } from "../../../../../../tuidom/ui/editorgroup/editorTabStripElement.ts";
import { getFileIcon } from "../../../../base/common/fileIcons.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import { getTabStripStyles } from "../../../../platform/theme/browser/defaultStyles.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";
import { EditorServiceDIToken } from "../../../services/editor/browser/editorService.ts";
import type { ThemeService } from "../../../services/themes/common/themeService.ts";
import { ThemeServiceDIToken } from "../../../services/themes/common/themeTokens.ts";
import { ThemedComponent } from "../../component.ts";

import type { IEditorPane } from "./iEditorPane.ts";

export const EditorGroupComponentDIToken = token<EditorGroupComponent>("EditorGroupComponent");

/**
 * Компонент группы редакторов: владеет {@link EditorGroupElement} (tab strip +
 * контент-хост + локальный OverlayLayer для find-виджета) и отражает в нём
 * состояние {@link EditorService} — по {@link EditorService.onDidChangeEditors}
 * вставляет view активного {@link TextEditorPane} и перерисовывает табы (метки с
 * разводкой тёзок, иконки, маркер изменённости, активная вкладка). Клики по
 * табам возвращаются в сервис (`activateTab`/`closeTab`; закрытие «грязной»
 * вкладки — через `onRequestConfirmClose`).
 */
export class EditorGroupComponent extends ThemedComponent {
    public static dependencies = [EditorServiceDIToken, ThemeServiceDIToken] as const;

    public readonly view: EditorGroupElement;

    public constructor(
        private readonly editorService: EditorService,
        themeService: ThemeService,
    ) {
        super(themeService);
        this.view = new EditorGroupElement();
        this.view.id = "editorGroup";
        this.view.tabStrip.onTabActivate = (index) => {
            this.editorService.activateTab(index);
        };
        this.view.tabStrip.onTabClose = (index) => {
            // Индекс приходит из tab strip и всегда указывает на существующую вкладку.
            // Именно getPane, а не getEditor: закрывать надо вкладку любого вида,
            // иначе не-текстовую панель (дифф) нельзя было бы закрыть крестиком.
            const editor = this.editorService.getPane(index);
            /* v8 ignore start -- индекс из tab strip всегда указывает на существующую вкладку; null — недостижимый инвариант-гард */
            if (editor === null) return;
            /* v8 ignore stop */
            if (editor.isModified && this.editorService.onRequestConfirmClose) {
                this.editorService.onRequestConfirmClose(index);
            } else {
                this.editorService.closeTab(index);
            }
        };
        this.register(
            this.editorService.onDidChangeEditors(() => {
                this.syncFromService();
            }),
        );
        this.syncFromService();
        this.initStyles();
    }

    /** Приводит контрол к состоянию сервиса: контент активного редактора + табы. */
    private syncFromService(): void {
        // Именно ВКЛАДКА: `getActivePane()` следует за фокусом и при работе в
        // нижней панели вернул бы её detached-редактор — группа вставила бы его
        // вместо файла, и область редактора оказывалась пустой.
        const activeView = this.editorService.getActiveTabPane()?.view ?? null;
        // Guard от повторной вставки того же view: setContent перевешивает parent,
        // а активный редактор меняется реже, чем файрится onDidChangeEditors.
        if (this.view.getContent() !== activeView) {
            this.view.setContent(activeView);
        }
        this.syncTabs();
    }

    private syncTabs(): void {
        const editors = this.editorService.getPanes();
        const labels = this.computeTabLabels();
        const tabs: TabInfo[] = editors.map((editor, i) => {
            const fi = getFileIcon(this.editorService.displayName(editor));
            return {
                label: labels[i],
                icon: fi.icon,
                iconColor: fi.color,
                isModified: editor.isModified,
                isReadOnly: editor.readOnly,
            };
        });

        this.view.tabStrip.setTabs(tabs);
        this.view.tabStrip.activeIndex = this.editorService.activeIndex;
    }

    /**
     * Метки вкладок: обычно это имя файла, но если несколько открытых файлов
     * делят один basename, к ним добавляется минимальный различающий суффикс
     * родительского пути (как в VS Code), чтобы вкладки нельзя было спутать.
     */
    private computeTabLabels(): string[] {
        const editors = this.editorService.getPanes();
        const names = editors.map((editor) => this.editorService.displayName(editor));
        const groups = new Map<string, number[]>();
        names.forEach((name, i) => {
            const arr = groups.get(name);
            if (arr) arr.push(i);
            else groups.set(name, [i]);
        });

        const labels = [...names];
        for (const indices of groups.values()) {
            if (indices.length < 2) continue;
            const dirs = indices.map((i) => {
                const uri = editors[i].uri;
                // Гейт по схеме, а не по «путь непустой»: fsPath у не-file схемы вернёт
                // мусор, а не бросит. В группу тёзок не-file и не попадёт — метки
                // безымянных буферов уникальны по построению (Untitled-N).
                /* v8 ignore start -- defensive: одинаковый displayName бывает только у файлов */
                if (uri.scheme !== "file") return [];
                /* v8 ignore stop */
                // Путь уже абсолютный: подъём в Uri.file идёт через path.resolve.
                return path.dirname(uri.fsPath).split(path.sep).filter(Boolean);
            });
            const maxK = Math.max(0, ...dirs.map((d) => d.length));
            indices.forEach((editorIndex, a) => {
                // Минимальный хвост родительского пути, отличающий этот файл от
                // остальных в группе. Файлы-тёзки всегда различаются по пути
                // (дедуп в openFile), поэтому уникальный хвост существует всегда.
                let suffix = dirs[a].slice(-maxK).join(path.sep);
                for (let k = 1; k <= maxK; k++) {
                    const mine = dirs[a].slice(-k).join(path.sep);
                    const collision = dirs.some((d, b) => b !== a && d.slice(-k).join(path.sep) === mine);
                    if (!collision) {
                        suffix = mine;
                        break;
                    }
                }
                labels[editorIndex] = `${names[editorIndex]} — ${suffix}`;
            });
        }
        return labels;
    }

    protected updateStyles(): void {
        this.view.tabStrip.setStyles(getTabStripStyles(this.theme));
        this.view.style = {
            fg: this.theme.getRequiredColor("editor.foreground"),
            bg: this.theme.getRequiredColor("editor.background"),
        };
    }
}
