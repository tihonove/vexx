import { Uri } from "../../../../base/common/uri.ts";
import type { CommandAction } from "../../../../platform/actions/common/commandAction.ts";
import type { ServiceAccessor } from "../../../../platform/instantiation/common/diContainer.ts";
import { DiffEditorPane } from "../../../browser/parts/editor/diffEditorPane.ts";
import { FileSystemProviderRegistryDIToken } from "../../../common/coreTokens.ts";
import {
    LanguageServiceDIToken,
    TokenizationRegistryDIToken,
    TokenStyleResolverDIToken,
} from "../../../common/coreTokens.ts";
import { EditorServiceDIToken } from "../../../services/editor/browser/editorService.ts";
import { StatusBarServiceDIToken } from "../../../services/statusbar/common/statusBarService.ts";
import { ThemeServiceDIToken } from "../../../services/themes/common/themeTokens.ts";

import { OriginalResourceProviderDIToken } from "./quickDiffService.ts";

/** Схема вкладки диффа: не ресурс на диске, а пара «файл ↔ ревизия». */
const DIFF_SCHEME = "vexx-diff";

/** Сколько держать сообщение о том, что сравнивать не с чем. */
export const COMPARE_NOTICE_MS = 4000;

/**
 * «Сравнить с HEAD» — вкладка с inline-диффом активного файла против версии из
 * git. Соединяет всё, что собрано этапами 0–3: оригинал даёт SCM-расширение
 * (`IOriginalResourceProvider`), читается он через реестр провайдеров ФС, дифф
 * считает перенесённый движок, отображение собирает `DiffViewModel`, а вкладкой
 * это становится благодаря абстракции панели.
 *
 * Дифф — **снимок** на момент вызова: панель держит тексты у себя. Живой
 * пересчёт по правкам исходного буфера — отдельная задача (docs/TODO/Diff.md).
 */
async function compareWithHead(accessor: ServiceAccessor): Promise<void> {
    const editors = accessor.get(EditorServiceDIToken);
    const editor = editors.getActiveEditor();
    if (editor === null) return;

    const notice = (message: string): void => {
        const handle = accessor
            .get(StatusBarServiceDIToken)
            .addEntry({ id: "scm.compare.notice", text: message, alignment: "left", priority: 100 });
        setTimeout(() => {
            handle.dispose();
        }, COMPARE_NOTICE_MS);
    };

    const originalText = await readOriginal(accessor, editor.uri);
    if (originalText === null) {
        // Untracked, вне репозитория, git недоступен, SCM-расширение не поднялось —
        // для пользователя всё это одно и то же: сравнивать не с чем.
        notice("No changes to compare: the file has no version in git");
        return;
    }

    const pane = new DiffEditorPane(
        accessor.get(ThemeServiceDIToken),
        accessor.get(TokenizationRegistryDIToken),
        accessor.get(TokenStyleResolverDIToken),
        {
            uri: Uri.from({ scheme: DIFF_SCHEME, path: editor.uri.path, query: "HEAD" }),
            label: `${editors.displayName(editor)} ↔ HEAD`,
            originalText,
            modifiedText: editor.getText(),
            languageId: editor.languageId,
        },
    );
    editors.openPane(pane);
}

/** Текст версии из git, либо `null`, если сравнивать не с чем. */
async function readOriginal(accessor: ServiceAccessor, uri: Uri): Promise<string | null> {
    try {
        const original = await accessor.get(OriginalResourceProviderDIToken).provideOriginalResource(uri);
        if (original === null) return null;
        const providers = accessor.get(FileSystemProviderRegistryDIToken);
        if (!providers.hasProvider(original.scheme)) return null;
        return new TextDecoder().decode(await providers.readFile(original));
    } catch {
        return null;
    }
}

export const compareWithHeadAction: CommandAction = {
    id: "vexx.scm.compareWithHead",
    title: "Git: Compare Active File with HEAD",
    run(accessor) {
        void compareWithHead(accessor);
    },
};
