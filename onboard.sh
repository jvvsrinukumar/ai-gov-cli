#!/usr/bin/env bash
# =============================================================================
# ai-gov onboard — run once after cloning a governed project
#
# Usage (after cloning):
#   curl -s https://raw.githubusercontent.com/jvvsrinukumar/ai-gov-cli/main/onboard.sh | bash
#   # or download and run:
#   bash onboard.sh
#   # or from a specific directory:
#   bash onboard.sh --dir ./backend/api
#
# What this does:
#   1. Verifies .claude/ governance files are present (committed by team lead)
#   2. Checks python3 or jq is available for hook scripts
#   3. Installs .git/hooks/pre-commit and commit-msg wrappers (local only, not committed)
#   4. Verifies config.json is present
#   5. Prints a summary of what every commit will be checked for
#
# This script does NOT install ai-gov globally and does NOT regenerate
# any governance files. Those come from git (committed by the team lead).
# =============================================================================

set -euo pipefail

# --------------------------------------------------------------------------
# Colour helpers (gracefully degrade on terminals without colour support)
# --------------------------------------------------------------------------
if [ -t 1 ] && command -v tput &>/dev/null && tput colors &>/dev/null && [ "$(tput colors)" -ge 8 ]; then
    RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; RESET=''
fi

ok()   { printf "  ${GREEN}✓${RESET} %s\n" "$1"; }
fail() { printf "  ${RED}✗${RESET} %s\n" "$1"; [ -n "${2:-}" ] && printf "    ${YELLOW}Fix:${RESET} %s\n" "$2"; ISSUES=$((ISSUES+1)); }
warn() { printf "  ${YELLOW}⚠${RESET}  %s\n" "$1"; }
info() { printf "  %s\n" "$1"; }
header() { printf "\n${BOLD}${CYAN}%s${RESET}\n" "$1"; }

ISSUES=0

# --------------------------------------------------------------------------
# Parse --dir argument
# --------------------------------------------------------------------------
PROJECT_DIR="$(pwd)"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dir) PROJECT_DIR="$(cd "$2" && pwd)"; shift 2 ;;
        --dir=*) PROJECT_DIR="$(cd "${1#*=}" && pwd)"; shift ;;
        *) shift ;;
    esac
done

# --------------------------------------------------------------------------
# Header
# --------------------------------------------------------------------------
printf "\n${BOLD}${CYAN}============================================${RESET}\n"
printf "${BOLD}${CYAN} AI Governance — Developer Onboard${RESET}\n"
printf "${BOLD}${CYAN}============================================${RESET}\n"
printf "\n"
info "Project: $PROJECT_DIR"
printf "\n"

# --------------------------------------------------------------------------
# 1. Verify .claude/ exists (team lead must have initialised and committed it)
# --------------------------------------------------------------------------
CLAUDE_DIR="$PROJECT_DIR/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
    fail ".claude/ governance files not found" \
         "Ask your team lead to run: npx ai-gov init && git add .claude/ && git commit -m 'chore: add ai-gov governance'"
    printf "\n${RED}  Cannot continue — .claude/ is required.${RESET}\n\n"
    exit 1
fi
ok ".claude/ governance files present"

# --------------------------------------------------------------------------
# 2. Check git repository
# --------------------------------------------------------------------------
GIT_DIR="$PROJECT_DIR/.git"
if [ ! -d "$GIT_DIR" ]; then
    fail "Not a git repository" "Run: git init"
    printf "\n${RED}  Cannot install git hooks without a .git/ directory.${RESET}\n\n"
    exit 1
fi
ok ".git/ repository present"

# --------------------------------------------------------------------------
# 3. Check runtime availability for hook scripts (python3 preferred, jq fallback)
# --------------------------------------------------------------------------
PYTHON3_OK=false
JQ_OK=false
command -v python3 &>/dev/null && PYTHON3_OK=true
command -v jq      &>/dev/null && JQ_OK=true

if $PYTHON3_OK; then
    ok "python3 available — hook scripts will run"
elif $JQ_OK; then
    ok "jq available — hook scripts will run"
    warn "python3 not found — hooks fall back to jq (install python3 for best experience)"
else
    fail "Neither python3 nor jq is installed — governance hooks will NOT run"
    # Platform-specific install hint
    case "$(uname -s)" in
        Darwin)  warn "Fix: brew install python3" ;;
        Linux)   warn "Fix: sudo apt install python3  (Ubuntu/Debian)" ;;
        MINGW*|MSYS*|CYGWIN*) warn "Fix: winget install Python.Python.3  (then restart terminal)" ;;
        *)       warn "Fix: install python3 from https://python.org" ;;
    esac
fi

# --------------------------------------------------------------------------
# 4. Check bash availability (required by hook scripts on Windows Git Bash)
# --------------------------------------------------------------------------
if ! command -v bash &>/dev/null; then
    fail "bash not found — hook scripts will not run" \
         "Install Git Bash (Windows) or ensure bash is in PATH"
fi

# --------------------------------------------------------------------------
# 5. Install .git/hooks/ wrappers if not already present
# --------------------------------------------------------------------------
GIT_HOOKS_DIR="$GIT_DIR/hooks"
mkdir -p "$GIT_HOOKS_DIR"

