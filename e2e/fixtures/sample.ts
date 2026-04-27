// fixture used by SEA e2e tests
const greeting = "hello";
const answer = 42;
export function greet(name: string): string {
    return greeting + " " + name + "!" + String(answer);
}
