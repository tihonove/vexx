import * as fs from "node:fs";

import iconv from "iconv-lite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Uri } from "../Common/Uri.ts";

import { createRange } from "../Editor/IRange.ts";
import { createTextEdit } from "../Editor/ITextEdit.ts";
import { NULL_LANGUAGE_SERVICE } from "../Editor/Tokenization/ILanguageService.ts";
import { NULL_TOKEN_STYLE_RESOLVER } from "../Editor/Tokenization/ITokenStyleResolver.ts";
import { TokenizationRegistry } from "../Editor/Tokenization/TokenizationRegistry.ts";
import { createTempWorkspace, type ITempWorkspace } from "../TestUtils/TempWorkspace.ts";
import { darkPlusTheme } from "../Theme/themes/darkPlus.ts";
import { ThemeService } from "../Theme/ThemeService.ts";
import { WorkbenchTheme } from "../Theme/WorkbenchTheme.ts";

import { EditorController } from "./EditorController.ts";
import { UndoRedoService } from "../Workbench/Services/Workspace/UndoRedoService.ts";

function createEditorController(): EditorController {
    return new EditorController(
        new ThemeService(WorkbenchTheme.fromThemeFile(darkPlusTheme)),
        new TokenizationRegistry(),
        NULL_TOKEN_STYLE_RESOLVER,
        NULL_LANGUAGE_SERVICE,
        new UndoRedoService(),
    );
}

