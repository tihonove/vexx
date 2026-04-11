export interface ITreeItem {
    readonly label: string;
    readonly icon?: string;
    readonly iconColor?: number;
    readonly collapsible: boolean;
}

export interface ITreeDataProvider<T> {
    getTreeItem(element: T): ITreeItem;
    getChildren(element?: T): T[] | Promise<T[]>;
    getKey(element: T): string;
    onChange?: (element?: T) => void;
}
