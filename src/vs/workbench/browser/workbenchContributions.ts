import type { IWorkbenchContributionRegistration } from "../common/iWorkbenchContribution.ts";
import { AutoRevealContributionDIToken } from "../contrib/files/browser/autoRevealContribution.ts";
import { OpenFileCommandContributionDIToken } from "../contrib/files/browser/openFileCommandContribution.ts";
import { ThemeConfigContributionDIToken } from "../contrib/themes/browser/themeConfigContribution.ts";
import { TerminalEnvStatusContributionDIToken } from "../services/terminalEnvironment/node/terminalEnvStatusContribution.ts";

import { EditorContextMenuContributionDIToken } from "./parts/editor/editorContextMenuContribution.ts";
import { EditorStatusContributionDIToken } from "./parts/editor/editorStatusContribution.ts";

/**
 * Явный список workbench-contributions (зеркало `builtinActions`, без
 * import-side-effect самрегистрации). Порядок внутри фазы = порядок
 * инстанцирования. Новую фич-проводку добавляем сюда, а не строкой в конструктор
 * `WorkbenchComponent`.
 */
export const WORKBENCH_CONTRIBUTIONS: readonly IWorkbenchContributionRegistration[] = [
    { token: EditorStatusContributionDIToken, phase: "restored" },
    { token: TerminalEnvStatusContributionDIToken, phase: "restored" },
    { token: AutoRevealContributionDIToken, phase: "restored" },
    { token: ThemeConfigContributionDIToken, phase: "restored" },
    { token: EditorContextMenuContributionDIToken, phase: "restored" },
    { token: OpenFileCommandContributionDIToken, phase: "restored" },
];
