import { describe, expect, it } from "vitest";

import { Container, token } from "./DiContainer.ts";

// ── Test helpers ────────────────────────────────────────────

class Logger {
    public static dependencies = [] as const;
    public readonly tag = "logger";
}

class Database {
    public static dependencies = [] as const;
    public readonly tag = "db";
}

const ILogger = token<Logger>("Logger");
const IDatabase = token<Database>("Database");

class UserService {
    public static dependencies = [ILogger, IDatabase] as const;

    public readonly logger: Logger;
    public readonly db: Database;

    public constructor(logger: Logger, db: Database) {
        this.logger = logger;
        this.db = db;
    }
}

const IUserService = token<UserService>("UserService");

// ── Tests ───────────────────────────────────────────────────

describe("DiContainer", () => {
    describe("factory binding", () => {
        it("resolves a value from factory function", () => {
            const IValue = token<number>("Value");
            const container = new Container().bind(IValue, () => 42);

            expect(container.get(IValue)).toBe(42);
        });
    });

    describe("class binding with static dependencies", () => {
        it("resolves class with no dependencies", () => {
            const container = new Container().bind(ILogger, Logger);

            const logger = container.get(ILogger);

            expect(logger).toBeInstanceOf(Logger);
            expect(logger.tag).toBe("logger");
        });

        it("resolves class with dependencies", () => {
            const container = new Container()
                .bind(ILogger, Logger)
                .bind(IDatabase, Database)
                .bind(IUserService, UserService);

            const svc = container.get(IUserService);

            expect(svc).toBeInstanceOf(UserService);
            expect(svc.logger).toBeInstanceOf(Logger);
            expect(svc.db).toBeInstanceOf(Database);
        });

        it("resolves dependency chain A → B → C", () => {
            const IC = token<C>("C");
            const IB = token<B>("B");
            const IA = token<A>("A");

            class C {
                public static dependencies = [] as const;
                public readonly tag = "c";
            }
            class B {
                public static dependencies = [IC] as const;
                public readonly c: C;
                public constructor(c: C) {
                    this.c = c;
                }
            }
            class A {
                public static dependencies = [IB] as const;
                public readonly b: B;
                public constructor(b: B) {
                    this.b = b;
                }
            }

            const container = new Container().bind(IC, C).bind(IB, B).bind(IA, A);

            const a = container.get(IA);

            expect(a.b.c.tag).toBe("c");
        });

        it("bind order does not matter (lazy resolution)", () => {
            const container = new Container()
                .bind(IUserService, UserService)
                .bind(IDatabase, Database)
                .bind(ILogger, Logger);

            const svc = container.get(IUserService);

            expect(svc.logger).toBeInstanceOf(Logger);
            expect(svc.db).toBeInstanceOf(Database);
        });
    });

    describe("singleton behavior", () => {
        it("returns the same instance on repeated get()", () => {
            const container = new Container().bind(ILogger, Logger);

            const a = container.get(ILogger);
            const b = container.get(ILogger);

            expect(a).toBe(b);
        });

        it("dependencies are shared singletons", () => {
            const container = new Container()
                .bind(ILogger, Logger)
                .bind(IDatabase, Database)
                .bind(IUserService, UserService);

            const svc = container.get(IUserService);
            const logger = container.get(ILogger);

            expect(svc.logger).toBe(logger);
        });
    });

    describe("error handling", () => {
        it("throws on missing binding", () => {
            const container = new Container();
            const IMissing = token<string>("Missing");

            expect(() => container.get(IMissing)).toThrowError('No binding for "Missing"');
        });

        it("throws on circular dependency", () => {
            const IX = token<unknown>("X");
            const IY = token<unknown>("Y");

            const container: Container = new Container()
                .bind(IX, (): unknown => container.get(IY))
                .bind(IY, (): unknown => container.get(IX));

            expect(() => container.get(IX)).toThrowError(/Circular dependency detected.*X.*Y/);
        });
    });

    describe("plain constructor (no DI)", () => {
        it("class with static dependencies can be constructed directly", () => {
            const logger = new Logger();
            const db = new Database();
            const svc = new UserService(logger, db);

            expect(svc.logger).toBe(logger);
            expect(svc.db).toBe(db);
        });
    });
});
