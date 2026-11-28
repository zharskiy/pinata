---
name: release
description: Release the project end to end from the open release-please release PR: rewrite its generated changelog entry so that it reads well for people who use the project, merge the PR, and see the version through to the npm registry. Use whenever the user types /release or asks to release, publish, ship or cut a version, or to merge the release PR; this skill is the only way that PR gets merged, and CI blocks the merge until the notes are rewritten. Use it too, stopping before the merge, when the user only asks to prepare, polish, clean up or rewrite the changelog or release notes, complains that the changelog is a list of commit subjects, has duplicates or is hard to read, or asks what the next release contains in plain words, and when they ask to fix the wording of an already published changelog entry or GitHub release.
---

# Release

release-please builds the changelog from commit subjects. That is a complete inventory of what went in, and a poor text for the person deciding whether to upgrade: PRs are merged with merge commits, so a PR's title is listed next to the commits it contains, a fix to a feature that was never released is listed as a bug fix, and each line says what a developer did, not what a user gets. This skill turns that inventory into notes for users, once per release, and then releases: asked to release, it runs from the first step to the published package without stopping for the user, who is not expected to open GitHub at all.

It exists so that nobody has to craft history for the changelog's sake. Commits stay as they were pushed; the wording is fixed here, at the end.

## How release-please treats a hand edit

Three facts decide the whole procedure.

- **The GitHub release is the PR body.** When the release PR is merged, release-please takes the text between the two `---` lines of the PR body as the release notes. It does not read `CHANGELOG.md` for that. `CHANGELOG.md` on the release branch is what lands on `main`. So the rewrite goes into both, with the same text.
- **A push to `main` throws the rewrite away.** On every push to `main` release-please regenerates the entry from the commits, force-pushes the release branch and replaces the PR body. There is no supported way to protect an edit. So the rewrite is the last thing before the merge, and if `main` moves in between it is done again.
- **The version does not come from the notes.** It comes from the commit types and is already in the PR title and the version files. Rewording, merging or dropping lines cannot change which version is released.

## It runs from wherever the user is

The user types `/release` on whatever branch they happen to be working, often with uncommitted changes. Nothing here depends on that branch or changes it:

- Everything is read from `origin/main`, the tags and GitHub, and written through the GitHub API. Never switch, check out, stash, pull, merge or commit locally, and leave the working tree exactly as it was found.
- The working tree may be an old or unrelated branch, so do not read the project's files from it. Read a file as `main` has it: `git show origin/main:<path>`.
- The same goes for this skill. After `git fetch origin main --tags`, if `git show origin/main:.agents/skills/release/SKILL.md` differs from the copy being followed, follow the one on `main`, and run its check script (step 5) the same way. A release is always made by the procedure on `main`, not by the one a stale branch carries.

## 1. Find the release PR and check that it is current

```sh
git fetch origin main --tags && git rev-parse origin/main
gh pr list --label "autorelease: pending" --state open --json number,title,headRefName,url
gh run list --workflow release.yml --branch main --limit 1 --json status,conclusion,headSha
```

The release PR is the open one release-please labelled `autorelease: pending`, titled `chore(main): release X.Y.Z`; the user does not name it. If there is none once the `release` run for the head of `main` has finished, nothing releasable has been merged since the last tag: say so, with the last tag and the commits since it, and stop. The newest `release` run must be finished and must be for the head of `main`: while it is running, or when `main` has commits it has not seen, release-please is about to regenerate the PR and would overwrite the rewrite. Wait for it.

If the top commit of the release branch is not release-please's own (`gh pr view <n> --json commits`), the entry was already rewritten. Do it again only when the user asks; otherwise show what is there.

## 2. Collect the inventory and what stands behind it

The generated entry is the inventory. Save it before changing anything, because the final report maps every one of its lines to what became of it:

```sh
gh pr view <n> --json body -q .body > "$TMP/body.before.md"
```

