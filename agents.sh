#!/usr/bin/env bash
# Рубильник агентской машинерии. Всё поднимается и тушится отсюда.
#
# Демон живёт в tmux-сессии, потому что cron и systemd в devcontainer недоступны,
# а tmux заодно даёт возможность подключиться и посмотреть живьём.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION="agents"
RUNS="$ROOT/.agents-runs"
LOG="$RUNS/daemon.log"
STOP="$RUNS/STOP"

cd "$ROOT"
mkdir -p "$RUNS"

dashboard_port() {
    (cd agents && node -e "const{parse}=require('jsonc-parser');const fs=require('fs');process.stdout.write(String(parse(fs.readFileSync('config.jsonc','utf8')).ports?.dashboard??7777))") 2>/dev/null || echo 7777
}

usage() {
    cat <<'EOF'
Использование: ./agents.sh <команда>

  start           поднять демон в tmux-сессии "agents" (идемпотентно)
  start --paused  поднять серверы, но не тикать по расписанию — тики руками
  stop            мягко: поставить STOP — новые задачи не раздаются
  stop --now      жёстко: остановить демон и всех агентов (диалоги агентов сохраняются)
  restart         перезапустить демон (агенты не пострадают)
  status          состояние демона и агентов
  logs            tail -f лога демона
  attach          подключиться к tmux-сессии демона
  tick            запустить тик прямо сейчас
  run <роль> <номер>         прогнать один скилл в форграунде (run implement 136)
  run orchestrate            один тик оркестратора, видно всё
EOF
}

# Наши агенты — и только они: фоновые сессии внутри .claude/worktrees.
# Интерактивные сессии (ваши разговоры) не трогаем никогда.
managed_agent_ids() {
    claude agents --json 2>/dev/null |
        node -e '
            let raw = ""; process.stdin.on("data", c => raw += c).on("end", () => {
                const prefix = process.argv[1] + "/.claude/worktrees/";
                for (const s of JSON.parse(raw || "[]"))
                    if (s.kind === "background" && s.cwd.startsWith(prefix) && s.id) console.log(s.id);
            });
        ' "$ROOT"
}

cmd_start() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "Демон уже поднят (tmux: $SESSION). Два тикера = двойные спавны, так что ничего не делаю."
        return 0
    fi
    [ -d agents/node_modules ] || (cd agents && npm install)
    # --paused: поднять только серверы (MCP + витрину), но не тикать по расписанию.
    # Нужно, когда тики хочется запускать руками и видеть их целиком.
    if [ "${1:-}" = "--paused" ]; then
        touch "$STOP"
    else
        rm -f "$STOP"
    fi
    tmux new-session -d -s "$SESSION" -c "$ROOT" \
        "cd '$ROOT/agents' && npx tsx src/daemon.ts 2>&1 | tee -a '$LOG'"
    echo "Демон поднят. Витрина: http://localhost:$(dashboard_port)"
}

cmd_stop() {
    if [ "${1:-}" = "--now" ]; then
        for id in $(managed_agent_ids); do
            echo "останавливаю агента $id"
            claude stop "$id" || true
        done
        tmux kill-session -t "$SESSION" 2>/dev/null || true
        echo "Демон и агенты остановлены."
        return 0
    fi
    touch "$STOP"
    echo "STOP поставлен: демон дорабатывает текущий тик и больше не раздаёт задачи."
    echo "Снять — ./agents.sh start, или кнопкой на витрине."
}

cmd_status() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "демон: работает (tmux: $SESSION)"
    else
        echo "демон: не запущен"
    fi
    [ -f "$STOP" ] && echo "режим: STOP" || echo "режим: раздаёт задачи"
    echo
    curl -s "http://127.0.0.1:$(dashboard_port)/api/state" | node -e '
        let raw = ""; process.stdin.on("data", c => raw += c).on("end", () => {
            if (!raw) { console.log("витрина не отвечает"); return; }
            const s = JSON.parse(raw);
            console.log(`dry-run: ${s.dryRun} · тик идёт: ${s.ticking} · последний: ${s.lastTickAt ?? "—"}`);
            if (!s.agents.length) { console.log("агентов нет"); return; }
            for (const a of s.agents)
                console.log(`  ${a.name}  ${a.status}${a.state ? "/" + a.state : ""}  idle ${a.idleMin ?? "—"}м  ${a.alive ? "" : "МЁРТВ"}`);
        });
    ' || true
}

case "${1:-}" in
    start)   shift; cmd_start "$@" ;;
    stop)    shift; cmd_stop "$@" ;;
    restart) shift; tmux kill-session -t "$SESSION" 2>/dev/null || true; cmd_start "$@" ;;
    status)  cmd_status ;;
    logs)    touch "$LOG"; tail -f "$LOG" ;;
    attach)  tmux attach -t "$SESSION" ;;
    tick)    curl -sS -X POST "http://127.0.0.1:$(dashboard_port)/api/tick" && echo ;;
    run)     shift; (cd agents && npx tsx src/run.ts "$@") ;;
    ""|-h|--help) usage ;;
    *)       echo "Неизвестная команда: $1"; echo; usage; exit 2 ;;
esac
