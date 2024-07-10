# Unda mod for SPT-AKI

[![GitHub Tags](https://img.shields.io/github/v/tag/barlog-m/SPT-AKI-Unda?color=0298c3&label=version&style=flat-square)](https://github.com/barlog-m/SPT-AKI-Unda/tags)
[![MIT License](https://img.shields.io/badge/license-MIT-0298c3.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Unda** is a mod for [SPT-AKI](https://www.sp-tarkov.com/)

This is another bot waves generator mod.

Inspired by [BetterSpawnsPlus](https://hub.sp-tarkov.com/files/file/1002-betterspawnsplus/) [MOAR](https://hub.sp-tarkov.com/files/file/1059-moar-bots-spawning-difficulty/) and [SWAG + Donuts](https://hub.sp-tarkov.com/files/file/878-swag-donuts-dynamic-spawn-waves-and-custom-spawn-points/)

Any of this mods can do more and do it better.
This mod is meant to be as simple as possible.

If you happy with big spawn mods don't use this one. I made it mostly for myself to keep game as close as possible to vanila SPT-AKI and fix issue when PMC spawns among Scavs and immidently kill each other.

This mod realize only one algorithm for spawns with minimal settings.

## For PMC

Amount of PMC randomly selected between `locationData.base.MinPlayers` and `locationData.base.MaxPlayers` split by random size groups from 1 to `config.maxPmcGroupSize` randomly spreaded by bot spawn zones. List of zones shuffle every time. PMC spawns as a bosses and followers in beginnig of raid (game spawn them in first 60 seconds).

## For Scavs

Maximum amount of regular scavs on a map (locationData.base.BotMax - amount of marksman scavs) split by random size groups from 0 to `config.maxScavGroupSize` randomly spreaded by spawn zones.

Scavs spawns in 3 general waves:

- normal difficulty between 60 seconds and +120 seconds.
- normal difficulty between `raidLength / 4` and +120 seconds.
- hard difficulty between `raidLength / 2` and +120 seconds.

**PMC and Scavs waves and groups generate after each raid from scratch.**

If option `streetsQuietRaids` set to `true` then for Streets max scav group size set to 3.