Then find out what each line means for a user. The subjects alone are rarely enough.

```sh
last=$(git describe --tags --abbrev=0 origin/main)
git log --first-parent --format='%h %s' "$last"..origin/main      # one line per merged PR, plus direct commits
git log --format='%h %s%n%b' <merge>^1..<merge>^2                 # the commits of one PR, with their bodies
gh pr view <pr> --json title,body                                  # <pr> is the number in "Merge pull request #<pr>"
```

Commit bodies and PR descriptions say why a change was made. For the exact name of a command, flag, setting or file the user types, read the docs the change touched (`git diff "$last"..origin/main --stat -- '*.md'`, then the relevant hunks or `git show origin/main:<path>`): in this repository a code change always comes with its docs, so the user-facing wording is usually already there.

## 3. Rewrite

Write for someone who uses the project and has never seen its source. They scan the entry to answer three questions: does anything break for me, what can I do now that I could not, and is the bug I hit gone.

**Shape.** Keep the frame release-please produced, so that old and new entries look like one file and its parser still recognises the entry:

```markdown
## [X.Y.Z](compare link) (date)

### ⚠ BREAKING CHANGES

* **scope:** What changed and what the user has to do now ([1a2b3c4](commit link))

### Features

* **scope:** What the user can do now ([5d6e7f8](commit link))

### Bug Fixes

* **scope:** What no longer goes wrong ([9a8b7c6](commit link), [0f1e2d3](commit link))
```

- The `## [X.Y.Z](…) (date)` line stays exactly as generated and stays the first line of the notes.
- Sections in that order, with release-please's own headings, plus `### Performance Improvements` and `### Reverts` when the generated entry has them. A section without bullets is left out.
- One bullet is one change as the user sees it, in one sentence, starting with a capital letter, without a full stop. Keep the bold scope: it tells the reader which extension or part is concerned. Put bullets of the same scope next to each other, the most important first.
- Each bullet keeps the commit links release-please generated, copied as they are. A bullet that merges several lines carries the links of all of them, except that a merge commit's link goes when its PR's own commits are already linked. No PR links are added.
- A release with a clear theme, or one that asks the user to do something on upgrade, may open with one or two plain sentences directly under the version line. Most releases need none.

**What to do with each generated line.**

- *Duplicate.* A merge commit repeats its PR's title, so the same change shows up twice, or once as a summary ("remove X, apply Y, raise Z") and again piece by piece. Keep the pieces when each is a change a user would look for, keep the summary when the pieces are steps of one change. Never both.
- *Fix to something new in this release.* If the bug was introduced after the last tag, no user ever had it. Fold the fix into the feature's bullet, which then describes the feature as it ships. `### Bug Fixes` is for bugs that were in a released version. `git tag --contains <sha of the commit that introduced it>` printing nothing means it was never released.
- *Several commits, one change.* Steps of one feature become one bullet.
- *Added and reverted, or added and removed again, within this release.* Both go.
- *Typed `feat` or `fix` but invisible to users* (an internal rename, a test helper, a refactor). Drop it. The version it bumped stays, and that is fine.
- *Everything else.* Reword it.

**Wording.**

- Say what the user gets, not what the code does. A feature: what they can do now and with which command, flag or setting. A fix: the symptom that is gone, in the terms of someone who met it ("`tool install` no longer needs sudo to finish", not "fix permission handling in the installer").
- Name what the user types or sees in backticks. Anything with angle brackets goes in backticks too, or Markdown swallows it as HTML.
- No function, file, class or test names, and no words that exist only inside the code base, unless the user configures or types them.
- Do not oversell and do not invent. Every bullet traces back to lines of the generated entry, and nothing is added that release-please left out (`docs`, `refactor`, `chore` and the like are hidden on purpose). When the sources do not tell what a commit means for a user, keep close to its subject instead of guessing.
- Breaking changes are never dropped, merged away or softened. Each one says what stops working and what to do instead. If the PR title announces a major version, the entry has this section; if a breaking note seems wrong, tell the user instead of removing it.

