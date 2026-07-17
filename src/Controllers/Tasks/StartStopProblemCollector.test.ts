import { describe, expect, it } from "vitest";

import { createRange } from "../../Editor/IRange.ts";
import { MarkerSeverity } from "../../Editor/Markers/IMarker.ts";
import { MarkerService } from "../../Editor/Markers/MarkerService.ts";

import type { IProblemMatcher } from "./ITask.ts";
import { StartStopProblemCollector } from "./StartStopProblemCollector.ts";

const TSC: IProblemMatcher = {
    owner: "typescript",
    source: "ts",
    fileLocation: "absolute",
    pattern: {
        regexp: "^(.+)\\((\\d+),(\\d+)\\):\\s+(error|warning)\\s+(TS\\d+):\\s+(.*)$",
        file: 1,
        line: 2,
        column: 3,
        severity: 4,
        code: 5,
        message: 6,
    },
};

// Резолвер под тест: путь → стабильный ресурс-ключ.
const resolve = (file: string): string => `file://${file}`;

function makeCollector(markers: MarkerService): StartStopProblemCollector {
    return new StartStopProblemCollector(resolve, markers);
}

describe("StartStopProblemCollector", () => {
    it("accumulates during a run and writes markers only on flush", () => {
        const markers = new MarkerService();
        const collector = makeCollector(markers);

        collector.start([TSC]);
        collector.onLine("a.ts(1,1): error TS1: boom");
        // До flush реестр пуст — маркеры пишутся только по exit.
        expect(markers.read()).toHaveLength(0);

        collector.flush();
        const written = markers.read({ owner: "typescript" });
        expect(written).toHaveLength(1);
        expect(written[0].resource).toBe("file://a.ts");
        expect(written[0].message).toBe("boom");
    });

    it("re-run clears markers for a resource that no longer errors", () => {
        const markers = new MarkerService();
        const collector = makeCollector(markers);

        // Первый прогон: ошибки в двух файлах.
        collector.start([TSC]);
        collector.onLine("a.ts(1,1): error TS1: boom");
        collector.onLine("b.ts(2,2): error TS2: bad");
        collector.flush();
        expect(markers.read()).toHaveLength(2);

        // Второй прогон: b.ts починили, ошибка осталась только в a.ts.
        collector.start([TSC]);
        // start() чистит прошлый прогон того же owner'а немедленно.
        expect(markers.read()).toHaveLength(0);
        collector.onLine("a.ts(1,1): error TS1: boom");
        collector.flush();

        const after = markers.read();
        expect(after).toHaveLength(1);
        expect(after[0].resource).toBe("file://a.ts");
    });

    it("leaves other owners' markers untouched", () => {
        const markers = new MarkerService();
        markers.changeOne("settings", "file://settings.json", [
            { severity: MarkerSeverity.Warning, range: createRange(0, 0, 0, 3), message: "Unknown setting" },
        ]);
        const before = markers.read({ owner: "settings" }).length;

        const collector = makeCollector(markers);
        collector.start([TSC]);
        collector.onLine("a.ts(1,1): error TS1: boom");
        collector.flush();

        expect(markers.read({ owner: "settings" })).toHaveLength(before);
        expect(markers.read({ owner: "typescript" })).toHaveLength(1);
    });
});
