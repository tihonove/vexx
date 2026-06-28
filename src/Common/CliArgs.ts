/**
 * Парсер аргументов командной строки Vexx. Принимает `argv` без первых
 * двух элементов (`node` и путь до скрипта) — то, что обычно получаешь
 * через `process.argv.slice(2)`.
 *
 * Поддерживаемые формы:
 *   --user-data-dir <path>          | --user-data-dir=<path>
 *   --profile <name>                | --profile=<name>
 *   --help, -h
 *   --version, -v
 *   --                              | всё после трактуется как позиционные
 *   <позиционные>                   | файлы/папки для открытия
 */
export interface ICliArgs {
    /** Файлы и/или директории для открытия. */
    readonly positional: readonly string[];
    /** Значение `--user-data-dir`, если указано. */
    readonly userDataDir: string | undefined;
    /** Имя профиля из `--profile`, если указано. */
    readonly profile: string | undefined;
    /** Был ли передан `--help` / `-h`. */
    readonly help: boolean;
    /** Был ли передан `--version` / `-v`. */
    readonly version: boolean;
}

export const USAGE = `Usage: vexx [options] <file-or-dir> [<file-or-dir> ...]

Options:
  --user-data-dir <path>   Альтернативный каталог user data (default: ~/.vexx)
  --profile <name>         Имя профиля (default: "default")
  -h, --help               Показать эту справку
  -v, --version            Показать версию
`;

export class CliArgsError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "CliArgsError";
    }
}

interface IFlagSpec {
    /** Канонический ключ в `ICliArgs`. */
    readonly key: "userDataDir" | "profile";
    /** Требует значение следующим аргументом или через `=`. */
    readonly value: true;
}

const FLAG_SPECS: Readonly<Record<string, IFlagSpec | undefined>> = {
    "--user-data-dir": { key: "userDataDir", value: true },
    "--profile": { key: "profile", value: true },
};

export function parseCliArgs(argv: readonly string[]): ICliArgs {
    const positional: string[] = [];
    let userDataDir: string | undefined;
    let profile: string | undefined;
    let help = false;
    let version = false;

    let i = 0;
    while (i < argv.length) {
        const arg = argv[i];

        if (arg === "--") {
            for (let j = i + 1; j < argv.length; j++) positional.push(argv[j]);
            break;
        }

        if (arg === "-h" || arg === "--help") {
            help = true;
            i += 1;
            continue;
        }

        if (arg === "-v" || arg === "--version") {
            version = true;
            i += 1;
            continue;
        }

        if (arg.startsWith("--")) {
            const eqIndex = arg.indexOf("=");
            const name = eqIndex === -1 ? arg : arg.slice(0, eqIndex);
            const inlineValue = eqIndex === -1 ? undefined : arg.slice(eqIndex + 1);

            const spec = FLAG_SPECS[name];
            if (spec === undefined) {
                throw new CliArgsError(`Unknown option: ${name}`);
            }

            let value: string;
            if (inlineValue !== undefined) {
                value = inlineValue;
                i += 1;
            } else {
                if (i + 1 >= argv.length) {
                    throw new CliArgsError(`Option ${name} requires a value`);
                }
                value = argv[i + 1];
                i += 2;
            }

            if (value.length === 0) {
                throw new CliArgsError(`Option ${name} requires a non-empty value`);
            }

            if (spec.key === "userDataDir") userDataDir = value;
            else profile = value;
            continue;
        }

        if (arg.startsWith("-") && arg.length > 1) {
            throw new CliArgsError(`Unknown option: ${arg}`);
        }

        positional.push(arg);
        i += 1;
    }

    return { positional, userDataDir, profile, help, version };
}
