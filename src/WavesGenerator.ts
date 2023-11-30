import { inject, injectable } from "tsyringe";

import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { IBotConfig } from "@spt-aki/models/spt/config/IBotConfig";
import { IPmcConfig } from "@spt-aki/models/spt/config/IPmcConfig";
import { ILocationConfig } from "@spt-aki/models/spt/config/ILocationConfig";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import { ILocationData } from "@spt-aki/models/spt/server/ILocations";
import {
    ILocationBase,
    Wave,
    WildSpawnType,
    BossLocationSpawn,
    BossSupport,
} from "@spt-aki/models/eft/common/ILocationBase";
import { RandomUtil } from "@spt-aki/utils/RandomUtil";
import { HashUtil } from "@spt-aki/utils/HashUtil";
import { ILocations } from "@spt-aki/models/spt/server/ILocations";

import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";

import * as config from "../config/config.json";

type ZoneGroupSize = { zoneName: string; groupSize: number };

type GeneralLocationInfo = {
    marksmanZones: string[];
    zones: string[];
    minPlayers: number;
    maxPlayers: number;
    maxMarksmans: number;
    maxScavs: number;
};

@injectable()
export class WavesGenerator {
    readonly mapsToIgnore: string[] = [
        "base",
        "develop",
        "hideout",
        "privatearea",
        "suburbs",
        "terminal",
        "town",
    ];

    private databaseTables: IDatabaseTables;
    private botConfig: IBotConfig;
    private pmcConfig: IPmcConfig;
    private locationConfig: ILocationConfig;
    private locations: ILocations;

    private readonly generalLocationInfo: Record<string, GeneralLocationInfo> =
        {};

    constructor(
        @inject("WinstonLogger") protected logger: ILogger,
        @inject("HashUtil") protected hashUtil: HashUtil,
        @inject("RandomUtil") protected randomUtil: RandomUtil,
        @inject("DatabaseServer") protected databaseServer: DatabaseServer,
        @inject("ConfigServer")
        protected configServer: ConfigServer
    ) {}

    public generateWaves(): undefined {
        this.deleteAllCustomWaves();
        this.replacePmcBossWaves();
        this.replaceScavWaves();
        this.logger.info("[Unda] Bot waves generated");
    }

    disableAllConversionToPmc(): undefined {
        for (const botType of Object.keys(
            this.pmcConfig.convertIntoPmcChance
        )) {
            this.pmcConfig.convertIntoPmcChance[botType] = { min: 0, max: 0 };
        }

        if (config.debug) {
            this.logger.info(
                `[Unda] pmcConfig.convertIntoPmcChance: ${JSON.stringify(
                    this.pmcConfig.convertIntoPmcChance
                )}`
            );
        }
    }

    deleteAllCustomWaves(): undefined {
        for (const locationName of Object.keys(this.locations)) {
            if (this.mapsToIgnore.includes(locationName)) {
                continue;
            }

            this.locationConfig.customWaves.boss[locationName] = [];
            this.locationConfig.customWaves.normal[locationName] = [];
        }

        if (config.debug) {
            this.logger.info(
                `[Unda] locationConfig.customWaves.boss: ${JSON.stringify(
                    this.locationConfig.customWaves.boss
                )}`
            );
        }
    }

