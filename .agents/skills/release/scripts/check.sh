#!/usr/bin/env bash
# Checks that a release-please release PR carries rewritten notes that
# release-please can still read. Used by the release skill and by the
# `release-notes` job in .github/workflows/ci.yml.
#
#   check.sh <pr number> [owner/repo]
set -euo pipefail

pr=${1:?usage: check.sh <pr number> [owner/repo]}
repo=${2:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
marker='docs(changelog): '
failed=0

fail() {
  echo "✗ $1"
  failed=1
}

pass() {
  echo "✓ $1"
}

trim() {
  awk '{ sub(/[[:space:]]+$/, ""); line[NR] = $0; if ($0 != "") { if (!first) first = NR; last = NR } }
       END { if (first) for (i = first; i <= last; i++) print line[i] }'
}

field() {
  gh api "repos/$repo/pulls/$pr" -q "$1"
}

title=$(field .title)
branch=$(field .head.ref)
sha=$(field .head.sha)
labels=$(field '[.labels[].name] | join(",")')
body=$(field .body | tr -d '\r')

version=$(sed -nE 's/.*release .*([0-9]+\.[0-9]+\.[0-9]+[^ ]*)$/\1/p' <<<"$title")

if [[ $branch == release-please--* && -n $version ]]; then
  pass "release PR for $version"
else
  fail "not a release PR: branch '$branch', title '$title'"
  exit 1
fi

if [[ ",$labels," == *",autorelease: pending,"* ]]; then
  pass "label 'autorelease: pending' is set"
else
  fail "label 'autorelease: pending' is missing, release-please would not tag this PR"
fi

delimiters=$(grep -c '^---$' <<<"$body" || true)

if [[ $delimiters == 2 ]]; then
  pass "body has its two --- lines"
else
  fail "body has $delimiters lines that are exactly ---, release-please needs two (no horizontal rule inside the notes)"
fi

notes=$(awk '/^---$/ { part++; next } part == 1' <<<"$body" | trim)
heading=$(head -n 1 <<<"$notes")

if [[ $heading == "## [$version]("* ]]; then
  pass "notes start with the version heading"
else
  fail "notes must start with '## [$version](…) (date)', found '$heading'"
fi

entry=$(gh api -H "Accept: application/vnd.github.raw" "repos/$repo/contents/CHANGELOG.md?ref=$sha" |
  tr -d '\r' | awk '/^## \[?[0-9]/ { part++ } part == 1' | trim)

if [[ $notes == "$entry" ]]; then
  pass "CHANGELOG.md entry and PR body carry the same notes"
else
  fail "the top entry of CHANGELOG.md on $branch differs from the notes in the PR body:"
  diff <(echo "$entry") <(echo "$notes") || true
fi

subject=$(gh api "repos/$repo/commits/$sha" -q .commit.message | head -n 1)

if [[ $subject == "$marker"* ]]; then
  pass "notes were rewritten ($subject)"
else
  fail "notes are as release-please generated them (top commit: '$subject'); run the release skill"
fi

exit $failed