describe("EditorController — encoding axis", () => {
    let ws: ITempWorkspace;

    beforeEach(() => {
        ws = createTempWorkspace({ prefix: "vexx-editorctrl-enc-" });
    });

    afterEach(() => {
        ws.dispose();
    });

    function writeBytes(name: string, bytes: Buffer): string {
        const filePath = ws.path(name);
        fs.writeFileSync(filePath, bytes);
        return filePath;
    }

    it("новый безымянный буфер — utf8 по умолчанию", () => {
        const controller = createEditorController();
        expect(controller.encoding).toBe("utf8");
        controller.dispose();
    });

    it("детектит utf8bom / utf16le / utf16be по BOM при открытии", () => {
        const cases: Array<[string, Buffer]> = [
            ["utf8bom", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("hi", "utf8")])],
            ["utf16le", Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode("hi", "utf16le")])],
            ["utf16be", Buffer.concat([Buffer.from([0xfe, 0xff]), iconv.encode("hi", "utf16-be")])],
        ];
        for (const [expected, bytes] of cases) {
            const controller = createEditorController();
            controller.openFile(Uri.file(writeBytes(`${expected}.txt`, bytes)));
            expect(controller.encoding).toBe(expected);
            expect(controller.getText()).toBe("hi");
            controller.dispose();
        }
    });

    it("файл без BOM читается как utf8", () => {
        const controller = createEditorController();
        controller.openFile(Uri.file(writeBytes("plain.txt", Buffer.from("привет\n", "utf8"))));
        expect(controller.encoding).toBe("utf8");
        expect(controller.getText()).toBe("привет\n");
        controller.dispose();
    });

    it("reopenWithEncoding перечитывает файл в указанной кодировке", () => {
        const controller = createEditorController();
        const fp = writeBytes("cyr.txt", iconv.encode("Привет, мир!\n", "windows1251"));
        controller.openFile(Uri.file(fp));
        // Как utf8 — кракозябры.
        expect(controller.getText()).not.toContain("Привет");

        expect(controller.reopenWithEncoding("windows1251")).toBe(true);
        expect(controller.encoding).toBe("windows1251");
        expect(controller.getText()).toBe("Привет, мир!\n");
        controller.dispose();
    });

    it("reopenWithEncoding возвращает false для безымянного буфера", () => {
        const controller = createEditorController();
        expect(controller.reopenWithEncoding("windows1251")).toBe(false);
        controller.dispose();
    });

    it("DoD #106: roundtrip cp1251 read → edit → write байт-в-байт", async () => {
        const controller = createEditorController();
        const original = "первая строка\nвторая строка\n";
        const fp = writeBytes("roundtrip.txt", iconv.encode(original, "windows1251"));
        controller.openFile(Uri.file(fp));
        controller.reopenWithEncoding("windows1251");

        controller.applyExternalEdits([createTextEdit(createRange(0, 0, 0, 0), "правка: ")], "test edit");
        await controller.save();

        const expected = iconv.encode("правка: " + original, "windows1251");
        expect([...fs.readFileSync(fp)]).toEqual([...expected]);
        controller.dispose();
    });

    it("utf8bom: BOM переживает save", async () => {
        const controller = createEditorController();
        const fp = writeBytes("bom.txt", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("x\n", "utf8")]));
        controller.openFile(Uri.file(fp));
        expect(controller.encoding).toBe("utf8bom");

        controller.applyExternalEdits([createTextEdit(createRange(0, 0, 0, 0), "y")], "test edit");
        await controller.save();

        const written = fs.readFileSync(fp);
        expect([...written.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        expect(written.subarray(3).toString("utf8")).toBe("yx\n");
        controller.dispose();
    });

    it("saveWithEncoding пишет в новой кодировке и меняет encoding", async () => {
        const controller = createEditorController();
        const fp = ws.writeFile("save-as-enc.txt", "Ёлка\n");
        controller.openFile(Uri.file(fp));
        expect(controller.encoding).toBe("utf8");

        const outcome = await controller.saveWithEncoding("windows1251");

        expect(outcome).toBe("saved");
        expect(controller.encoding).toBe("windows1251");
        expect([...fs.readFileSync(fp)]).toEqual([...iconv.encode("Ёлка\n", "windows1251")]);
        controller.dispose();
    });

    it("saveWithEncoding у безымянного буфера — no-file, но кодировка выставлена", async () => {
        const controller = createEditorController();
        expect(await controller.saveWithEncoding("windows1251")).toBe("no-file");
        expect(controller.encoding).toBe("windows1251");
        controller.dispose();
    });

    it("смена кодировки не влияет на isModified", () => {
        const controller = createEditorController();
        const fp = ws.writeFile("clean.txt", "abc\n");
        controller.openFile(Uri.file(fp));
        expect(controller.isModified).toBe(false);

        controller.setEncoding("windows1251");
        expect(controller.isModified).toBe(false);
        controller.dispose();
    });

    it("setEncoding игнорирует неизвестные id", () => {
        const controller = createEditorController();
        controller.setEncoding("martian");
        expect(controller.encoding).toBe("utf8");
        controller.dispose();
    });

    it("onDidChangeEncoding срабатывает на setEncoding и reopenWithEncoding, но не на no-op", () => {
        const controller = createEditorController();
        const fp = ws.writeFile("events.txt", "abc\n");
        controller.openFile(Uri.file(fp));
        let fired = 0;
        controller.onDidChangeEncoding(() => fired++);

        controller.setEncoding("utf8"); // no-op
        expect(fired).toBe(0);
        controller.setEncoding("koi8r");
        expect(fired).toBe(1);
        controller.reopenWithEncoding("windows1251");
        expect(fired).toBe(2);
        controller.dispose();
    });

    it("повторный dispose подписки onDidChangeEncoding безопасен", () => {
        const controller = createEditorController();
        let fired = 0;
        const subscription = controller.onDidChangeEncoding(() => fired++);
        subscription.dispose();
        subscription.dispose(); // второй dispose: слушателя уже нет в списке
        controller.setEncoding("koi8r");
        expect(fired).toBe(0);
        controller.dispose();
    });

    it("revertToDisk пере-детектит кодировку (BOM-сниф, не прежний выбор)", () => {
        const controller = createEditorController();
        const fp = writeBytes("redetect.txt", iconv.encode("текст\n", "windows1251"));
        controller.openFile(Uri.file(fp));
        controller.reopenWithEncoding("windows1251");
        expect(controller.encoding).toBe("windows1251");

        controller.revertToDisk();
        expect(controller.encoding).toBe("utf8");
        controller.dispose();
    });

    it("открытие другого файла сбрасывает кодировку на детект нового файла", () => {
        const controller = createEditorController();
        const cyr = writeBytes("one.txt", iconv.encode("текст", "windows1251"));
        controller.openFile(Uri.file(cyr));
        controller.reopenWithEncoding("windows1251");

        const bom = writeBytes("two.txt", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("x")]));
        controller.openFile(Uri.file(bom));
        expect(controller.encoding).toBe("utf8bom");
        controller.dispose();
    });

    it("снапшот save-участника несёт encoding", async () => {
        const controller = createEditorController();
        const fp = writeBytes("snap.txt", iconv.encode("текст\n", "windows1251"));
        controller.openFile(Uri.file(fp));
        controller.reopenWithEncoding("windows1251");

        let seen: string | null = null;
        controller.saveParticipant = (snapshot) => {
            seen = snapshot.encoding;
            return Promise.resolve([]);
        };
        await controller.save();
        expect(seen).toBe("windows1251");
        controller.dispose();
    });
});