PRE_COMMIT="$GIT_HOOKS_DIR/pre-commit"
COMMIT_MSG="$GIT_HOOKS_DIR/commit-msg"

install_wrapper() {
    local dest="$1"
    local content="$2"
    local name="$3"

    if [ -f "$dest" ]; then
        if grep -q "ai-gov" "$dest" 2>/dev/null; then
            ok "$name wrapper already installed"
            return
        else
            warn "$name exists but belongs to another tool — not overwriting"
            warn "  To integrate: add 'bash .claude/git-hooks/$(basename "$dest").sh${name_suffix:-}' to your existing hook"
            return
        fi
    fi

    printf '%s' "$content" > "$dest"
    chmod +x "$dest" 2>/dev/null || true   # silently ignore on Windows
    ok "$name wrapper installed"
}

# Use dirname-relative path — works on macOS, Linux, WSL2, and Windows Git Bash.
# $(git rev-parse --show-toplevel) returns C:\... on native Git Bash — breaks exec.
PRE_COMMIT_CONTENT='#!/usr/bin/env bash
# Installed by ai-gov onboard — calls .claude/git-hooks/pre-commit.sh
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/.claude/git-hooks/pre-commit.sh" "$@"
'

COMMIT_MSG_CONTENT='#!/usr/bin/env bash
# Installed by ai-gov onboard — calls .claude/git-hooks/commit-msg.sh
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/.claude/git-hooks/commit-msg.sh" "$1"
'

install_wrapper "$PRE_COMMIT" "$PRE_COMMIT_CONTENT" ".git/hooks/pre-commit"
install_wrapper "$COMMIT_MSG" "$COMMIT_MSG_CONTENT"  ".git/hooks/commit-msg"

# --------------------------------------------------------------------------
# 6. Check git-hooks scripts exist (committed by team lead)
# --------------------------------------------------------------------------
GIT_HOOKS_SCRIPTS="$CLAUDE_DIR/git-hooks"
if [ -d "$GIT_HOOKS_SCRIPTS" ]; then
    ok ".claude/git-hooks/ scripts present"
    # Verify they are executable
    if [ -f "$GIT_HOOKS_SCRIPTS/pre-commit.sh" ] && [ ! -x "$GIT_HOOKS_SCRIPTS/pre-commit.sh" ]; then
        chmod +x "$GIT_HOOKS_SCRIPTS"/*.sh 2>/dev/null || true
        [ -d "$GIT_HOOKS_SCRIPTS/checks" ] && chmod +x "$GIT_HOOKS_SCRIPTS/checks"/*.sh 2>/dev/null || true
        warn "Made .claude/git-hooks/*.sh executable (were missing execute bit)"
    fi
else
    warn ".claude/git-hooks/ not found — git commits will not be checked"
    warn "  Ask team lead to run: npx ai-gov init --git-hooks && git push"
fi

# --------------------------------------------------------------------------
# 7. Check config.json
# --------------------------------------------------------------------------
CONFIG_JSON="$CLAUDE_DIR/git-hooks/config.json"
if [ -f "$CONFIG_JSON" ]; then
    ok ".claude/git-hooks/config.json present"
else
    warn ".claude/git-hooks/config.json not found — hooks will use defaults"
fi

# --------------------------------------------------------------------------
# 8. Check Claude Code hooks
# --------------------------------------------------------------------------
HOOKS_DIR="$CLAUDE_DIR/hooks"
if [ -d "$HOOKS_DIR" ]; then
    HOOK_COUNT=$(find "$HOOKS_DIR" -name "*.sh" 2>/dev/null | wc -l | tr -d ' ')
    ok ".claude/hooks/ present ($HOOK_COUNT Claude Code hook scripts)"
else
    warn ".claude/hooks/ not found — Claude Code governance not active"
fi

# --------------------------------------------------------------------------
# Summary
# --------------------------------------------------------------------------
printf "\n"
if [ "$ISSUES" -eq 0 ]; then
    printf "${BOLD}${CYAN}============================================${RESET}\n"
    printf "${BOLD}${GREEN} Onboard complete — governance is active${RESET}\n"
    printf "${BOLD}${CYAN}============================================${RESET}\n\n"
    info "Every git commit will now be checked for:"
    info "  • Files over 300 lines (blocked)"
    info "  • Hardcoded secrets — AWS keys, tokens (blocked)"
    info "  • Commit message format — conventional commits (blocked)"
    info "  • TODO / FIXME / debug statements (warning only)"
    printf "\n"
    info "Claude Code hooks are already active — they are in .claude/hooks/"
    info "(committed to git, no setup needed for Claude Code hooks)"
    printf "\n"
    info "To bypass a single commit (use sparingly):"
    info "  git commit --no-verify -m \"your message\""
    printf "\n"
else
    printf "${BOLD}${RED}============================================${RESET}\n"
    printf "${BOLD}${RED} Onboard: $ISSUES issue(s) found${RESET}\n"
    printf "${BOLD}${RED}============================================${RESET}\n\n"
    info "Fix the issues above, then re-run:"
    info "  bash onboard.sh"
    printf "\n"
fi
