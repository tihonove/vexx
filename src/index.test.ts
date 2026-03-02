import { describe, it, expect } from "vitest";
import { hello } from "./index.js";

describe("hello", () => {
  it("should return greeting", () => {
    expect(hello()).toBe("Hello, World!");
  });
});
