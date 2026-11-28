# Changelog

## [1.2.1](https://github.com/zharskiy/pinata/compare/v1.2.0...v1.2.1) (2026-11-26)


### Bug Fixes

* **subagents:** An agent that starts helpers now ends its turn and waits for their results instead of redoing their work ([e309cd9](https://github.com/zharskiy/pinata/commit/e309cd9e28b97727ff752e7ca04b53199a705ab0))
* **subagents:** A change is reviewed once per request instead of again after every fix; ask for another review when you want one ([9de622c](https://github.com/zharskiy/pinata/commit/9de622c9f63fce3fb0c3a5583b4b7b5d1152beb9))

## [1.2.0](https://github.com/zharskiy/pinata/compare/v1.1.0...v1.2.0) (2026-11-25)


### Features

* **subagents:** A change is now reviewed by one `reviewer` before a single `verifier` runs the project's checks at the end; the `implementer` no longer runs them ([91027ac](https://github.com/zharskiy/pinata/commit/91027ac7d578487063c756c963fbc63ca991af79), [fe42896](https://github.com/zharskiy/pinata/commit/fe42896f2fa27ed9abc1cb343972c7363717630c))
* **subagents:** The `planner` writes the plan to a file when you ask for the plan to be kept ([2304a8c](https://github.com/zharskiy/pinata/commit/2304a8c82049572943d3003b7fc7db3f47e97686))
* **subagents:** The `editor` agent is gone and its edits go to the `implementer`; remove `editor` from the `subagents` list of your own agent files, which do not load with it ([e590881](https://github.com/zharskiy/pinata/commit/e59088172466bf4a8aca4e9a8bee3b66202c5295))
* **subagents:** The main session and the agents that start helpers follow one shared delegation guide, so leads start their helpers sooner ([dc8b5ac](https://github.com/zharskiy/pinata/commit/dc8b5ac2d8f1befb46695d2cea2247c80e64e28a))
* **subagents:** The `pinata-code-style` skill ships with the package and the `implementer` writes code by it; a skill of the same name in your own folders replaces it ([5c4c628](https://github.com/zharskiy/pinata/commit/5c4c628889e54fbbc42985e07906fb5e276467f2))
* **subagents:** The shipped agents hand off later, between 80k and 150k tokens, so a `reviewer` no longer stops in the middle of a review ([140fed4](https://github.com/zharskiy/pinata/commit/140fed4f46b4635cdb6f6bbb95c5a887b81cf47c))

## [1.1.0](https://github.com/zharskiy/pinata/compare/v1.0.0...v1.1.0) (2026-11-24)

Everything is called pinata now, and an install made by 1.0.0 is not migrated. Before you update, run the old version's `pinata uninstall`, move `~/.pi/agent/pi-sandbox/config.json` to `~/.pi/agent/pinata/config.json`, rename any `PI_SANDBOX_*` variables to `PINATA_*`, make sure pi is installed on the host, then run `pinata install`.


### Features

* **launcher:** Every `pi sandbox <command>` is now `pinata <command>` (`pinata status`, `pinata doctor`, …), and `pi` only launches pi in the sandbox ([46d53c7](https://github.com/zharskiy/pinata/commit/46d53c73b1d0dbb20e59b384f2d3c142509c9b94), [147e3cb](https://github.com/zharskiy/pinata/commit/147e3cb93619aa2e05c8220e80ec32881cea0d63))
* **launcher:** Everything named `pi-sandbox` is now `pinata`: the config folder `<agentDir>/pinata/`, the `PINATA_*` variables and the VM, containers, volumes and images; the old names are no longer read ([afbcc06](https://github.com/zharskiy/pinata/commit/afbcc0619aad2953a7d409f3352b58d3461a4cc0))
* **launcher:** `pinata restart` replaces `pi sandbox reset`: it deletes the sandbox VM and creates it again, keeping your settings, grants, logins and pi sessions ([d6be435](https://github.com/zharskiy/pinata/commit/d6be43596075e9034737981cf954a217c072e130), [4e681cd](https://github.com/zharskiy/pinata/commit/4e681cda13edb5de9d8cbc0cf6165957e116c60e), [d882ff3](https://github.com/zharskiy/pinata/commit/d882ff32e719b459640a4e38da4cfa1b678bb82e), [bd0bde7](https://github.com/zharskiy/pinata/commit/bd0bde77762077f95ea89701e388fa4de7e709e1))
* **launcher:** `pinata uninstall --sandbox` removes only the sandbox, so `pi` runs on the host again; `pinata install` brings it back ([286d1cf](https://github.com/zharskiy/pinata/commit/286d1cf7eec81da25d75ce58b677037ae5bc698b), [adfe57e](https://github.com/zharskiy/pinata/commit/adfe57ea09c9cb93963b2e1efbd9298357e64376))
* **launcher:** Pinata no longer installs pi: install pi on the host first, or `pinata install`, `pinata update` and `pi` stop with an error; `--pi <version>` is gone ([235e026](https://github.com/zharskiy/pinata/commit/235e0268952498e989423ea1be0661dba10ca8e6), [4f8d972](https://github.com/zharskiy/pinata/commit/4f8d97295a68af929e8b381d78f875a59f8d3a10), [48a5221](https://github.com/zharskiy/pinata/commit/48a52215cefb90e091ef75c641b1edc2cfcf5369), [582b0fe](https://github.com/zharskiy/pinata/commit/582b0fe7eb9095a029684f2d56364a8ebc2add60))
* **launcher:** `pinata install`, `update`, `uninstall`, `stop` and the report commands print one line per step, and show the output of brew, npm, colima or pi only when it fails ([7a6f731](https://github.com/zharskiy/pinata/commit/7a6f7317c78f6c3f096300d1ced721ad56c3a703), [8dbec15](https://github.com/zharskiy/pinata/commit/8dbec15c66ce611df02097a5e6186966e29f1ee3), [8a8b3f7](https://github.com/zharskiy/pinata/commit/8a8b3f71d185efc3dacebaf4ea6a9e63c2add360))
* **launcher:** `-h` or `--help` after any `pinata` command prints the full help table ([3fd5a41](https://github.com/zharskiy/pinata/commit/3fd5a4143077730b8ebb61ccad881984d704bd35))
* **launcher:** `pinata install --config`, `pinata config --json` and `pinata update <version>` are gone: copy the settings file into place, read the JSON from `pinata config`, and install another version with npm ([c1cf199](https://github.com/zharskiy/pinata/commit/c1cf1994573e15594b94626e8af43cf634222b1e))


### Bug Fixes

* **launcher:** `pinata uninstall` no longer deletes the sandbox VM while another pinata command is starting it ([000adad](https://github.com/zharskiy/pinata/commit/000adad8d2b22e97fd0924278da03861384a9335))

## [1.0.0](https://github.com/zharskiy/pinata/compare/v0.4.0...v1.0.0) (2026-11-24)


### ⚠ BREAKING CHANGES

* **launcher:** The package is now `@zharskiy/pinata` (was `pi-extensions-mz`) and `launcher/install.sh` and `launcher/uninstall.sh` are gone: install with `npm install -g --legacy-peer-deps @zharskiy/pinata@<version>` and `pinata install`, remove with `pinata uninstall`; Colima 0.9.0 or newer is required, and the fish shell no longer gets a PATH block

### Features

* **launcher:** `pinata install`, `pinata update` and `pinata uninstall` set up, update and remove the sandbox, the `pi` link and the PATH block in one command each ([920ce1f](https://github.com/zharskiy/pinata/commit/920ce1ffd619315fd496ba74981d2dfa5aeb6090))
* **launcher:** `pi sandbox list` shows the sandbox VM and the pi sessions it runs, for every folder, without starting the VM ([86bfce3](https://github.com/zharskiy/pinata/commit/86bfce384623e18b50e9ec0e5b3050f7c8f28846))
