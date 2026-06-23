#!/usr/bin/env bash
# ─── gh-pr.sh ───────────────────────────────────────────────────────────────
# One command to branch, commit, push, and open (or update) a GitHub pull
# request — without needing the `gh` CLI, `jq`, or `python` (none installed
# here). It talks to the GitHub REST API directly, authenticating with the
# token already stored by Git (`git credential fill`), and builds the JSON
# payload with a Perl escaper run from this file's bytes — which sidesteps the
# shell-quoting mangling that bites inline `perl -pe '...'` / hand-rolled JSON.
#
# This repo's quirk: the default/trunk branch is `Game1` (NOT `main`, which is
# an unrelated orphan). PRs target `Game1` as the base by default.
#
# Usage:
#   bash .claude/gh-pr.sh --title "My title" [--body-file body.md] [options]
#
#   --title       PR title (required; also the default commit message)
#   --body-file   markdown file with the PR body (optional)
#   --base        base branch to merge into (default: Game1)
#   --branch      feature-branch name to create when starting from base
#                 (default: derived as claude/<slug-of-title>)
#   -m, --message commit message (default: the title)
#   --all         stage untracked files too (default: tracked changes only)
#   --no-commit   don't auto-commit; PR whatever is already committed
#   --no-pr       branch, commit, and push only — skip creating the PR
#   -h, --help    show this help
#
# Behavior:
#   * If you're on the base branch, a feature branch is created first (your
#     working-tree changes come with it) so the trunk stays clean.
#   * Uncommitted changes are committed (respecting anything you pre-staged;
#     otherwise tracked changes are staged for you). A Co-Authored-By trailer
#     is appended.
#   * The branch is pushed, then the PR is created — or, if one already exists
#     for this branch, its title/body are updated (re-run any time to revise).
#   * Prints the PR URL.
set -uo pipefail

TITLE=""
BODY_FILE=""
BASE="Game1"
BRANCH=""
MESSAGE=""
ALL=0
NO_COMMIT=0
NO_PR=0

die() { echo "gh-pr: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --title)       TITLE="${2:-}"; shift 2;;
    --body-file)   BODY_FILE="${2:-}"; shift 2;;
    --base)        BASE="${2:-}"; shift 2;;
    --branch)      BRANCH="${2:-}"; shift 2;;
    -m|--message)  MESSAGE="${2:-}"; shift 2;;
    --all)         ALL=1; shift;;
    --no-commit)   NO_COMMIT=1; shift;;
    --no-pr)       NO_PR=1; shift;;
    --push)        shift;;   # accepted for back-compat; push is automatic now
    -h|--help)     grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) die "unknown arg: $1";;
  esac
done

[ -n "$TITLE" ] || die "missing --title"
if [ -n "$BODY_FILE" ] && [ ! -f "$BODY_FILE" ]; then die "body file not found: $BODY_FILE"; fi

git rev-parse --git-dir >/dev/null 2>&1 || die "not in a git repo"
HEAD="$(git rev-parse --abbrev-ref HEAD)"
[ "$HEAD" != "HEAD" ] || die "detached HEAD — check out a branch first"

# Parse owner/repo from the origin URL (https or ssh form).
REMOTE_URL="$(git remote get-url origin)" || die "no 'origin' remote"
SLUG="$(printf '%s' "$REMOTE_URL" | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
OWNER="${SLUG%%/*}"
REPO="${SLUG##*/}"
[ -n "$OWNER" ] && [ -n "$REPO" ] || die "could not parse owner/repo from: $REMOTE_URL"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-40 | sed -E 's/-+$//'
}

# Are there changes worth committing?
has_changes() {
  if [ "$ALL" -eq 1 ]; then
    [ -n "$(git status --porcelain)" ]
  else
    ! git diff --quiet || ! git diff --cached --quiet
  fi
}

# ── Branch: if we're on the base branch, move onto a feature branch ──────────
if [ "$HEAD" = "$BASE" ]; then
  if [ "$NO_COMMIT" -eq 0 ] && ! has_changes; then
    die "on base '$BASE' with no changes — make edits first, or use --no-commit"
  fi
  if [ -z "$BRANCH" ]; then
    BRANCH="claude/$(slugify "$TITLE")"
    [ "$BRANCH" = "claude/" ] && BRANCH="claude/pr-$(date +%s)"
  fi
  echo "gh-pr: branching $BASE -> $BRANCH" >&2
  if ! git checkout -b "$BRANCH" 2>/dev/null; then
    git checkout "$BRANCH" 2>/dev/null || die "could not create or switch to $BRANCH (uncommitted conflicts?)"
  fi
  HEAD="$(git rev-parse --abbrev-ref HEAD)"
