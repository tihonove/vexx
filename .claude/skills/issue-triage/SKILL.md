---
name: issue-triage
description: >-
  Разгребатель GitHub-issue проекта Vexx. Триажит открытые issue, для каждой запускает
  автономного claude-воркера в своём git worktree + tmux-окне (пул до N параллельно), который
  доводит фичу до draft-PR либо оставляет разбор комментарием в issue. Используй, когда просят
  «разобрать issue», «сделать issues», «прогнать бэклог», распараллелить работу над задачами.
---

# Issue triage / разгребатель

Оркестрирует пул headless-воркеров `claude` над списком GitHub-issue. Каждый воркер работает
в изолированном worktree и либо открывает draft-PR (задача умещается в модель проекта), либо
оставляет разбор комментарием в issue (слишком большое / нужно решение владельца).

## Когда применять

Пользователь просит разобрать/сделать backlog issue, распараллелить работу над несколькими
задачами, «прогнать» набор issue до PR. Не для одиночной задачи — тогда работай напрямую в worktree.

## Модель

- **Work item** — одна issue или группа явно связанных issue (близких по реализации). Группировку
  решает оркестратор; связанную косметику/плумбинг объединяем, разные по сути — раздельно.
- **Воркер** — интерактивный `claude --dangerously-skip-permissions` (с промптом-аргументом) в
  worktree `../<repo>.worktrees/agents-<slug>` на ветке `agents/<slug>`. Интерактивный, а не `-p`:
  в панели виден живой TUI, можно подключиться (`tmux attach`) и рулить. Права сняты → воркер сам
  всё решает и не встаёт на модальные вопросы.
- **Пул** — `run.sh` держит до `CONCURRENCY` (дефолт 5) активных воркеров. Воркер сигналит о
  завершении, **трогая sentinel-файл последним действием** (это зашито в промпт); как только sentinel
  появился — слот свободен, стартует следующий. Сессия при этом остаётся открытой для осмотра/правки.
  Пайп-лог панели пишется в `logs/<slug>.log` (TUI при этом не ломается).

## Правила триажа

Берём все открытые issue, **кроме** тех, что владелец исключил (по умолчанию — тег `question`
и указанный milestone). Каждый work item воркер сам классифицирует:
- **Умещается в модель** → реализовать полностью (+ тесты, + методы Api extensions если надо) → draft-PR.
- **Эпик, но первая подфича умещается** → сделать первую подфичу + PR, остальное описать.
- **Слишком большое / ломает архитектуру / нужно решение владельца** → разбор комментарием в issue, стоп.

## Правила фичи (зашиты в `worker-prompt.template.md`)

1. Часто нужно дореализовать/раскомментировать методы Api extensions в `src/Extensions/**` (+ тесты).
2. Бинды и цвета — из VS Code, через настройки и цветовые палитры/темы, не хардкодом.
3. Неочевидное поведение — воспроизводим как в VS Code.
4. Нужны доп. контролы — бьём на подфичи, делаем минимум первую.
5. Конвенции репо: Conventional Commits, не чинить линтер, расширения в импортах, приватные без `_`,
   тесты по `docs/TESTING.md`. Воркер обязан прочитать `AGENTS.md`/`GOAL.md`/`docs/ARCHITECTURE.md`.

## Файлы скилла

- `run.sh` — пул-раннер (worktree + tmux + sentinels + refill).
- `make-prompt.sh` — рендер промпта воркера из `gh` + шаблона.
- `worker-prompt.template.md` — преамбул воркера (плейсхолдеры `{{BRANCH}}` `{{ISSUE_REFS}}`
  `{{TITLE}}` `{{ISSUE_NUMBER}}` `{{BODY}}` `{{SENTINEL}}`).

## Как запустить

```bash
SKILL=.claude/skills/issue-triage
TS=$(date +%Y%m%d-%H%M%S)
RUN_DIR="$(git rev-parse --show-toplevel)/../$(basename "$(git rev-parse --show-toplevel)").worktrees/.agent-runs/$TS"
mkdir -p "$RUN_DIR/queue"

# 1) Триаж: определить work items (issue-номера и slug'и), исключив question/нужный milestone:
gh issue list --state open --limit 200 \
  --json number,title,labels,milestone \
  --jq '.[] | select((.labels|map(.name)|index("question"))|not) | select(.milestone.number != 11) | "#\(.number)\t\(.title)"'

# 2) Сгенерировать очередь (по одному work item; группу — перечислив несколько issue):
RUN_DIR="$RUN_DIR" bash $SKILL/make-prompt.sh 01 dim-last-line 88
RUN_DIR="$RUN_DIR" bash $SKILL/make-prompt.sh 07 mouse-focus-menu-quickpick 91 92   # группа
# ... остальные work items ...

# 3) Запустить пул (в фоне / отдельном окне):
RUN_DIR="$RUN_DIR" CONCURRENCY=5 bash $SKILL/run.sh
```

## Наблюдение и итог

- `tmux list-windows -t vexx-agents` — активные воркеры (не более `CONCURRENCY`).
- `ls "$RUN_DIR"/sentinels` — завершённые; `"$RUN_DIR"/logs/<slug>.log` — вывод воркера.
- Итог по work item: `gh pr list --head agents/<slug>` (PR) либо `gh issue view <n> --comments` (разбор).
- Раннер печатает финальную сводку по exit-кодам, когда очередь пуста.

## Параметры (env)

`CONCURRENCY` (5), `POLL` (20с), `BASE_BRANCH` (main), `TMUX_SESSION` (vexx-agents), `RUN_DIR` (обяз.).
