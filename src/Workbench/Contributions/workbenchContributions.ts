import { EditorStatusContributionDIToken } from "../Services/EditorStatusContribution.ts";
import { TerminalEnvStatusContributionDIToken } from "../Services/TerminalEnvironment/TerminalEnvStatusContribution.ts";

import type { IWorkbenchContributionRegistration } from "./IWorkbenchContribution.ts";

/**
 * Явный список workbench-contributions (зеркало `builtinActions`, без
 * import-side-effect самрегистрации). Порядок внутри фазы = порядок
 * инстанцирования. Новую фич-проводку добавляем сюда, а не строкой в конструктор
 * `WorkbenchComponent`.
 */
export const WORKBENCH_CONTRIBUTIONS: readonly IWorkbenchContributionRegistration[] = [
    { token: EditorStatusContributionDIToken, phase: "restored" },
    { token: TerminalEnvStatusContributionDIToken, phase: "restored" },
];
