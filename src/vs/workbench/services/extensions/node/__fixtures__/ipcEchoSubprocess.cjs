// Helper subprocess для IpcMessageChannel.RoundTrip.test.ts.
// Запускается через `child_process.spawn(process.execPath, [thisFile], { stdio: [...,'ipc'] })`.
// Эхо-сервер: на любое сообщение `{ id, payload }` отвечает `{ id, echo: payload }`.

"use strict";

process.on("message", function (msg) {
    if (typeof msg !== "object" || msg === null) return;
    if (msg.cmd === "exit") {
        process.exit(0);
    }
    if (typeof process.send !== "function") return;
    process.send({ id: msg.id, echo: msg.payload });
});

// Сигнал готовности.
if (typeof process.send === "function") {
    process.send({ ready: true });
}