else
  BRANCH="$HEAD"
fi

# ── Commit: stage (respecting a pre-staged index) and commit ─────────────────
if [ "$NO_COMMIT" -eq 0 ] && has_changes; then
  if git diff --cached --quiet; then        # nothing pre-staged → stage for them
    if [ "$ALL" -eq 1 ]; then git add -A; else git add -u; fi
  fi
  if ! git diff --cached --quiet; then       # something is staged → commit it
    MSG="${MESSAGE:-$TITLE}"
    {
      printf '%s\n' "$MSG"
      printf '%s' "$MSG" | grep -qi 'Co-Authored-By: Claude' \
        || printf '\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>\n'
    } > "$TMP/commitmsg"
    echo "gh-pr: committing staged changes" >&2
    git commit -F "$TMP/commitmsg" >&2 || die "commit failed"
  fi
fi

# ── Guard against an empty PR ────────────────────────────────────────────────
BASE_REF="$BASE"
git rev-parse --verify --quiet "origin/$BASE" >/dev/null 2>&1 && BASE_REF="origin/$BASE"
AHEAD="$(git rev-list --count "$BASE_REF..HEAD" 2>/dev/null || echo 0)"
[ "${AHEAD:-0}" -gt 0 ] || die "no commits ahead of $BASE_REF — nothing to put in a PR"

# ── Push ─────────────────────────────────────────────────────────────────────
echo "gh-pr: pushing $BRANCH -> origin" >&2
git push -u origin "$BRANCH" >&2 || die "push failed"

if [ "$NO_PR" -eq 1 ]; then
  echo "Branch pushed (no PR): $BRANCH -> $BASE"
  exit 0
fi

# ── Create or update the PR via the REST API ─────────────────────────────────
TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | sed -n 's/^password=//p')"
[ -n "$TOKEN" ] || die "no token from 'git credential fill' (host=github.com)"

# JSON-string escaper. Single-quoted so the shell hands the backslashes to Perl
# verbatim; reading from disk means no transport mangling.
esc_json() {
  perl -e 'local $/; my $s=<STDIN>; $s=~s/\\/\\\\/g; $s=~s/"/\\"/g; $s=~s/\r//g; $s=~s/\n/\\n/g; $s=~s/\t/\\t/g; print $s;'
}

ESC_TITLE="$(printf '%s' "$TITLE" | esc_json)"
if [ -n "$BODY_FILE" ]; then ESC_BODY="$(esc_json < "$BODY_FILE")"; else ESC_BODY=""; fi

API="https://api.github.com/repos/$OWNER/$REPO"
AUTH=(-H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

HEAD_Q="$(printf '%s' "$BRANCH" | sed 's#/#%2F#g')"
curl -s "${AUTH[@]}" "$API/pulls?head=$OWNER:$HEAD_Q&base=$BASE&state=open" > "$TMP/list.json"
NUM="$(grep -o '"number"[[:space:]]*:[[:space:]]*[0-9]*' "$TMP/list.json" | head -1 | grep -o '[0-9]*$')"

if [ -n "$NUM" ]; then
  printf '{"title":"%s","body":"%s"}' "$ESC_TITLE" "$ESC_BODY" > "$TMP/payload.json"
  HTTP="$(curl -s -o "$TMP/resp.json" -w '%{http_code}' -X PATCH "${AUTH[@]}" \
    "$API/pulls/$NUM" -d @"$TMP/payload.json")"
  ACTION="updated"
else
  printf '{"title":"%s","body":"%s","base":"%s","head":"%s"}' \
    "$ESC_TITLE" "$ESC_BODY" "$BASE" "$BRANCH" > "$TMP/payload.json"
  HTTP="$(curl -s -o "$TMP/resp.json" -w '%{http_code}' -X POST "${AUTH[@]}" \
    "$API/pulls" -d @"$TMP/payload.json")"
  ACTION="created"
fi

URL="$(grep -o '"html_url"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMP/resp.json" | head -1 | sed -E 's/.*"(https[^"]*)".*/\1/')"
if [ "$HTTP" = "200" ] || [ "$HTTP" = "201" ]; then
  echo "PR $ACTION ($BRANCH -> $BASE): $URL"
  exit 0
fi

echo "gh-pr: API call failed (HTTP $HTTP)" >&2
head -c 800 "$TMP/resp.json" >&2
echo >&2
exit 1
