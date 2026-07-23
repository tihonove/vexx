"use strict";

/**
 * Фикстура для extensionHost.fileSystem.test.ts.
 * Регистрирует read-only FileSystemProvider для схемы `demo:` — тот же путь,
 * которым встроенный git отдаёт версию файла из HEAD по схеме `git:`.
 *
 * Содержимое выводится из пути ресурса, чтобы тест мог проверить, что до
 * провайдера доехал именно запрошенный URI. `fire()` через команду позволяет
 * тесту дёрнуть onDidChangeFile из субпроцесса и увидеть его на хосте.
 */
exports.activate = function activate(context) {
    const vscode = require("vscode");

    const emitter = new vscode.EventEmitter();

    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider(
            "demo",
            {
                onDidChangeFile: emitter.event,
                watch: function () {
                    return new vscode.Disposable(function () {});
                },
                stat: function () {
                    return { type: vscode.FileType.File, ctime: 0, mtime: 0, size: 0 };
                },
                readFile: function (uri) {
                    if (uri.path === "/missing") {
                        throw vscode.FileSystemError.FileNotFound(uri);
                    }
                    return new TextEncoder().encode("содержимое " + uri.path);
                },
            },
            { isReadonly: true },
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("demo.fireChange", function (path) {
            emitter.fire([{ type: vscode.FileChangeType.Changed, uri: vscode.Uri.parse("demo:" + path) }]);
        }),
    );
};