**Example.** Generated:

```markdown
### Features

* **cli:** add sync --dry-run ([1a2b3c4](…))
* **cli:** add sync --dry-run and a progress line ([5d6e7f8](…))
* **cli:** print a progress line while syncing ([9a8b7c6](…))
* **cache:** move the cache index to sqlite ([0f1e2d3](…))

### Bug Fixes

* **cli:** do not print the progress line when stdout is not a terminal ([4c5b6a7](…))
* **cache:** stop a full disk from corrupting the cache ([7e8f9a0](…))
```

Rewritten:

```markdown
### Features

* **cli:** `sync --dry-run` lists what a sync would change without changing it ([1a2b3c4](…))
* **cli:** `sync` shows its progress on one line when run in a terminal ([9a8b7c6](…), [4c5b6a7](…))

### Bug Fixes

* **cache:** A full disk no longer corrupts the cache; the write is abandoned and the previous cache stays usable ([7e8f9a0](…))
```

The second line was the merge commit of the PR that holds the first and third. The progress fix repaired a feature that is new in this release, so it became part of that feature's bullet. The sqlite move changed nothing a user can see.

## 4. Write it to both places

Build two files in a temp directory outside the repository: the new PR body and the new `CHANGELOG.md`.

**PR body.** Take the saved body and replace only what lies between the first and the last line that is exactly `---`. The text before the first one and after the last one stays untouched, and no line inside the notes may be exactly `---` (no horizontal rules), because the last such line is where release-please stops reading.

**`CHANGELOG.md`.** Take the file from the release branch and replace only the top entry, from its `## [X.Y.Z]` line up to the next `## [` line, with the same notes. Older entries are not touched.

```sh
branch=<headRefName>
gh api "repos/{owner}/{repo}/contents/CHANGELOG.md?ref=$branch" -q .content | base64 --decode > "$TMP/CHANGELOG.md"
blob=$(gh api "repos/{owner}/{repo}/contents/CHANGELOG.md?ref=$branch" -q .sha)
# edit $TMP/CHANGELOG.md and write $TMP/body.md, then:
gh pr edit <n> --body-file "$TMP/body.md"
gh api -X PUT "repos/{owner}/{repo}/contents/CHANGELOG.md" \
  -f branch="$branch" -f sha="$blob" \
  -f message="docs(changelog): rewrite the X.Y.Z entry for readers" \
  -f content="$(base64 < "$TMP/CHANGELOG.md" | tr -d '\n')"
```

The body goes first: the commit starts the CI run that compares the two, and it reads the body as it is at that moment. The contents API commits straight onto the release branch, so the local checkout and whatever branch the user is on stay as they are. The commit subject starts with `docs(changelog): ` for two reasons: release-please leaves the `docs` type out of the next changelog, and that prefix on the branch's top commit is how CI recognises a rewritten release PR. Nothing else on that branch is changed: not the version files, not `.release-please-manifest.json`, and neither the PR's title, its `autorelease: pending` label nor its branch name, since release-please finds the merged PR and its version through them.

Apply the rewrite without asking first: GitHub keeps the body's edit history, and until the merge release-please can regenerate the original.

## 5. Check that release-please can still read it

```sh
git show origin/main:.agents/skills/release/scripts/check.sh | bash -s -- <n>
```

