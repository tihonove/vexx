import * as os from "node:os";
import * as path from "node:path";

import type { ContainerModule } from "../../Common/DiContainer.ts";
import { token } from "../../Common/DiContainer.ts";
import type { IUserDataPaths } from "../../Common/UserDataPaths.ts";
import { resolveUserDataPaths } from "../../Common/UserDataPaths.ts";

/**
 * Резолвнутые пути user data активного профиля (`settings.json`, `keybindings.json`, …).
 * Нужны командам «открыть настройки / бинды», чтобы знать, какой файл открыть в редакторе.
 */
export const UserDataPathsDIToken = token<IUserDataPaths>("UserDataPaths");

export interface UserDataPathsModuleContext {
    userDataPaths: IUserDataPaths;
}

/** Биндит уже посчитанный в `main.ts` набор путей user data. */
export const userDataPathsModule: ContainerModule<UserDataPathsModuleContext> = (container, { userDataPaths }) => {
    container.bind(UserDataPathsDIToken, () => userDataPaths);
};

/**
 * Shortcut для тестов и demo: резолвит пути в изолированный каталог под `os.tmpdir()`,
 * чтобы команды «открыть настройки/бинды» в тестах никогда не писали в реальный `~/.vexx`.
 * Тесты, которым нужна проверка содержимого файла, перебиндят токен на свой mkdtemp-путь.
 */
export const userDataPathsModuleDefault: ContainerModule = (container) => {
    container.bind(UserDataPathsDIToken, () =>
        resolveUserDataPaths({ userDataDir: path.join(os.tmpdir(), "vexx-test-user-data"), homedir: os.tmpdir() }),
    );
};
