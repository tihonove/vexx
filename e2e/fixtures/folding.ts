// fixture for the folding-chevron hover scenario — several foldable regions
export function alpha(x: number): number {
    const doubled = x * 2;
    return doubled + 1;
}

export function beta(items: string[]): string {
    const joined = items.join(", ");
    return "[" + joined + "]";
}

export function gamma(flag: boolean): void {
    if (flag) {
        console.log("on");
    }
}
