import { ScrollBarDecorator } from "../../../../../../tuidom/ui/scrollbar/scrollContainerElement.ts";
import { TreeViewElement } from "../../../../../../tuidom/ui/tree/treeViewElement.ts";
import type { CommandRegistry } from "../../../../platform/commands/common/commandRegistry.ts";
import { CommandRegistryDIToken } from "../../../../platform/commands/common/commandRegistry.ts";
import { token } from "../../../../platform/instantiation/common/diContainer.ts";
import { getProblemsTreeStyles, getScrollBarStyles } from "../../../../platform/theme/browser/defaultStyles.ts";
import type { IWorkbenchColors } from "../../../../platform/theme/common/colors/colorContributions.ts";
import { ThemedComponent } from "../../../browser/component.ts";
import type { PanelService } from "../../../browser/parts/panel/panelService.ts";
import { PanelServiceDIToken } from "../../../browser/parts/panel/panelService.ts";
import type { EditorService } from "../../../services/editor/browser/editorService.ts";
import { EditorServiceDIToken } from "../../../services/editor/browser/editorService.ts";
import type { ThemeService } from "../../../services/themes/common/themeService.ts";
import { ThemeServiceDIToken } from "../../../services/themes/common/themeTokens.ts";
import type { ExplorerService } from "../../files/browser/explorerService.ts";
import { ExplorerServiceDIToken } from "../../files/browser/explorerService.ts";

import type { ScmChangesService } from "./changesService.ts";
import { ScmChangesServiceDIToken } from "./changesService.ts";
import { type ChangeNode, ChangesTreeDataProvider } from "./changesTreeDataProvider.ts";
import { compareWithHeadAction } from "./compareWithHeadAction.ts";

/** VS Code-подобный id вкладки Changes в нижней Panel. */
export const CHANGES_VIEW_ID = "workbench.panel.scm.view";

/** `gitDecoration.*`, которыми расширение помечает статусы — резолвим их в цвета букв. */
const GIT_STATUS_COLOR_IDS = [
    "gitDecoration.modifiedResourceForeground",
    "gitDecoration.addedResourceForeground",
    "gitDecoration.deletedResourceForeground",
    "gitDecoration.renamedResourceForeground",
    "gitDecoration.untrackedResourceForeground",
    "gitDecoration.conflictingResourceForeground",
    "gitDecoration.ignoredResourceForeground",
] as const satisfies readonly (keyof IWorkbenchColors)[];

export const ChangesComponentDIToken = token<ChangesComponent>("ChangesComponent");

/**
 * Компонент вкладки CHANGES нижней панели: плоский список изменённых файлов
 * ({@link TreeViewElement} поверх {@link ChangesTreeDataProvider}) — потребитель
 * {@link ScmChangesService}, набор в который пушит SCM-расширение. Пока изменений
 * нет, контент вкладки — null (панель рендерит placeholder). Активация файла
 * открывает его и запускает «Compare with HEAD» (вкладка-смотрелка этапа 5) —
 * так список переиспользует уже готовую команду, не зная про дифф.
 *
 * Размещение в Panel (а не в сайдбаре) — осознанно самый дешёвый вариант для
 * первой версии (docs/TODO/Diff.md, пункт E): `PanelService.addView` уже есть, а
 * сайдбар захардкожен на Explorer.
 */
export class ChangesComponent extends ThemedComponent {
    public static dependencies = [
        ScmChangesServiceDIToken,
        PanelServiceDIToken,
        EditorServiceDIToken,
        CommandRegistryDIToken,
        ExplorerServiceDIToken,
        ThemeServiceDIToken,
    ] as const;

    /** Список изменений — доступен тестам и оркестрации (фокус, выделение). */
    public readonly tree: TreeViewElement<ChangeNode>;
    /** Корневой контрол: список, обёрнутый скроллбаром; вкидывается в Panel через сервис. */
    public readonly view: ScrollBarDecorator;

    private provider: ChangesTreeDataProvider;
    private treeShown = false;

    public constructor(
        private readonly changesService: ScmChangesService,
        private readonly panelService: PanelService,
        private readonly editors: EditorService,
        private readonly commands: CommandRegistry,
        private readonly explorer: ExplorerService,
        themeService: ThemeService,
    ) {
        super(themeService);
        this.provider = new ChangesTreeDataProvider();
        this.tree = new TreeViewElement(this.provider);
        this.view = new ScrollBarDecorator(this.tree);
        this.view.id = "changesView";

        this.panelService.addView({
            id: CHANGES_VIEW_ID,
            title: "CHANGES",
            content: null,
            placeholder: "No source-control changes.",
        });

        this.tree.onActivate = (node) => {
            this.openDiff(node);
        };

        this.register(
            this.changesService.onDidChangeChanges(() => {
                this.rebuild();
            }),
        );
        this.register(
            this.explorer.onDidChangeRoot(() => {
                this.provider.rootPath = this.explorer.getRootPath();
                this.rebuild();
            }),
        );
        this.initStyles();
    }

    /** Focuses the changes list (used by a future "Focus Changes" command). */
    public focus(): void {
        this.tree.focus();
    }

    /**
     * Открывает изменённый файл и запускает «Compare with HEAD»: файл делается
     * активным (`openUri`), затем существующая команда строит вкладку-смотрелку.
     * Для untracked/файла без версии команда сама покажет статус-бар-сообщение.
     */
    private openDiff(node: ChangeNode): void {
        this.editors.openUri(node.uri);
        this.commands.execute(compareWithHeadAction.id);
    }

    /**
     * Перечитывает снимок изменений в список. Меняет контент вкладки между
     * списком (изменения есть) и placeholder'ом (изменений нет).
     */
    private rebuild(): void {
        const changes = this.changesService.changes;
        this.provider.setChanges(changes);

        const shouldShowTree = changes.length > 0;
        if (shouldShowTree !== this.treeShown) {
            this.panelService.setViewContent(CHANGES_VIEW_ID, shouldShowTree ? this.view : null);
            this.treeShown = shouldShowTree;
        }
        if (shouldShowTree) void this.tree.refresh();
    }

    protected updateStyles(): void {
        this.tree.setStyles(getProblemsTreeStyles(this.theme));
        this.tree.style = {
            fg: this.theme.getRequiredColor("editor.foreground"),
            bg: this.theme.getRequiredColor("panel.background"),
        };
        this.view.setStyles(getScrollBarStyles(this.theme, "panel.background"));
        const colors: Record<string, number> = {};
        for (const id of GIT_STATUS_COLOR_IDS) colors[id] = this.theme.getRequiredColor(id);
        this.provider.statusColors = colors;
        this.provider.rootPath = this.explorer.getRootPath();
        this.rebuild();
    }
}
