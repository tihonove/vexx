// One-shot lifecycle-коллектор проблем-матчеров.
//
// Драйвит движки границами процесса: `start(matchers)` (запуск) чистит маркеры прошлого
// прогона тех же owner'ов, `onLine` стримит строки в матчеры, `flush()` (exit) пишет
// накопленное в `MarkerService`. Построен на потоковом `onLine`/`onExit`-контракте, чтобы
// watch-коллектор (`beginsPattern`/`endsPattern`) добавился поверх без переделки движка.
//
// Коллектор **персистентный** (живёт вместе с контроллером): он помнит, какие ресурсы
// записал каждый owner, и на следующем запуске того же owner'а их чистит. Owner берётся
// из `matcher.owner` → диагностики таска изолированы от валидатора настроек и друг от
// друга; чужие owner'ы перезапуск не трогает (как в VS Code).

import type { IMarkerData } from "../../Editor/Markers/IMarker.ts";
import type { MarkerService } from "../../Editor/Markers/MarkerService.ts";

import type { IProblemMatcher } from "./ITask.ts";
import { ProblemMatcher } from "./ProblemMatcher.ts";

/** Резолвер пути с учётом `fileLocation` конкретного матчера (строит контроллер). */
export type ResolveResourceFor = (file: string, matcher: IProblemMatcher) => string;

export class StartStopProblemCollector {
    private readonly resolveResource: ResolveResourceFor;
    private readonly markerService: MarkerService;

    /** Матчеры и движки текущего прогона (задаются в `start`). */
    private matchers: readonly IProblemMatcher[] = [];
    private engines: ProblemMatcher[] = [];
    /** Ресурсы, записанные последним прогоном каждого owner'а — чистим на его рестарте. */
    private readonly writtenByOwner = new Map<string, Set<string>>();

    public constructor(resolveResource: ResolveResourceFor, markerService: MarkerService) {
        this.resolveResource = resolveResource;
        this.markerService = markerService;
    }

    /**
     * Начало прогона: снести маркеры прошлого прогона owner'ов ЭТОГО набора матчеров и
     * завести свежие движки. Чужие owner'ы (другие таски/валидаторы) не трогаются.
     */
    public start(matchers: readonly IProblemMatcher[]): void {
        this.matchers = matchers;
        this.engines = matchers.map((matcher) => new ProblemMatcher(matcher, (file) => this.resolveResource(file, matcher)));
        for (const owner of new Set(matchers.map((m) => m.owner))) {
            const resources = this.writtenByOwner.get(owner);
            if (resources === undefined) continue;
            for (const resource of resources) this.markerService.changeOne(owner, resource, []);
            this.writtenByOwner.delete(owner);
        }
    }

    /** Скормить одну строку вывода всем матчерам. */
    public onLine(line: string): void {
        for (const engine of this.engines) engine.processLine(line);
    }

    /** Конец прогона: агрегировать маркеры по owner+resource и записать в реестр. */
    public flush(): void {
        // owner → resource → markers (несколько матчеров одного owner мержатся).
        const byOwner = new Map<string, Map<string, IMarkerData[]>>();
        for (let i = 0; i < this.engines.length; i++) {
            const owner = this.matchers[i].owner;
            const byResource = byOwner.get(owner) ?? new Map<string, IMarkerData[]>();
            byOwner.set(owner, byResource);
            for (const [resource, markers] of this.engines[i].getMarkers()) {
                const list = byResource.get(resource) ?? [];
                list.push(...markers);
                byResource.set(resource, list);
            }
        }

        for (const [owner, byResource] of byOwner) {
            const resources = new Set<string>();
            for (const [resource, markers] of byResource) {
                this.markerService.changeOne(owner, resource, markers);
                resources.add(resource);
            }
            if (resources.size > 0) this.writtenByOwner.set(owner, resources);
        }
    }
}
