#!/bin/sh
# Halation's hooks for Claude Code, written by halation init. Takes guard, lint or stop.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 2
input=$(cat)
run() {
  if [ -x node_modules/.bin/halation ]; then printf '%s' "$input" | node_modules/.bin/halation "$@"; return $?; fi
  if npx --no-install halation --version </dev/null >/dev/null 2>&1; then printf '%s' "$input" | npx --no-install halation "$@"; return $?; fi
  return 127
}
case "$1" in
  guard) run guard --hook ;;
  lint) run lint --hook ;;
  stop) run lint --stop ;;
  *) echo "hooks.sh takes guard, lint or stop." >&2; exit 2 ;;
esac
status=$?
[ "$status" -eq 0 ] && exit 0
[ "$status" -eq 2 ] && exit 2
# Halation isn't installed, or couldn't run.
case "$1" in
  guard)
    printf '%s' "$input" | grep -Eq '"command"[[:space:]]*:[[:space:]]*"(npm|pnpm|yarn|bun)[[:space:]]+(install|i|ci|add)([[:space:]"]|$)' && exit 0
    echo "Halation isn't installed in this project, or couldn't run, so changes are blocked until it can. Install the project's dependencies first, with npm install or your package manager's install." >&2
    exit 2 ;;
  stop)
    if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
      echo '{"systemMessage": "Halation is not installed or could not run, so the design rules were not checked before this turn ended."}'
      exit 0
    fi
    echo "Halation isn't installed or couldn't run, so the design rules can't be checked. Install the project's dependencies, then finish." >&2
    exit 2 ;;
  *)
    echo "Halation isn't installed or couldn't run, so this change wasn't linted. Install the project's dependencies." >&2
    exit 2 ;;
esac
