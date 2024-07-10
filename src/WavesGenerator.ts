import {inject, injectable} from "tsyringe";

import {ILogger} from "@spt/models/spt/utils/ILogger";
import {DatabaseServer} from "@spt/servers/DatabaseServer";
import {IBotConfig} from "@spt/models/spt/config/IBotConfig";
import {IPmcConfig} from "@spt/models/spt/config/IPmcConfig";
import {ILocationConfig} from "@spt/models/spt/config/ILocationConfig";
import {IDatabaseTables} from "@spt/models/spt/server/IDatabaseTables";
import {ILocations} from "@spt/models/spt/server/ILocations";
import {ILocation} from "@spt/models/eft/common/ILocation";
import {
    BossLocationSpawn,
    BossSupport,
    ILocationBase,
    Wave,
    WildSpawnType,
} from "@spt/models/eft/common/ILocationBase";
import {RandomUtil} from "@spt/utils/RandomUtil";
import {HashUtil} from "@spt/utils/HashUtil";
import {ConfigServer} from "@spt/servers/ConfigServer";
import {ConfigTypes} from "@spt/models/enums/ConfigTypes";

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

    readonly streetsAllZones: string[] = [
        "ZoneCarShowroom",
        "ZoneCard1",
        "ZoneCinema",
        "ZoneColumn",
        "ZoneConcordiaParking",
        "ZoneConcordia_1",
        "ZoneConcordia_2",
        "ZoneConstruction",
        "ZoneFactory",
        "ZoneHotel_1",
        "ZoneHotel_2",
        "ZoneSW00",
        "ZoneSW01",
        "ZoneStilo",
        "ZoneSnipeBuilding",
        "ZoneSnipeCinema",
        "ZoneSnipeSW01",
        "ZoneSnipeStilo"
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

            const locationData: ILocation = locationObj;

            if (locationName === "tarkovstreets") {
                this.makeAllZonesOpenForStreets(locationData);
            }

            const marksmanZones = (locationName === "tarkovstreets") ?
                this.getLocationMarksmanZonesNew(locationData.base) :
                this.getLocationMarksmanZones(locationData.base);

            const zones = (locationName === "tarkovstreets") ?
                this.getLocationZonesNew(locationData.base) :
                this.getLocationZones(locationName, locationData.base);

            const minPlayers = this.getLocationMinPlayers(locationData.base);

            const maxPlayers = ((locationName === "tarkovstreets") && (config.streetsQuietRaids)) ? minPlayers :
                this.getLocationMaxPlayers(locationData.base);

            const maxMarksmans = this.getLocationMaxMarksmans(
                locationName,
                marksmanZones.length
            );

            const maxBots = this.getLocationMaxBots(locationName, locationData.base);
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

            const location: ILocation = locationObj;

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
                    WildSpawnType.MARKSMAN,
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
                WildSpawnType.ASSAULT,
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
        botType: WildSpawnType,
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

        const type = this.randomUtil.getBool() ? "pmcBEAR" : "pmcUSEC";

        if (groupSize > 1) {
            escortAmount = `${groupSize - 1}`;

            supports.push({
                BossEscortType: type,
                BossEscortDifficult: [difficulty],
                BossEscortAmount: escortAmount,
            });
        }

        return {
            BossChance: 100,
            BossDifficult: difficulty,
            BossEscortAmount: escortAmount,
            BossEscortDifficult: difficulty,
            BossEscortType: type,
            BossName: type,
            BossPlayer: true,
            BossZone: zone,
            RandomTimeSpawn: false,
            Time: -1,
            TriggerId: "",
            TriggerName: "",
            ForceSpawn: true,
            IgnoreMaxBots: true,
            Supports: supports,
            sptId: this.hashUtil.generate(),
            spawnMode: ["regular", "pve"]
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
        const locationData: ILocation = this.locations["tarkovstreets"];
        locationData.base.MaxBotPerZone = 3;
    }

    makeAllZonesOpenForStreets(locationData: ILocation): undefined {
        locationData.base.OpenZones = this.streetsAllZones.join(",");
    }
}