    public fillInitialData(): undefined {
        this.databaseTables = this.databaseServer.getTables();
        this.botConfig = this.configServer.getConfig<IBotConfig>(
            ConfigTypes.BOT
        );
        this.pmcConfig = this.configServer.getConfig<IPmcConfig>(
            ConfigTypes.PMC
        );
        this.locationConfig = this.configServer.getConfig<ILocationConfig>(
            ConfigTypes.LOCATION
        );
        this.locations = this.databaseTables.locations;

        this.disableAllConversionToPmc();

        for (const [locationName, locationObj] of Object.entries(
            this.locations
        )) {
            if (this.mapsToIgnore.includes(locationName)) {
                continue;
            }

            const location: ILocationData = locationObj;

            if (location.base) {
                const marksmanZones =
                    this.getLocationMarksmanZones(locationName);

                const zones = this.getLocationZones(locationName);

                const minPlayers = this.getLocationMinPlayers(locationName);
                const maxPlayers = this.getLocationMaxPlayers(locationName);

                const maxMarksmans = this.getLocationMaxMarksmans(
                    locationName,
                    marksmanZones.length
                );

                const maxBots = this.getLocationMaxBots(locationName);
                const maxScavs = maxBots - maxMarksmans;

                if (locationName === "tarkovstreets") {
                    this.increaseLocationMaxBotsAmount(
                        locationName,
                        maxBots,
                        this.randomUtil.getInt(2, 5)
                    );

                    this.generalLocationInfo[locationName] = {
                        marksmanZones,
                        zones,
                        minPlayers: 8,
                        maxPlayers: 12,
                        maxMarksmans,
                        maxScavs,
                    };

                    continue;
                }

                this.increaseLocationMaxBotsAmount(
                    locationName,
                    maxBots,
                    this.randomUtil.getInt(
                        Math.round(minPlayers / 2),
                        minPlayers + 1
                    )
                );

                this.generalLocationInfo[locationName] = {
                    marksmanZones,
                    zones,
                    minPlayers,
                    maxPlayers,
                    maxMarksmans,
                    maxScavs,
                };
            }
        }

        if (config.debug) {
            this.logger.info(
                `[Unda] generalLocationInfo: ${JSON.stringify(
                    this.generalLocationInfo
                )}`
            );
        }
    }

    increaseLocationMaxBotsAmount(
        locationName: string,
        maxBots: number,
        term: number
    ): undefined {
        const locationData: ILocationData = this.locations[locationName];
        locationData.base.BotMax = maxBots + term;
        this.botConfig.maxBotCap[locationName] = maxBots + term;
    }

    getLocationMinPlayers(locationName: string): number {
        const locationData: ILocationData = this.locations[locationName];
        return locationData.base.MinPlayers;
    }

    getLocationMaxPlayers(locationName: string): number {
        const locationData: ILocationData = this.locations[locationName];
        return locationData.base.MaxPlayers;
    }

    getLocationMaxBots(locationName: string): number {
        const locationData: ILocationData = this.locations[locationName];
        const botMax = locationData.base.BotMax;

        if (botMax <= 0) {
            return this.botConfig.maxBotCap[locationName];
        } else {
            return botMax;
        }
    }

    getLocationMaxMarksmans(
        locationName: string,
        marksmanLocationsAmount: number
    ): number {
        if (locationName === "shoreline") {
            return marksmanLocationsAmount * 2;
        } else {
            return marksmanLocationsAmount;
        }
    }

    getLocationMarksmanZones(locationName: string): string[] {
        return this.getBotTypeZones(
            "marksman",
            this.locations[locationName].base
        );
    }

    getLocationZones(locationName: string): string[] {
        if (locationName === "laboratory") {
            return [
                ...new Set(
                    this.locations["laboratory"].base.BossLocationSpawn.map(
                        (bz) => {
                            if (bz.BossZone.trim().length == 0) {
                                return "BotZone";
                            } else {
                                return bz.BossZone;
                            }
                        }
                    )
                ),
            ];
        }
        return this.getBotTypeZones(
            "assault",
            this.locations[locationName].base
        );
    }

    getBotTypeZones(type: string, locationBase: ILocationBase): string[] {
        const zones = [
            ...new Set(
                locationBase.waves
                    .filter((wave) => {
                        return wave.WildSpawnType === type;
                    })
                    .map((wave) => {
                        if (wave.SpawnPoints.trim().length == 0) {
                            return "BotZone";
                        } else {
                            return wave.SpawnPoints;
                        }
                    })
            ),
        ];

        if (type !== "marksman" && zones.length === 1) {
            zones.push(zones[0]);
            zones.push(zones[0]);
            zones.push(zones[0]);
            zones.push(zones[0]);
        }

        return zones;
    }

