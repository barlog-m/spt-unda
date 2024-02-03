import {inject, injectable} from "tsyringe";

import {ILogger} from "@spt-aki/models/spt/utils/ILogger";
import {DatabaseServer} from "@spt-aki/servers/DatabaseServer";
import {IBotConfig} from "@spt-aki/models/spt/config/IBotConfig";
import {IPmcConfig} from "@spt-aki/models/spt/config/IPmcConfig";
import {ILocationConfig} from "@spt-aki/models/spt/config/ILocationConfig";
import {IDatabaseTables} from "@spt-aki/models/spt/server/IDatabaseTables";
import {ILocationData} from "@spt-aki/models/spt/server/ILocations";
import {
    ILocationBase,
    Wave,
    BossLocationSpawn,
    BossSupport,
} from "@spt-aki/models/eft/common/ILocationBase";
import {RandomUtil} from "@spt-aki/utils/RandomUtil";
import {HashUtil} from "@spt-aki/utils/HashUtil";
import {ILocations} from "@spt-aki/models/spt/server/ILocations";
import {ConfigServer} from "@spt-aki/servers/ConfigServer";
import {ConfigTypes} from "@spt-aki/models/enums/ConfigTypes";

import * as config from "../config/config.json";

type ZoneGroupSize = { zoneName: string; groupSize: number };

type GeneralLocationInfo = {
    marksmanZones: string[];
    zones: string[];
    maxBots: number;
    minPlayers: number;
    maxPlayers: number;
    maxMarksmans: number;
    maxScavs: number;
};

@injectable()
export class WavesGenerator {
    readonly locationsToIgnore: string[] = [
        "base",
        "develop",
        "hideout",
        "privatearea",
        "suburbs",
        "terminal",
        "town",
    ];

    readonly smallLocations: string[] = [
        "factory4_day",
        "factory4_night",
        "laboratory",
        "rezervbase",
    ];

