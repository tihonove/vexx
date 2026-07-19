export function reject(): never {
    throw new Error("Unexpected state");
}
