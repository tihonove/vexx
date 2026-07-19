"use strict";

/**
 * Фикстура для ExtensionHost.Decorations.test.ts (Chunk 4 — host-bridge).
 *
 * В activate():
 *  - создаёт gutter change-bar тип (`overviewRulerColor` = ThemeColor) и
 *    «плоский» тип без overviewRulerColor (host его игнорирует — не gutter);
 *  - вешает оба на активный редактор (у gutter-типа два диапазона);
 *  - регистрирует FileDecorationProvider (цвет+бейдж для `notes.md`, иначе — снятие).
 *
 * Команды `test.fireFileDecoration(fsPath)` / `test.disposeGutterType()` дают
 * тесту сдвинуть состояние после activate.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");

    const gutterType = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        overviewRulerLane: vscode.OverviewRulerLane.Left,
        overviewRulerColor: new vscode.ThemeColor("editorGutter.modifiedBackground"),
    });
    context.subscriptions.push(gutterType);

    // Тип без overviewRulerColor — не gutter, host его декорации не проецирует.
    const plainType = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor("editor.background"),
    });
    context.subscriptions.push(plainType);

    const editor = vscode.window.activeTextEditor;
    if (editor != null) {
        editor.setDecorations(gutterType, [new vscode.Range(1, 0, 1, 0), new vscode.Range(3, 0, 3, 0)]);
        editor.setDecorations(plainType, [new vscode.Range(0, 0, 0, 5)]);
    }

    let cleared = false;
    const emitter = new vscode.EventEmitter();
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider({
            onDidChangeFileDecorations: emitter.event,
            provideFileDecoration: function (uri) {
                if (!cleared && uri.fsPath.endsWith("notes.md")) {
                    return new vscode.FileDecoration(
                        "M",
                        "Modified",
                        new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"),
                    );
                }
                return undefined;
            },
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("test.fireFileDecoration", function (fsPath) {
            emitter.fire(vscode.Uri.file(fsPath));
        }),
    );
    // Переводит провайдер в режим «снято»: следующий provideFileDecoration вернёт undefined.
    context.subscriptions.push(
        vscode.commands.registerCommand("test.setCleared", function () {
            cleared = true;
        }),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand("test.disposeGutterType", function () {
            gutterType.dispose();
        }),
    );
};
