# Unda mod for SPT-AKI

[![GitHub Tags](https://img.shields.io/github/v/tag/barlog-m/SPT-AKI-Unda?color=0298c3&label=version&style=flat-square)](https://github.com/barlog-m/SPT-AKI-Unda/tags)
[![MIT License](https://img.shields.io/badge/license-MIT-0298c3.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Unda** is a mod for [SPT-AKI](https://www.sp-tarkov.com/)

This is another bot waves generator mod.

Inspired by [BetterSpawnsPlus](https://hub.sp-tarkov.com/files/file/1002-betterspawnsplus/) [MOAR](https://hub.sp-tarkov.com/files/file/1059-moar-bots-spawning-difficulty/) and [SWAG + Donuts](https://hub.sp-tarkov.com/files/file/878-swag-donuts-dynamic-spawn-waves-and-custom-spawn-points/)

Any of this mods can do more and do it better.
This mod is meant to be as simple as possible.
This mod only replace SPT-AKI waves to separate PMC and Scavs spawn time.

If you happy with big spawn mods don't use this one. I made it mostly for myself to keep game as close as possible to vanila SPT-AKI and fix issue when PMC spawns among Scavs and immidently kill each other.

This mod realize only one algorithm for spawns with minimal settings.

## For PMC

Maximum amount of PMC on a map (locationData.base.BotMax) split by random size groups from 1 to `config.maxPmcGroupSize` randomly spreaded by spawn zones. List of zones shuffle after every raid. Spawns as a bosses in beginnig of raid (game spawn them in first 60 seconds, i don't know why not early).

## For Scavs

Marksman scavs spawn is 100% on their regular places in group of 1. Except for Shoreline where group size is 1 to 2 marksman scavs.

Maximum amount of regular scavs on a map (locationData.base.BotMax - amount of marksman scavs) split by random size groups from 1 to `config.maxScavGroupSize` randomly spreaded by spawn zones.
Scavs spawns in 3 general waves:

normal difficulty between 60 seconds and + 120 seconds.

normal difficulty between raidLength / 4 and + 120 seconds.

hard difficulty between raidLength / 2 and + 120 seconds.
