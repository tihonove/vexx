"use strict";

// Фикстура WP7: повторяет поведение стоковой команды `EditorConfig.generate`
// поверх нового `workspace.fs` API — проверяет существование через fs.stat и
// пишет `.editorconfig` в корень воркспейса через fs.writeFile + Uri.joinPath.
exports.activate = function activate(context) {
    const vscode = require("vscode");
    context.subscriptions.push(
        vscode.commands.registerCommand("EditorConfig.generate", async function () {
            const root = vscode.workspace.workspaceFolders[0].uri;
            const target = vscode.Uri.joinPath(root, ".editorconfig");
            try {
                await vscode.workspace.fs.stat(target);
                return "exists";
            } catch (err) {
                // FileNotFound — файла ещё нет, продолжаем генерацию.
            }
            const content = "root = true\n\n[*]\nindent_style = space\nindent_size = 4\n";
            await vscode.workspace.fs.writeFile(target, Buffer.from(content, "utf8"));
            return "generated";
        }),
    );
};

exports.deactivate = function deactivate() {};
