/**
 * Shared predicates over the process environment, used by both the terminal
 * backend and the terminal-environment detector. Single source of truth so the
 * two layers can't disagree about "are we in tmux / over ssh".
 */

/** True when running inside a TMUX session. */
export function isInsideTmux(env: NodeJS.ProcessEnv = process.env): boolean {
    return env.TMUX != null && env.TMUX !== "";
}

/** True when the session is reached over SSH. */
export function isSsh(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env.SSH_CONNECTION != null && env.SSH_CONNECTION !== "") || (env.SSH_TTY != null && env.SSH_TTY !== "");
}
