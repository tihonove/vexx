// Точка входа машинерии. Пока одна команда — sync.
import { DEFAULT_CONFIG_PATH, loadConfig } from "./config.ts";
import { assertProjectScope, GhError, UserError } from "./gh.ts";
import { applyLabels, isEmptyLabelPlan, type LabelPlan, planLabels, readLabels } from "./labels.ts";
import { applyFields, type FieldPlan, isEmptyFieldPlan, planFields, readProject } from "./projectFields.ts";

const USAGE = `Использование: sync [флаги]

  --dry-run        показать план и выйти, ничего не меняя
  --prune          считать конфиг полным владельцем: удалять лишние
                   лейблы с префиксом из конфига и лишние опции полей
  --yes            подтвердить удаление (обязателен вместе с --prune)
  --labels-only    синкать только лейблы репозитория
  --project-only   синкать только поля проекта
  --config <путь>  путь к config.jsonc (по умолчанию ${DEFAULT_CONFIG_PATH})
`;

interface Flags {
    dryRun: boolean;
    prune: boolean;
    yes: boolean;
    labelsOnly: boolean;
    projectOnly: boolean;
    config: string;
}

function parseArgs(argv: string[]): Flags {
    const flags: Flags = {
        dryRun: false,
        prune: false,
        yes: false,
        labelsOnly: false,
        projectOnly: false,
        config: DEFAULT_CONFIG_PATH,
    };
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        switch (arg) {
            case "sync":
                break;
            case "--dry-run":
                flags.dryRun = true;
                break;
            case "--prune":
                flags.prune = true;
                break;
            case "--yes":
                flags.yes = true;
                break;
            case "--labels-only":
                flags.labelsOnly = true;
                break;
            case "--project-only":
                flags.projectOnly = true;
                break;
            case "--config": {
                const value = argv[++index];
                if (!value) throw new UserError("--config требует путь");
                flags.config = value;
                break;
            }
            case "--help":
            case "-h":
                throw new UserError(USAGE, 0);
            default:
                throw new UserError(`Неизвестный аргумент: ${arg}\n\n${USAGE}`);
        }
    }
    if (flags.labelsOnly && flags.projectOnly) throw new UserError("--labels-only и --project-only взаимоисключающие");
    return flags;
}

function printLabelPlan(plan: LabelPlan): void {
    if (isEmptyLabelPlan(plan)) {
        console.log("Лейблы: без изменений");
        return;
    }
    console.log("Лейблы:");
    for (const { name, spec } of plan.create) console.log(`  + ${name}  #${spec.color}  ${spec.description}`);
    for (const { name, from, spec } of plan.update) {
        const diff: string[] = [];
        if (from.color !== spec.color) diff.push(`цвет #${from.color} → #${spec.color}`);
        if (from.description !== spec.description) diff.push(`описание "${from.description}" → "${spec.description}"`);
        console.log(`  ~ ${name}  ${diff.join(", ") || "переименование"}`);
    }
    for (const name of plan.delete) console.log(`  - ${name}`);
}

function printFieldPlan(plan: FieldPlan): void {
    if (isEmptyFieldPlan(plan)) {
        console.log("Поля проекта: без изменений");
        return;
    }
    console.log("Поля проекта:");
    for (const action of plan.actions) {
        if (action.kind === "create") {
            console.log(`  + ${action.field} (${action.dataType})`);
            for (const option of action.options) console.log(`      + ${option.name}  ${option.color}`);
            continue;
        }
        console.log(`  ~ ${action.field}`);
        for (const name of action.added) console.log(`      + ${name}`);
        for (const name of action.changed) console.log(`      ~ ${name}`);
        for (const name of action.removed) console.log(`      - ${name}  (значение обнулится у карточек)`);
        if (action.reordered) console.log("      ~ порядок колонок");
    }
}

async function main(argv: string[]): Promise<number> {
    const flags = parseArgs(argv);
    const config = loadConfig(flags.config);

    const syncLabels = !flags.projectOnly;
    const syncProject = !flags.labelsOnly;

    if (syncProject) await assertProjectScope();

    let labelPlan: LabelPlan = { create: [], update: [], delete: [] };
    if (syncLabels) {
        labelPlan = planLabels(await readLabels(config.repo), config, { prune: flags.prune });
        printLabelPlan(labelPlan);
    }

    let fieldPlan: FieldPlan = { actions: [] };
    let projectId = "";
    if (syncProject) {
        const project = await readProject(config.project.owner, config.project.number);
        projectId = project.id;
        fieldPlan = planFields(project.fields, config, { prune: flags.prune });
        printFieldPlan(fieldPlan);
    }

    const deletions =
        labelPlan.delete.length + fieldPlan.actions.reduce((sum, a) => sum + (a.kind === "update-options" ? a.removed.length : 0), 0);

    if (flags.dryRun) {
        console.log("\n--dry-run: ничего не применено");
        return 0;
    }
    if (deletions > 0 && !flags.yes) {
        // Удаление опции обнуляет её у карточек — это не должно случаться от опечатки.
        throw new UserError(`План содержит ${deletions} удалени(й). Добавьте --yes, если это намеренно.`);
    }

    if (syncLabels) await applyLabels(config.repo, labelPlan);
    if (syncProject) await applyFields(projectId, fieldPlan);

    const fieldSummary = fieldPlan.actions.length === 0 ? "без изменений" : `${fieldPlan.actions.length} действ.`;
    console.log(
        `\nГотово. лейблы: +${labelPlan.create.length} ~${labelPlan.update.length} -${labelPlan.delete.length} | поля: ${fieldSummary}`,
    );
    return 0;
}

main(process.argv.slice(2)).then(
    code => process.exit(code),
    (error: unknown) => {
        if (error instanceof UserError) {
            console.error(error.message);
            process.exit(error.exitCode);
        }
        if (error instanceof GhError) {
            console.error(error.message);
            process.exit(1);
        }
        console.error(error);
        process.exit(1);
    },
);
