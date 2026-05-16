// Sample file for the test fixture.
// Open vexx with this fixture without touching the real ~/.vexx:
//
//   npm start -- --user-data-dir ./test-fixtures/vexx-home test-fixtures/vexx-home/sample.ts
//
// Try the "compact" profile (tabSize=8, tabs instead of spaces):
//
//   npm start -- --user-data-dir ./test-fixtures/vexx-home --profile compact \
//       test-fixtures/vexx-home/sample.ts

export function greet(name: string): string {
    return `Hello, ${name}!`;
}

const numbers = [1, 2, 3, 4, 5];
for (const n of numbers) {
    console.log(greet(`item ${n}`));
}
