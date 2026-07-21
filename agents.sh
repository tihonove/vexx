#!/usr/bin/env bash
# Рубильник агентской машинерии. Всё поднимается и тушится отсюда.
#
# Сервер живёт в tmux-сессии, потому что cron и systemd в devcontainer недоступны,
# а tmux заодно даёт возможность подключиться и посмотреть живьём.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION="agents"
SERVER_WINDOW="server"
RUNS="$ROOT/.agents-runs"
LOG="$RUNS/daemon.log"
STOP="$RUNS/STOP"

cd "$ROOT"
mkdir -p "$RUNS"

config_port() {
    (cd agents && node -e "const{parse}=require('jsonc-parser');const fs=require('fs');process.stdout.write(String(parse(fs.readFileSync('config.jsonc','utf8')).ports?.$1??$2))") 2>/dev/null || echo "$2"
}
dashboard_port() { config_port dashboard 7777; }

usage() {
    cat <<'EOF'
Использование: ./agents.sh <команда>

  start           поднять сервер в tmux-сессии "agents" (идемпотентно)
  start --paused  поднять сервер, но не запускать роли по расписанию
  stop            мягко: поставить STOP — по расписанию ничего не запускается
  stop --now      жёстко: остановить сервер и всех агентов (разговоры сохраняются)
  restart         перезапустить только сервер — агенты продолжают работать
  status          состояние сервера и агентов
  logs            tail -f лога сервера
  attach          подключиться к серверу (tmux)
  watch <ключ>    подключиться к живому агенту и договорить с ним руками

  run <роль> [аргумент]     форграунд, живой диалог — отладка скилла руками
  spawn <роль> [аргумент]   фоном, как по расписанию
  wake <роль> <аргумент>    синоним spawn: тот же ключ → продолжение той же сессии
  list                      живые агенты
  stop-agent <ключ>         остановить одного агента
  tick                      запустить роль orchestrate прямо сейчас

Повторный запуск с тем же аргументом НЕ создаёт нового агента, а продолжает
разговор с прежним — так его и зовут обратно после ревью.
EOF
}

# Наши агенты — и только они: окна нашей tmux-сессии, кроме окна сервера.
# Разговоры человека живут в других сессиях и сюда не попадают по построению.
agent_windows() {
    tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -vx "$SERVER_WINDOW" || true
}

SERVER_CMD="cd '$ROOT/agents' && npx tsx src/server.ts 2>&1 | tee -a '$LOG'"

server_running() {
    tmux list-windows -t "$SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$SERVER_WINDOW"
}

# --paused: поднять серверы (MCP + витрину), но не запускать роли по расписанию.
# Нужно, когда запуски хочется делать руками и видеть их целиком.
apply_pause() {
    if [ "${1:-}" = "--paused" ]; then
        touch "$STOP"
    else
        rm -f "$STOP"
    fi
}

cmd_start() {
    [ -d agents/node_modules ] || (cd agents && npm install)
    apply_pause "${1:-}"

    if server_running; then
        echo "Сервер уже поднят. Два планировщика = двойные запуски, так что второй не поднимаю."
        [ -f "$STOP" ] && echo "режим: STOP" || echo "режим: работает по расписанию"
        return 0
    fi

    # Сервер — окно "server"; агенты живут соседними окнами той же сессии,
    # и tmux сам оказывается реестром: имя окна = ключ агента.
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        tmux new-window -d -t "$SESSION" -n "$SERVER_WINDOW" -c "$ROOT" "$SERVER_CMD"
    else
        tmux new-session -d -s "$SESSION" -n "$SERVER_WINDOW" -c "$ROOT" "$SERVER_CMD"
    fi
    echo "Сервер поднят. Витрина: http://localhost:$(dashboard_port)"
}

# Рестарт трогает ТОЛЬКО окно сервера. Агенты — соседние окна, и терять их незачем:
# сервер не владеет их состоянием, он выводит его из мира заново (окна tmux, claude
# agents --json, git). Поэтому его перезапуск для агентов вообще незаметен.
cmd_restart() {
    apply_pause "${1:-}"
    if ! server_running; then
        cmd_start "${1:-}"
        return 0
    fi
    tmux respawn-window -k -c "$ROOT" -t "$SESSION:$SERVER_WINDOW" "$SERVER_CMD"
    local kept
    kept="$(agent_windows | wc -l)"
    echo "Сервер перезапущен. Агентов не тронуто: $kept"
}

cmd_stop() {
    if [ "${1:-}" = "--now" ]; then
        for name in $(agent_windows); do
            echo "останавливаю агента $name"
            tmux kill-window -t "$SESSION:$name" || true
        done
        tmux kill-session -t "$SESSION" 2>/dev/null || true
        echo "Сервер и агенты остановлены."
        return 0
    fi
    touch "$STOP"
    echo "STOP поставлен: по расписанию ничего не запускается."
    echo "Снять — ./agents.sh start, или кнопкой на витрине."
}

cmd_status() {
    if tmux has-session -t "$SESSION" 2>/dev/null; then
        echo "сервер: работает (tmux: $SESSION)"
    else
        echo "сервер: не запущен"
    fi
    [ -f "$STOP" ] && echo "режим: STOP" || echo "режим: работает по расписанию"
    echo
    curl -s "http://127.0.0.1:$(dashboard_port)/api/state" | node -e '
        let raw = ""; process.stdin.on("data", c => raw += c).on("end", () => {
            if (!raw) { console.log("витрина не отвечает"); return; }
            const s = JSON.parse(raw);
            console.log("роли: " + s.roles.map(r => r.name + (r.everyMin ? ` (раз в ${r.everyMin}м)` : "")).join(", "));
            if (s.running.length) console.log("сейчас выполняются: " + s.running.join(", "));
            if (!s.agents.length) { console.log("агентов нет"); return; }
            for (const a of s.agents)
                console.log(`  ${a.key}  ${a.status}${a.state ? "/" + a.state : ""}  idle ${a.idleMin ?? "—"}м  ${a.alive ? "" : "МЁРТВ"}`);
        });
    ' || true
}

# Запуск роли немедленно — через витрину, чтобы он прошёл тем же путём, что и по расписанию
# (и попал в журнал с trigger: dashboard). Сервер не поднят — говорим прямо.
cmd_tick() {
    local role="${1:-orchestrate}"
    tmux has-session -t "$SESSION" 2>/dev/null || { echo "Сервер не поднят: ./agents.sh start --paused"; exit 1; }
    curl -sS -X POST "http://127.0.0.1:$(dashboard_port)/api/run?role=$role" && echo
}

case "${1:-}" in
    start)   shift; cmd_start "$@" ;;
    stop)    shift; cmd_stop "$@" ;;
    restart) shift; cmd_restart "$@" ;;
    status)  cmd_status ;;
    logs)    touch "$LOG"; tail -f "$LOG" ;;
    attach)  tmux attach -t "$SESSION:$SERVER_WINDOW" ;;
    watch)   shift; [ -n "${1:-}" ] || { echo "Использование: ./agents.sh watch <ключ агента>"; exit 2; }
             tmux attach -t "$SESSION:$1" ;;
    tick)    shift; cmd_tick "$@" ;;
    run|spawn|wake|list|stop-agent) (cd agents && npx tsx src/cli.ts "$@") ;;
    ""|-h|--help) usage ;;
    *)       echo "Неизвестная команда: $1"; echo; usage; exit 2 ;;
esac
