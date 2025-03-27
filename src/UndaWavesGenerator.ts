import { inject, injectable } from "tsyringe";

import type { ILogger } from "@spt/models/spt/utils/ILogger";
import { IBotConfig } from "@spt/models/spt/config/IBotConfig";
import { IPmcConfig } from "@spt/models/spt/config/IPmcConfig";
import { ILocationConfig } from "@spt/models/spt/config/ILocationConfig";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { ILocations } from "@spt/models/spt/server/ILocations";
import { ILocation } from "@spt/models/eft/common/ILocation";
import {
    IBossLocationSpawn,
    IBossSupport,
    ILocationBase,
    IWave,
    WildSpawnType,
} from "@spt/models/eft/common/ILocationBase";
import { RandomUtil } from "@spt/utils/RandomUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { PmcWaveGenerator } from "@spt/generators/PmcWaveGenerator";
import * as config from "../config/config.json";
import { DatabaseService } from "@spt/services/DatabaseService";

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
export class UndaWavesGenerator extends PmcWaveGenerator {
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
        "ZoneSnipeStilo",
    ];

    protected databaseTables: IDatabaseTables;
    protected botConfig: IBotConfig;
    protected locationConfig: ILocationConfig;
    protected locations: ILocations;

    protected readonly generalLocationInfo: Record<
        string,
        GeneralLocationInfo
    > = {};

    constructor(
        @inject("PrimaryLogger") protected logger: ILogger,
        @inject("RandomUtil") protected randomUtil: RandomUtil,
        @inject("DatabaseService") protected databaseService: DatabaseService,
        @inject("ConfigServer") protected configServer: ConfigServer,
        @inject("HashUtil") protected hashUtil: HashUtil
    ) {
        super(logger, randomUtil, databaseService, configServer);
    }

    public override applyWaveChangesToAllMaps(): void {
        this.logger.error("Unda.applyWaveChangesToAllMaps not implemented");
        throw new Error("Not implemented");

        for (const location of Object.keys(this.pmcConfig.customPmcWaves)) {
            this.applyWaveChangesToMapByName(location);
        }
    }

    public override applyWaveChangesToMapByName(name: string): void {
        this.logger.error(
            `Unda.applyWaveChangesToMapByName(${name}) not implemented`
        );
        throw new Error("Not implemented");
    }

    public override applyWaveChangesToMap(location: ILocationBase): void {
        const locationId = location.Id.toLowerCase();
        this.deleteAllPmcBosses(location);
        this.deleteAllCustomWaves(locationId);
        this.updateMaxBotsAmount(location);
        this.generatePmcBossWaves(location);
        this.replaceScavWaves(location);
        this.logger.info("[Unda] Bot waves generated");
    }

    deleteAllPmcBosses(location: ILocationBase): undefined {
        if (config.debug) {
            this.logger.info("[Unda] delete all pmc bosses");
        }

        const filteredArray = location.BossLocationSpawn.filter(
            (bossLocationSpawn) =>
                bossLocationSpawn.BossName !== "pmcBEAR" &&
                bossLocationSpawn.BossName !== "pmcUSEC"
        );

        location.BossLocationSpawn = filteredArray;
    }

    deleteAllCustomWaves(locationId: string): undefined {
        this.locationConfig.customWaves.boss[locationId] = [];
        this.locationConfig.customWaves.normal[locationId] = [];

        if (config.debug) {
            this.logger.info(
                `[Unda] locationConfig.customWaves.boss: ${JSON.stringify(
                    this.locationConfig.customWaves.boss
                )}`
            );
        }
    }

    updateMaxBotsAmount(location: ILocationBase): undefined {
        const locationId = location.Id.toLowerCase();
        if (locationId === "tarkovstreets" && config.streetsQuietRaids) {
            // this.increaseMaxBotsAmountForStreets(location, maxBots);
        } else if (this.smallLocations.includes(locationId)) {
            const { maxBots, maxPlayers } =
                this.generalLocationInfo[locationId];
            this.increaseMaxBotsAmountForSmallLocation(
                location,
                maxBots,
                maxPlayers
            );
        } else {
            const { maxBots, minPlayers } =
                this.generalLocationInfo[locationId];
            this.increaseMaxBotsAmountForLargeLocation(
                location,
                maxBots,
                minPlayers
            );
        }
    }

    increaseMaxBotsAmountForLargeLocation(
        location: ILocationBase,
        maxBots: number,
        minPlayers: number
    ): number {
        const term = this.randomUtil.getInt(
            Math.round(minPlayers / 2),
            minPlayers + 1
        );
        return this.increaseMaxBotsAmountForLocation(location, maxBots, term);
    }

    increaseMaxBotsAmountForSmallLocation(
        location: ILocationBase,
        maxBots: number,
        maxPlayers: number
    ): number {
        const term = this.randomUtil.getInt(
            Math.round(maxPlayers / 2),
            maxPlayers - 1
        );
        return this.increaseMaxBotsAmountForLocation(location, maxBots, term);
    }

    increaseMaxBotsAmountForStreets(
        location: ILocationBase,
        maxBots: number
    ): number {
        const term = this.randomUtil.getInt(2, 5);
        return this.increaseMaxBotsAmountForLocation(location, maxBots, term);
    }

    increaseMaxBotsAmountForLocation(
        location: ILocationBase,
        maxBots: number,
        term: number
    ): number {
        const newMaxBotsValue = maxBots + term;
        location.BotMax = newMaxBotsValue;

        const locationId = location.Id.toLowerCase();
        this.botConfig.maxBotCap[locationId] = newMaxBotsValue;

        if (config.debug) {
            this.logger.info(
                `[Unda] ${locationId}.BotMax: ${maxBots} -> ${newMaxBotsValue}`
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

    getLocationMaxBots(
        locationName: string,
        locationBase: ILocationBase
    ): number {
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

    getLocationZones(
        locationName: string,
        locationBase: ILocationBase
    ): string[] {
        if (locationName === "laboratory") {
            return [
                ...new Set(
                    locationBase.BossLocationSpawn.map((bz) => {
                        if (
                            bz.BossZone.trim().length == 0 ||
                            bz.BossZone.toLowerCase().includes("gate")
                        ) {
                            return "BotZone";
                        } else {
                            return bz.BossZone;
                        }
                    })
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
        return base.OpenZones.split(",").filter((zone) =>
            zone.includes("Snipe")
        );
    }

    getLocationZonesNew(base: ILocationBase): string[] {
        return base.OpenZones.split(",").filter(
            (zone) => !zone.includes("Snipe")
        );
    }

    replaceScavWaves(location: ILocationBase): undefined {
        const locationId = location.Id.toLowerCase();

        if (locationId === "laboratory") {
            return;
        }

        const marksmanZones =
            this.generalLocationInfo[locationId].marksmanZones;

        const assaultZones = [...this.generalLocationInfo[locationId].zones];

        if (locationId === "rezervbase") {
            // for Rezerv zone name should be empty string
            assaultZones.forEach((v, i) => {
                assaultZones[i] = "";
            });
        } else {
            // replace zones with empty names with BotZone
            assaultZones.forEach((v, i) => {
                if (v.trim().length == 0) {
                    assaultZones[i] = "BotZone";
                }
            });
        }

        this.cleanWaves(location);

        let maxMarksmanGroupSize = 1;
        if (locationId === "shoreline") {
            maxMarksmanGroupSize = 2;
        }

        const currentWaveNumber = this.generateMarksmanWaves(
            location,
            marksmanZones,
            maxMarksmanGroupSize
        );

        const maxAssaultScavAmount =
            this.generalLocationInfo[locationId].maxScavs;

        if (maxAssaultScavAmount <= 0) {
            this.logger.error(
                `[Unda] ${locationId}.BotMax: ${maxAssaultScavAmount}`
            );
        }

        const maxScavGroupSize =
            locationId === "tarkovstreets" && config.streetsQuietRaids
                ? 3
                : config.maxScavGroupSize;

        this.generateAssaultWaves(
            location,
            assaultZones,
            location.EscapeTimeLimit,
            maxAssaultScavAmount,
            maxScavGroupSize,
            currentWaveNumber
        );

        if (config.debug) {
            this.logger.info(
                `[Unda] ${locationId}.waves: ${JSON.stringify(location.waves)}`
            );
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
        location: ILocationBase,
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
            this.logger.info(
                `[Unda] '${location.Id.toLowerCase()}' scav groups ${JSON.stringify(
                    groupsByZones
                )}`
            );
        }

        const firstWaveTimeMin = 60;
        const lastWaveTimeMin = Math.ceil((escapeTimeLimit * 60) / 2);
        const middleWaveTimeMin = Math.ceil(lastWaveTimeMin / 2);

        this.createAssaultWaves(
            groupsByZones,
            location,
            "normal",
            firstWaveTimeMin,
            currentWaveNumber
        );

        this.createAssaultWaves(
            groupsByZones,
            location,
            "normal",
            middleWaveTimeMin,
            currentWaveNumber
        );

        this.createAssaultWaves(
            groupsByZones,
            location,
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
    ): IWave {
        return {
            BotPreset: difficulty,
            BotSide: "Savage",
            SpawnPoints: zoneName,
            WildSpawnType: botType,
            isPlayers: false,
            number: number,
            slots_min: slotsMin,
            slots_max: slotsMax,
            time_min: timeMin,
            time_max: timeMax,
            SpawnMode: ["pve"],
        };
    }

    generatePmcBossWaves(location: ILocationBase): undefined {
        const locationId = location.Id.toLowerCase();
        const minPlayers = this.generalLocationInfo[locationId].minPlayers;
        const maxPlayers = this.generalLocationInfo[locationId].maxPlayers;

        const maxPmcAmount = this.randomUtil.getInt(minPlayers, maxPlayers) - 1;
        if (maxPmcAmount <= 0) {
            this.logger.error(
                `[Unda] ${locationId}.maxPlayers: ${maxPmcAmount}`
            );
        }

        const groups = this.splitMaxAmountIntoGroups(
            maxPmcAmount,
            config.maxPmcGroupSize
        );

        const zones = [...this.generalLocationInfo[locationId].zones];

        const groupsByZones: ZoneGroupSize[] = this.separateGroupsByZones(
            zones,
            groups
        );

        if (config.debug) {
            this.logger.info(
                `[Unda] '${locationId}' PMC groups ${JSON.stringify(
                    groupsByZones
                )}`
            );
        }

        for (const groupByZone of groupsByZones) {
            location.BossLocationSpawn.push(
                this.generatePmcAsBoss(
                    groupByZone.groupSize,
                    config.pmcBotDifficulty,
                    groupByZone.zoneName
                )
            );
        }

        if (config.debug) {
            this.logger.info(
                `[Unda] locationConfig.customWaves.boss[${locationId}]: ${JSON.stringify(
                    this.locationConfig.customWaves.boss[locationId]
                )}`
            );
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
    ): IBossLocationSpawn {
        const supports: IBossSupport[] = [];
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
            spawnMode: ["pve"],
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

    public fillInitialData(): undefined {
        this.databaseTables = this.databaseService.getTables();
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

        for (const [locationId, locationObj] of Object.entries(
            this.locations
        )) {
            if (this.locationsToIgnore.includes(locationId)) {
                continue;
            }

            const locationData: ILocation = locationObj;

            if (locationId === "tarkovstreets") {
                this.makeAllZonesOpenForStreets(locationData);
            }

            const marksmanZones =
                locationId === "tarkovstreets"
                    ? this.getLocationMarksmanZonesNew(locationData.base)
                    : this.getLocationMarksmanZones(locationData.base);

            const zones =
                locationId === "tarkovstreets"
                    ? this.getLocationZonesNew(locationData.base)
                    : this.getLocationZones(locationId, locationData.base);

            const minPlayers = this.getLocationMinPlayers(locationData.base);

            const maxPlayers =
                locationId === "tarkovstreets" && config.streetsQuietRaids
                    ? minPlayers
                    : this.getLocationMaxPlayers(locationData.base);

            const maxMarksmans = this.getLocationMaxMarksmans(
                locationId,
                marksmanZones.length
            );

            const maxBots = this.getLocationMaxBots(
                locationId,
                locationData.base
            );
            const maxScavs = maxBots - maxMarksmans;

            this.generalLocationInfo[locationId] = {
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
}
