using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Helpers;
using SPTarkov.Server.Core.Models.Eft.Common;
using SPTarkov.Server.Core.Models.Logging;
using SPTarkov.Server.Core.Models.Spt.Location;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Servers;
using SPTarkov.Server.Core.Services;
using SPTarkov.Server.Core.Utils;

namespace BarlogM_Unda;

[Injectable(InjectionType.Singleton, typeof(RaidTimeAdjustmentService))]
public class RaidTimeAdjustmentServiceEx(
    ISptLogger<RaidTimeAdjustmentService> logger,
    DatabaseService databaseService,
    RandomUtil randomUtil,
    WeightedRandomHelper weightedRandomHelper,
    ProfileActivityService profileActivityService,
    ConfigServer configServer,
    ModData modData
) : RaidTimeAdjustmentService(
    logger,
    databaseService,
    randomUtil,
    weightedRandomHelper,
    profileActivityService,
    configServer)
{
    readonly ModConfig _modConfig = modData.ModConfig;

    public override void MakeAdjustmentsToMap(RaidChanges raidAdjustments, LocationBase mapBase)
    {
        if (raidAdjustments.DynamicLootPercent < 100)
        {
            base.AdjustLootMultipliers(LocationConfig.LooseLootMultiplier, raidAdjustments.DynamicLootPercent);
        }

        if (raidAdjustments.StaticLootPercent < 100)
        {
            base.AdjustLootMultipliers(LocationConfig.StaticLootMultiplier, raidAdjustments.StaticLootPercent);
        }

        mapBase.EscapeTimeLimit = raidAdjustments.RaidTimeMinutes;

        foreach (var exitChange in raidAdjustments.ExitChanges)
        {
            var exitToChange = mapBase.Exits.FirstOrDefault(exit => exit.Name == exitChange.Name);
            if (exitToChange is null)
            {
                return;
            }

            if (exitChange.Chance is not null)
            {
                exitToChange.Chance = exitChange.Chance;
            }

            if (exitChange.MinTime is not null)
            {
                exitToChange.MinTime = exitChange.MinTime;
            }

            if (exitChange.MaxTime is not null)
            {
                exitToChange.MaxTime = exitChange.MaxTime;
            }
        }

        var mapSettings = GetMapSettings(mapBase.Id);
        if (mapSettings.AdjustWaves)
        {
            base.AdjustWaves(mapBase, raidAdjustments);

            AdjustPMCSpawns(mapBase, raidAdjustments);
        }
    }

    int GetBossPmcSpawnCount(List<BossLocationSpawn> bossLocationSpawns)
    {
        return bossLocationSpawns.Count(spawn =>
        {
            return string.Equals(spawn.BossName, "pmcusec",
                       StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(spawn.BossName, "pmcbear",
                       StringComparison.OrdinalIgnoreCase);
        });
    }

    protected override void AdjustPMCSpawns(LocationBase mapBase, RaidChanges raidAdjustments)
    {
        var result = new List<BossLocationSpawn>();

        var originalPmcWaveCount = GetBossPmcSpawnCount(mapBase.BossLocationSpawn);
        var skip = (int)(originalPmcWaveCount * 0.5);

        logger.Warning($"[Unda] remove {skip} PMC waves");
        if (_modConfig.Debug)
        {
            logger.LogWithColor($"[Unda] remove {skip} PMC waves", LogTextColor.Black);
        }

        foreach (var spawn in mapBase.BossLocationSpawn)
        {
            if (skip > 0 && (
                    string.Equals(spawn.BossName, "pmcusec",
                        StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(spawn.BossName, "pmcbear",
                        StringComparison.OrdinalIgnoreCase)
                ))
            {
                skip--;
                continue;
            }

            result.Add(spawn);
        }

        mapBase.BossLocationSpawn = result;
    }
}
