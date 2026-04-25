import type { IExtensionManifest } from "./IExtensionManifest.ts";

/**
 * Прочитанное и провалидированное расширение.
 *
 * `location` — абсолютный путь к каталогу расширения; используется для
 * resolve относительных путей из `contributes.grammars[].path`,
 * `contributes.languages[].configuration` и т.д.
 *
 * `id` формируется как `${publisher}.${name}` — это identifier, под которым
 * расширение видно в Marketplace и в `vscode.extensions.getExtension(id)`.
 */
export interface IExtension {
    readonly id: string;
    readonly manifest: IExtensionManifest;
    readonly location: string;
    readonly isBuiltin: boolean;
}