(`main`'s copy, so that a stale branch does not check by old rules; when `main` has none yet, run the file next to this skill.)

The script checks what release-please needs and what CI enforces: the branch and the `autorelease: pending` label, exactly two `---` lines in the body, the unchanged `## [X.Y.Z](…)` line as the first line of the notes, the same notes in the body and in the top entry of `CHANGELOG.md` on the branch, and the `docs(changelog): ` commit on top. Fix what it reports and run it again until every line passes.

Two things it cannot check are yours:

- `gh pr view <n> --json files` lists the same files as before, and a diff of the old and new `CHANGELOG.md` touches the top entry only.
- Every line of the saved inventory is accounted for: kept, merged into a named bullet, or dropped for a stated reason.

## 6. Go on, or stop for the notes

What the user asked for decides.

- **Asked to release** (`/release`, "publish", "ship it", "merge the release PR"): that request is the word to publish. Go straight on to step 7 and give the report at the end. Do not stop to show the notes or to ask for a confirmation; the user chose not to be in the loop, and a line they dislike can be reworded after the release (see the last section).
- **Asked only for the notes**: show them in full with the report below and stop. The PR stays open and nothing is published.

Stop on the way to a release only for what the user must decide: the PR title announces a major version and nothing in the commits looks breaking to a user (or the reverse, a change that breaks users in a minor release), since a wrong version on npm cannot be taken back.

## 7. Merge and watch the release

The release PR is merged here and nowhere else. A ruleset on `main` requires the `release-notes` check of `ci.yml`, which runs the script from step 5, so GitHub refuses to merge a release PR whose notes are still as generated; this step is the other half of that rule.

**Start CI.** The PR was opened by release-please with the workflow's own token, and GitHub holds the workflows of such a PR until a maintainer approves them ("Some checks are waiting for approval" in the merge box). The session runs with the user's rights, so approve the held runs of the PR's head commit instead of sending the user to the button:

```sh
sha=$(gh pr view <n> --json headRefOid -q .headRefOid)
gh api "repos/{owner}/{repo}/actions/runs?head_sha=$sha" \
  -q '.workflow_runs[] | select(.conclusion == "action_required") | .id' |
  while read -r id; do gh api -X POST "repos/{owner}/{repo}/actions/runs/$id/approve"; done
```

The run appears a few seconds after the commit of step 4; when the list is empty and `gh pr checks <n>` reports no checks yet, wait and look again. Approve only runs of this release PR.

**Merge.**

```sh
gh pr checks <n> --watch          # check and release-notes must both pass
gh pr merge <n> --merge           # a merge commit, as for every PR here
```

Never pass `--admin` and never work around a failing or missing check. A failing `check` job is a real failure on `main`: report it and stop. A failing `release-notes` check after step 5 passed means `main` moved and release-please regenerated the entry, so go back to step 1.

**Watch it reach npm.** The merge is a push to `main`, which starts the `release` workflow: release-please tags `vX.Y.Z` and creates the GitHub release from the PR body, then the `publish` job publishes to npm.

```sh
gh run list --workflow release.yml --branch main --limit 1 --json databaseId,status,headSha
gh run watch <run id> --exit-status
gh release view vX.Y.Z --json url,body
npm view @zharskiy/pinata version
```

The release is done when `npm view` prints X.Y.Z; the registry can lag the job by a minute. If `publish` failed, show the failing step's output and follow "When publishing fails" in `RELEASING.md` as far as rerunning the failed job (`gh run rerun <run id> --failed`); do not publish from this machine.

## 8. Report

```
Released X.Y.Z: <GitHub release url>, npm <version from npm view>      (or: Notes ready on PR #<n>: <url>, not merged)
Rewritten: <a> generated lines → <b> bullets (<breaking>, <features>, <fixes>)
Merged: <generated line> → <bullet it became part of>
Dropped: <generated line> — duplicate of … | fix to a feature new in this release | not visible to users | reverted
Unsure: <bullet> — <what could not be confirmed from the sources>
```

List every merged and dropped line: the user checks from this list that nothing a user needs was lost.

## Entries that are already released

release-please only ever adds a new entry at the top of `CHANGELOG.md` and never rewrites older ones, so an old entry can be reworded on `main` through a normal PR with a `docs(changelog):` commit, and the matching GitHub release with `gh release edit vX.Y.Z --notes-file <file>`. Do this only when the user asks for it, and keep the version heading lines as they are: release-please finds the place for the next entry by the first of them.