    replaceScavWaves(): undefined {
        for (const [locationName, locationObj] of Object.entries(
            this.locations
        )) {
            if (this.mapsToIgnore.includes(locationName)) {
                continue;
            }

            const location: ILocationData = locationObj;

            if (location.base) {
                const locationBase: ILocationBase = location.base;

                const marksmanZones =
                    this.generalLocationInfo[locationName].marksmanZones;
                const assaultZones = [
                    ...this.generalLocationInfo[locationName].zones,
                ];
                this.cleanWaves(locationBase);

                let maxMarksmanGroupSize = 1;
                if (locationName === "shoreline") {
                    maxMarksmanGroupSize = 2;
                }

                const currentWaveNumber = this.generateMarksmanWaves(
                    locationBase,
                    marksmanZones,
                    maxMarksmanGroupSize
                );

                const maxAssaultScavAmount =
                    this.generalLocationInfo[locationName].maxScavs;

                if (maxAssaultScavAmount <= 0) {
                    this.logger.error(
                        `[Unda] ${locationName}.BotMax: ${maxAssaultScavAmount}`
                    );
                }

                this.generateAssaultWaves(
                    locationBase,
                    assaultZones,
                    locationBase.EscapeTimeLimit,
                    maxAssaultScavAmount,
                    currentWaveNumber
                );

                if (config.debug) {
                    this.logger.info(
                        `[Unda] ${locationName}.waves: ${JSON.stringify(
                            locationBase.waves
                        )}`
                    );
                }
            }
        }
    }

    cleanWaves(locationBase: ILocationBase): undefined {
        locationBase.waves = [];
    }

    generateMarksmanWaves(
        locationBase: ILocationBase,
        zones: string[],
        maxGroupSize: number
    ): number {
        let num = 0;
        const minGroupSize = maxGroupSize > 1 ? 1 : 0;
        zones.forEach((zone) => {
            locationBase.waves.push(
                this.generateWave(
                    "marksman",
                    zone,
                    "hard",
                    num++,
                    minGroupSize,
                    maxGroupSize,
                    60,
                    90
                )
            );
        });

        return num;
    }

    generateAssaultWaves(
        locationBase: ILocationBase,
        zones: string[],
        escapeTimeLimit: number,
        maxAssaultScavAmount: number,
        currentWaveNumber: number
    ): undefined {
        const groups = this.splitMaxAmountIntoGroups(
            maxAssaultScavAmount,
            config.maxScavGroupSize
        );

        const groupsByZones = this.separateGroupsByZones(zones, groups);

        const firstWaveTimeMin = 60;
        const lastWaveTimeMin = Math.ceil((escapeTimeLimit * 60) / 2);
        const middleWaveTimeMin = Math.ceil(lastWaveTimeMin / 2);

        this.createAssaultWaves(
            groupsByZones,
            locationBase,
            "normal",
            firstWaveTimeMin,
            currentWaveNumber
        );

        this.createAssaultWaves(
            groupsByZones,
            locationBase,
            "normal",
            middleWaveTimeMin,
            currentWaveNumber
        );

        this.createAssaultWaves(
            groupsByZones,
            locationBase,
            "hard",
            lastWaveTimeMin,
            currentWaveNumber
        );
    }

    createAssaultWaves(
        groupsByZones: ZoneGroupSize[],
        locationBase: ILocationBase,
        difficulty: string,
        timeMin: number,
        currentWaveNumber: number
    ): undefined {
        const timeMax = timeMin + 120;

        for (const zoneByBroup of groupsByZones) {
            const wave = this.generateWave(
                "assault",
                zoneByBroup.zoneName,
                difficulty,
                currentWaveNumber++,
                1,
                zoneByBroup.groupSize,
                timeMin,
                timeMax
            );
            locationBase.waves.push(wave);
        }
    }

