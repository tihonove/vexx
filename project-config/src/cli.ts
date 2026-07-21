// Точка входа пакета: привести доску проекта в соответствие с config.jsonc.
import { DEFAULT_CONFIG_PATH, loadConfig } from "./config.ts";
import { assertProjectScope, GhError, UserError } from "./gh.ts";
import { applyFields, type FieldPlan, isEmptyFieldPlan, planFields, readProject } from "./projectFields.ts";

const USAGE = `Использование: sync [флаги]

  --dry-run        показать план и выйти, ничего не меняя
  --prune          считать конфиг полным владельцем поля: удалять опции,
                   которых в нём нет (значение обнулится у карточек)
  --yes            подтвердить удаление (обязателен вместе с --prune)
  --config <путь>  путь к config.jsonc (по умолчанию ${DEFAULT_CONFIG_PATH})
`;

interface Flags {
    dryRun: boolean;
    prune: boolean;
    yes: boolean;
    config: string;
}

function parseArgs(argv: string[]): Flags {
    const flags: Flags = { dryRun: false, prune: false, yes: false, config: DEFAULT_CONFIG_PATH };
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
    return flags;
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

    await assertProjectScope();

    const project = await readProject(config.project.owner, config.project.number);
    const plan = planFields(project.fields, config, { prune: flags.prune });
    printFieldPlan(plan);

    const deletions = plan.actions.reduce((sum, a) => sum + (a.kind === "update-options" ? a.removed.length : 0), 0);

    if (flags.dryRun) {
        console.log("\n--dry-run: ничего не применено");
        return 0;
    }
    if (deletions > 0 && !flags.yes) {
        // Удаление опции обнуляет её у карточек — это не должно случаться от опечатки.
        throw new UserError(`План содержит ${deletions} удалени(й). Добавьте --yes, если это намеренно.`);
    }

    await applyFields(project.id, plan);
    console.log(`\nГотово. Поля: ${plan.actions.length === 0 ? "без изменений" : `${plan.actions.length} действ.`}`);
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
