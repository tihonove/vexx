export interface IDisposable {
    dispose(): void;
}

export class Disposable implements IDisposable {
    private disposables: IDisposable[] = [];
    private disposed = false;

    protected register<T extends IDisposable>(disposable: T): T {
        this.disposables.push(disposable);
        return disposable;
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        // Dispose in reverse order (LIFO)
        for (let i = this.disposables.length - 1; i >= 0; i--) {
            this.disposables[i].dispose();
        }
        this.disposables.length = 0;
    }
}
