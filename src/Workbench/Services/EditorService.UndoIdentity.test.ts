import * as fs from "node:fs";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NULL_FILE_WATCHER } from "../../Common/IFileWatcher.ts";
import { NULL_CONFIGURATION_SERVICE } from "../../Configuration/NullConfigurationService.ts";
import { NULL_LANGUAGE_SERVICE } from "../../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../../Theme/themes/darkPlus.ts";
import { ThemeService } from "../../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../../Theme/WorkbenchTheme.ts";

import { EditorService } from "./EditorService.ts";
import { UndoRedoService } from "./Workspace/UndoRedoService.ts";

let ws: ITempWorkspace;
let tmpDir: string;

beforeEach(() => {
    ws = createTempWorkspace({ prefix: "vexx-undoid-" });
    tmpDir = ws.dir;
});

afterEach(() => {
    ws.dispose();
});

function createGroup(): EditorService {
    const group = new EditorService(
        new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        NULL_CONFIGURATION_SERVICE,
        new UndoRedoService(),
        NULL_FILE_WATCHER,
    );
    return group;
}

/**
 * Идентичность истории отмены: у каждого редактора свой бакет, и он переживает
 * смену пути. Проверяем через публичный контракт (текст буферов), а не через
 * ключ бакета — ключ намеренно непрозрачен.
 */
describe("EditorService — идентичность истории отмены", () => {
    it("два untitled-буфера не делят историю: undo в одном не трогает другой", () => {
        const group = createGroup();
        group.newUntitled();
        const first = group.getActiveEditor()!;
        group.newUntitled();
        const second = group.getActiveEditor()!;

        first.pushUndo(first.viewState.type("first"));
        second.pushUndo(second.viewState.type("second"));

        first.undo();

        expect(first.getText()).toBe("");
        expect(second.getText()).toBe("second");
    });

    it("закрытие одного untitled-буфера не чистит историю другого", () => {
        const group = createGroup();
        group.newUntitled();
        const first = group.getActiveEditor()!;
        group.newUntitled();
        const second = group.getActiveEditor()!;

        first.pushUndo(first.viewState.type("first"));
        second.pushUndo(second.viewState.type("second"));

        group.closeTab(0);

        second.undo();
        expect(second.getText()).toBe("");
    });

    it("saveAs сохраняет историю: undo откатывает правку, сделанную до сохранения", async () => {
        const group = createGroup();
        group.newUntitled();
        const editor = group.getActiveEditor()!;

        editor.pushUndo(editor.viewState.type("before save"));
        await editor.saveAs(path.join(tmpDir, "note.txt"));

        editor.undo();

        expect(editor.getText()).toBe("");
    });

    it("saveAs сохраняет историю: redo после undo возвращает правку", async () => {
        const group = createGroup();
        group.newUntitled();
        const editor = group.getActiveEditor()!;

        editor.pushUndo(editor.viewState.type("before save"));
        await editor.saveAs(path.join(tmpDir, "note.txt"));

        editor.undo();
        // Промежуточный ассерт обязателен: без него тест проходит вакуумно —
        // сломанный undo просто ничего не делает, и текст остаётся исходным.
        expect(editor.getText()).toBe("");

        editor.redo();
        expect(editor.getText()).toBe("before save");
    });

    it("undo не смешивает истории двух открытых файлов", () => {
        const group = createGroup();
        const alpha = path.join(tmpDir, "alpha.txt");
        const beta = path.join(tmpDir, "beta.txt");
        fs.writeFileSync(alpha, "");
        fs.writeFileSync(beta, "");

        group.openFile(alpha);
        const first = group.getActiveEditor()!;
        group.openFile(beta);
        const second = group.getActiveEditor()!;

        first.pushUndo(first.viewState.type("alpha edit"));
        second.pushUndo(second.viewState.type("beta edit"));

        first.undo();

        expect(first.getText()).toBe("");
        expect(second.getText()).toBe("beta edit");
    });
});
