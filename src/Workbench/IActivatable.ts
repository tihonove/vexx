/**
 * Контракт async-инициализации сервисов Workbench. У компонентов отдельных
 * mount()/activate() нет — вся их сборка происходит в конструкторе; если
 * сервису нужна асинхронная инициализация (чтение диска, индексация, spawn
 * процессов), он реализует IActivatable, а App вызывает activate() при старте.
 */
export interface IActivatable {
    activate(): Promise<void>;
}
