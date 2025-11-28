using System.Text.Json;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Generators;
using SPTarkov.Server.Core.Models.Eft.Common;
using SPTarkov.Server.Core.Models.Logging;
using SPTarkov.Server.Core.Models.Spt.Config;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Servers;
using SPTarkov.Server.Core.Services;
using SPTarkov.Server.Core.Utils;
using SPTarkov.Server.Core.Utils.Json;

namespace BarlogM_Unda;

[Injectable(InjectionType.Scoped, typeof(PmcWaveGenerator))]
public class PmcWaveGeneratorEx(
    ISptLogger<PmcWaveGeneratorEx> logger,
    DatabaseService databaseService,
    ConfigServer configServer,
    RandomUtil randomUtil,
    Data data,
    ModData modData
) : PmcWaveGenerator(databaseService, configServer)
{
    private readonly ModConfig _modConfig = modData.ModConfig;
    private readonly LocationConfig locationConfig =
        configServer.GetConfig<LocationConfig>();

    public override void ApplyWaveChangesToAllMaps()
    {
        foreach (var locationId in Data.AllMaps)
        {
            var location = databaseService.GetLocation(locationId);
            ApplyWaveChangesToMap(location.Base);
        }
    }

    public override void ApplyWaveChangesToMapByName(string name)
    {
        var location = databaseService.GetLocation(name);
        ApplyWaveChangesToMap(location.Base);
    }

    public override void ApplyWaveChangesToMap(LocationBase location)
    {
        DeleteAllPmcBosses(location);
        var locationId = location.Id.ToLower();
        DeleteAllCustomWaves(locationId);
        GeneratePmcBossWaves(location);
    }

    void DeleteAllPmcBosses(LocationBase location)
    {
        location.BossLocationSpawn = location.BossLocationSpawn
            .Where(bossLocationSpawn =>
                bossLocationSpawn.BossName != "pmcBEAR" &&
                bossLocationSpawn.BossName != "pmcUSEC")
            .ToList();

        if (_modConfig.Debug)
        {
            logger.LogWithColor(
                $"[Unda] delete all pmc bosses on location '{location.Name}' location.BossLocationSpawn: {JsonSerializer.Serialize(location.BossLocationSpawn)}",
                LogTextColor.Blue);
        }
    }

    void DeleteAllCustomWaves(string locationName)
    {
        locationConfig.CustomWaves.Boss[locationName] = [];
        locationConfig.CustomWaves.Normal[locationName] = [];

        if (_modConfig.Debug)
        {
            logger.LogWithColor(
                $"[Unda] after delete locationConfig.customWaves.boss: {JsonSerializer.Serialize(locationConfig.CustomWaves.Boss)}",
                LogTextColor.Blue);
        }
    }

    void GeneratePmcBossWaves(LocationBase location)
    {
        var locationId = location.Id.ToLower();

        var maxPmcAmount = data.GeneralLocationInfo[locationId].MinPlayers - 1;
        if (maxPmcAmount <= 0)
        {
            logger.Error(
                $"[Unda] {locationId}.maxPlayers: {maxPmcAmount}");
        }

        var groups =
            SplitMaxAmountIntoGroups(maxPmcAmount, _modConfig.MaxPmcGroupSize);
        
        foreach (var group in groups)
        {
            location.BossLocationSpawn.Add(GeneratePmcAsBoss(group, _modConfig.PmcBotDifficulty));
        }

        if (_modConfig.Debug)
        {
            logger.LogWithColor(
                $"[Unda] location.BossLocationSpawn '{locationId}': {JsonSerializer.Serialize(location.BossLocationSpawn)}", LogTextColor.Blue);
        }
    }

    BossLocationSpawn GeneratePmcAsBoss(int groupSize, string difficulty)
    {
        var supports = new List<BossSupport>();
        var escortAmount = "0";

        var type = randomUtil.GetBool() ? "pmcBEAR" : "pmcUSEC";

        if (groupSize > 1)
        {
            escortAmount = $"{groupSize - 1}";

            supports.Add(new BossSupport
            {
                BossEscortType = type,
                BossEscortDifficulty = new ListOrT<string>([difficulty], null),
                BossEscortAmount = escortAmount
            });
        }

        return new BossLocationSpawn
        {
            BossChance = 100,
            BossDifficulty = difficulty,
            BossEscortAmount = escortAmount,
            BossEscortDifficulty = difficulty,
            BossEscortType = type,
            BossName = type,
            IsBossPlayer = true,
            BossZone = "",
            IsRandomTimeSpawn = false,
            ShowOnTarkovMap = false,
            ShowOnTarkovMapPvE = false,
            Time = -1,
            TriggerId = "",
            TriggerName = "",
            ForceSpawn = null,
            IgnoreMaxBots = true,
            DependKarma = null,
            DependKarmaPVE = null,
            Supports = supports,
            SptId = null,
            SpawnMode = new List<string> { "pve" }
        };
    }

    List<int> SplitMaxAmountIntoGroups(int maxAmount, int maxGroupSize)
    {
        var result = new List<int>();
        var remainingAmount = maxAmount;

        do
        {
            var generatedGroupSize = randomUtil.GetInt(1, maxGroupSize);
            if (generatedGroupSize > remainingAmount)
            {
                result.Add(remainingAmount);
                remainingAmount = 0;
            }
            else
            {
                result.Add(generatedGroupSize);
                remainingAmount -= generatedGroupSize;
            }
        } while (remainingAmount > 0);

        return result;
    }
}
