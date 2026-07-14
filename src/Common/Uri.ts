import { URI, Utils } from "vscode-uri";

/**
 * Идентичность ресурса: `scheme://authority/path?query#fragment`.
 *
 * Это upstream-реализация VS Code (`vscode-uri` — тот же `vs/base/common/uri.ts`,
 * выделенный Microsoft в отдельный leaf-пакет), а не наш порт: семантика `fsPath`,
 * percent-кодирования и Windows-путей полна нюансов, воспроизводить которые вручную
 * незачем. Ядро и extension host используют один и тот же тип — `vscode.Uri` в
 * субпроцессе это ре-экспорт отсюда.
 *
 * Единственное расхождение с upstream, которое приходится чинить адаптером:
 * `joinPath` в `vscode-uri` живёт в неймспейсе `Utils`, а расширения ждут статик
 * `vscode.Uri.joinPath`. Дописываем его на класс — `Object.assign` сохраняет
 * идентичность класса, поэтому `instanceof` внутри расширений продолжает работать.
 *
 * Осторожно: `fsPath` НЕ бросает на не-file схемах, а возвращает путь как есть
 * (`untitled:Untitled-1` → `"Untitled-1"`). Дисковые операции гейтить по
 * `uri.scheme === "file"`, а не по «путь непустой».
 */
export const Uri = Object.assign(URI, { joinPath: Utils.joinPath });

export type Uri = URI;
