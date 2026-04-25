/**
 * Сервис определения language id по пути к файлу.
 *
 * Реализуется в `Extensions/LanguageRegistry`. Editor/Controllers зависят
 * только от этого интерфейса — это та же дисциплина, что и с
 * {@link ITokenStyleResolver}: тип живёт здесь, реализация — в верхних
 * слоях. Никаких прямых импортов `Extensions/*` из Editor/Controllers.
 */
export interface ILanguageService {
    /**
     * Возвращает language id для данного абсолютного или относительного
     * пути к файлу, либо `undefined`, если язык не зарегистрирован
     * (потребитель тогда обычно откатывается на `"plaintext"`).
     */
    getLanguageIdForResource(filePath: string): string | undefined;
}

/**
 * Заглушка для случаев, когда `ILanguageService` ещё не подключён
 * (тесты, ранний bootstrap). Всегда возвращает `undefined`.
 */
export const NULL_LANGUAGE_SERVICE: ILanguageService = {
    getLanguageIdForResource: () => undefined,
};