    generateWave(
        botType: string,
        zoneName: string,
        difficulty: string,
        number: number,
        slotsMin: number,
        slotsMax: number,
        timeMin: number,
        timeMax: number
    ): Wave {
        const spawnPoint = zoneName.trim().length == 0 ? "BotZone" : zoneName;

        return {
            BotPreset: difficulty,
            BotSide: "Savage",
            SpawnPoints: spawnPoint,
            WildSpawnType: botType,
            isPlayers: false,
            number: number,
            slots_min: slotsMin,
            slots_max: slotsMax,
            time_min: timeMin,
            time_max: timeMax,
        };
    }

    replacePmcBossWaves(): undefined {
        for (const locationName of Object.keys(this.locations)) {
            if (this.mapsToIgnore.includes(locationName)) {
                continue;
            }

            const minPlayers =
                this.generalLocationInfo[locationName].minPlayers;
            const maxPlayers =
                this.generalLocationInfo[locationName].maxPlayers;

            const maxPmcAmount =
                this.randomUtil.getInt(minPlayers, maxPlayers) - 1;
            if (maxPmcAmount <= 0) {
                this.logger.error(
                    `[Unda] ${locationName}.maxPlayers: ${maxPmcAmount}`
                );
            }

            const groups = this.splitMaxAmountIntoGroups(
                maxPmcAmount,
                config.maxPmcGroupSize
            );

            const zones = [...this.generalLocationInfo[locationName].zones];

            const groupsByZones: ZoneGroupSize[] = this.separateGroupsByZones(
                zones,
                groups
            );

            for (const groupByZone of groupsByZones) {
                this.locationConfig.customWaves.boss[locationName].push(
                    this.generatePmcAsBoss(
                        groupByZone.groupSize,
                        this.pmcConfig.difficulty,
                        groupByZone.zoneName
                    )
                );
            }

            if (config.debug) {
                this.logger.info(
                    `[Unda] locationConfig.customWaves.boss[${locationName}]: ${JSON.stringify(
                        this.locationConfig.customWaves.boss[locationName]
                    )}`
                );
            }
        }
    }

    separateGroupsByZones(zones: string[], groups: number[]): ZoneGroupSize[] {
        const shuffledZones = this.shuffleZonesArray(zones);
        const groupsPool = [...groups];
        const result: ZoneGroupSize[] = [];

        for (const zoneName of shuffledZones) {
            const groupSize = groupsPool.pop();
            if (groupSize === undefined) {
                break;
            }

            result.push({
                zoneName: zoneName,
                groupSize: groupSize,
            });
        }

        return result;
    }

    generatePmcAsBoss(
        groupSize: number,
        difficulty: string,
        zone: string
    ): BossLocationSpawn {
        const supports: BossSupport[] = [];
        let escortAmount = "0";

        const type = this.randomUtil.getBool() ? "sptBear" : "sptUsec";

        if (groupSize > 1) {
            escortAmount = `${groupSize - 1}`;

            supports.push({
                BossEscortType: type,
                BossEscortDifficult: [difficulty],
                BossEscortAmount: escortAmount,
            });
        }

        return {
            sptId: this.hashUtil.generate(),
            BossName: type,
            BossChance: 100,
            BossZone: zone,
            BossPlayer: true,
            BossDifficult: difficulty,
            BossEscortType: type,
            BossEscortDifficult: difficulty,
            BossEscortAmount: escortAmount,
            Time: -1,
            TriggerId: "",
            TriggerName: "",
            Supports: supports,
            RandomTimeSpawn: false,
        };
    }

    splitMaxAmountIntoGroups(
        maxAmount: number,
        maxGroupSize: number
    ): number[] {
        const result: number[] = [];

        let remainingAmount = maxAmount;
        do {
            const generatedGroupSize = this.randomUtil.getInt(1, maxGroupSize);
            if (generatedGroupSize > remainingAmount) {
                result.push(remainingAmount);
                remainingAmount = 0;
            } else {
                result.push(generatedGroupSize);
                remainingAmount -= generatedGroupSize;
            }
        } while (remainingAmount > 0);

        return result;
    }

    shuffleZonesArray(array: string[]): string[] {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
}