    readonly streetsAllZones: string[] = [
        "ZoneSW01",
        "ZoneFactory",
        "ZoneHotel_1",
        "ZoneHotel_2",
        "ZoneConcordia_1",
        "ZoneConstruction",
        "ZoneStilo",
        "ZoneConcordiaParking",
        "ZoneSnipeCinema",
        "ZoneSnipeStilo",
        "ZoneSnipeBuilding",
        "ZoneSnipeSW01",
        "ZoneCinema",
        "ZoneConcordia_2",
        "ZoneColumn",
        "ZoneSW00",
        "ZoneCarShowroom",
        "ZoneCard1"
    ]

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
    ) {
    }

    public generateWaves(): undefined {
        this.deleteAllCustomWaves();
        this.updateMaxBotsAmount();
        this.replacePmcBossWaves();
        this.replaceScavWaves();
        this.logger.info("[Unda] Bot waves generated");
    }

    disableAllConversionToPmc(): undefined {
        for (const botType of Object.keys(
            this.pmcConfig.convertIntoPmcChance
        )) {
            this.pmcConfig.convertIntoPmcChance[botType] = {min: 0, max: 0};
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
            if (this.locationsToIgnore.includes(locationName)) {
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
            if (this.locationsToIgnore.includes(locationName)) {
                continue;
            }

            const location: ILocationData = locationObj;

            if (location.base) {
                const marksmanZones = (locationName === "tarkovstreets") ?
                    this.getLocationMarksmanZonesNew(location.base) :
                    this.getLocationMarksmanZones(location.base);

                const zones = (locationName === "tarkovstreets") ?
                    this.getLocationZonesNew(location.base) :
                    this.getLocationZones(locationName, location.base);

                const minPlayers = this.getLocationMinPlayers(location.base);

                const maxPlayers = ((locationName === "tarkovstreets") && (config.streetsQuietRaids)) ? minPlayers :
                    this.getLocationMaxPlayers(location.base);

                const maxMarksmans = this.getLocationMaxMarksmans(
                    locationName,
                    marksmanZones.length
                );

                const maxBots = this.getLocationMaxBots(locationName, location.base);
                const maxScavs = maxBots - maxMarksmans;

                this.generalLocationInfo[locationName] = {
                    marksmanZones,
                    zones,
                    maxBots,
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

        if (config.streetsQuietRaids) {
            this.setMaxBotPerZoneForStreets();
        }
    }

    updateMaxBotsAmount(): undefined {
        for (const [locationName, locationObj] of Object.entries(
            this.locations
        )) {
            if (this.locationsToIgnore.includes(locationName)) {
                continue;
            }

            const location: ILocationData = locationObj;

            if (location.base) {
                if ((locationName === "tarkovstreets") && (config.streetsQuietRaids)) {
                    // this.increaseMaxBotsAmountForStreets(maxBots);
                } else if (this.smallLocations.includes(locationName)) {
                    const {maxBots, maxPlayers} =
                        this.generalLocationInfo[locationName];
                    this.increaseMaxBotsAmountForSmallLocation(
                        locationName,
                        maxBots,
                        maxPlayers
                    );
                } else {
                    const {maxBots, minPlayers} =
                        this.generalLocationInfo[locationName];
                    this.increaseMaxBotsAmountForLargeLocation(
                        locationName,
                        maxBots,
                        minPlayers
                    );
                }
            }
        }
    }

    increaseMaxBotsAmountForLargeLocation(
        locationName: string,
        maxBots: number,
        minPlayers: number
    ): number {
        const term = this.randomUtil.getInt(
            Math.round(minPlayers / 2),
            minPlayers + 1
        );
        return this.increaseMaxBotsAmountForLocation(
            locationName,
            maxBots,
            term
        );
    }

    increaseMaxBotsAmountForSmallLocation(
        locationName: string,
        maxBots: number,
        maxPlayers: number
    ): number {
        const term = this.randomUtil.getInt(
            Math.round(maxPlayers / 2),
            maxPlayers - 1
        );
        return this.increaseMaxBotsAmountForLocation(
            locationName,
            maxBots,
            term
        );
    }

    increaseMaxBotsAmountForStreets(maxBots: number): number {
        const term = this.randomUtil.getInt(2, 5);
        return this.increaseMaxBotsAmountForLocation(
            "tarkovstreets",
            maxBots,
            term
        );
    }

    increaseMaxBotsAmountForLocation(
        locationName: string,
        maxBots: number,
        term: number
    ): number {
        const locationData: ILocationData = this.locations[locationName];
        const newMaxBotsValue = maxBots + term;
        locationData.base.BotMax = newMaxBotsValue;
        this.botConfig.maxBotCap[locationName] = newMaxBotsValue;

        if (config.debug) {
            this.logger.info(
                `[Unda] ${locationName}.BotMax: ${maxBots} -> ${newMaxBotsValue}`
            );
        }
        return newMaxBotsValue;
    }

    getLocationMinPlayers(locationBase: ILocationBase): number {
        return locationBase.MinPlayers;
    }

    getLocationMaxPlayers(locationBase: ILocationBase): number {
        return locationBase.MaxPlayers;
    }

    getLocationMaxBots(locationName: string, locationBase: ILocationBase): number {
        const botMax = locationBase.BotMax;

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

    getLocationMarksmanZones(locationBase: ILocationBase): string[] {
        return this.getBotTypeZones("marksman", locationBase);
    }

    getLocationZones(locationName: string, locationBase: ILocationBase): string[] {
        if (locationName === "laboratory") {
            return [
                ...new Set(
                    locationBase.BossLocationSpawn.map(
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
        return this.getBotTypeZones("assault", locationBase);
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

        if (type !== "marksman" && zones.length <= 1) {
            const randomZonesAmount = this.randomUtil.getInt(6, 10);
            for (let i = 0; i <= randomZonesAmount; i++) {
                zones.push("BotZone");
            }
        }

        return zones;
    }

    getLocationMarksmanZonesNew(base: ILocationBase): string[] {
        return base.OpenZones.split(",").filter((zone) => zone.includes("Snipe"));
    }

    getLocationZonesNew(base: ILocationBase): string[] {
        return base.OpenZones.split(",").filter((zone) => !zone.includes("Snipe"));
    }

    replaceScavWaves(): undefined {
        for (const [locationName, locationObj] of Object.entries(
            this.locations
        )) {
            if (this.locationsToIgnore.includes(locationName)) {
                continue;
            }

            if (locationName === "laboratory") {
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

                const maxScavGroupSize = ((locationName === "tarkovstreets") && (config.streetsQuietRaids)) ? 3 :
                    config.maxScavGroupSize;

                this.generateAssaultWaves(
                    locationBase,
                    assaultZones,
                    locationBase.EscapeTimeLimit,
                    maxAssaultScavAmount,
                    maxScavGroupSize,
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
        maxScavGroupSize: number,
        currentWaveNumber: number
    ): undefined {
        const groups = this.splitMaxAmountIntoGroups(
            maxAssaultScavAmount,
            maxScavGroupSize
        );

        const groupsByZones = this.separateGroupsByZones(zones, groups);
        if (config.debug) {
            this.logger.info(`[Unda] '${locationBase.Name}' scav groups ${JSON.stringify(groupsByZones)}`)
        }

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
                0,
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
            if (this.locationsToIgnore.includes(locationName)) {
                continue;
            }

            const minPlayers =
                this.generalLocationInfo[locationName].minPlayers;
            const maxPlayers =
                this.generalLocationInfo[locationName].maxPlayers;

            const maxPmcAmount = this.randomUtil.getInt(minPlayers, maxPlayers) - 1;
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

            if (config.debug) {
                this.logger.info(`[Unda] '${locationName}' PMC groups ${JSON.stringify(groupsByZones)}`)
            }

            for (const groupByZone of groupsByZones) {
                this.locationConfig.customWaves.boss[locationName].push(
                    this.generatePmcAsBoss(
                        groupByZone.groupSize,
                        config.pmcBotDifficulty,
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

    setMaxBotPerZoneForStreets(): undefined {
        const locationData: ILocationData = this.locations["tarkovstreets"];
        locationData.base.MaxBotPerZone = 3;
    }
}
