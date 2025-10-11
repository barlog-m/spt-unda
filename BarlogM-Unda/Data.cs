using System.Collections.Frozen;
using System.Text.Json;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.DI;
using SPTarkov.Server.Core.Models.Eft.Common;
using SPTarkov.Server.Core.Models.Logging;
using SPTarkov.Server.Core.Models.Spt.Config;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Servers;
using SPTarkov.Server.Core.Services;
using SPTarkov.Server.Core.Utils;

namespace BarlogM_Unda;

[Injectable(InjectionType.Singleton, TypePriority = OnLoadOrder.PostSptModLoader + 1)]
public class Data(
    ISptLogger<Data> logger,
    DatabaseService databaseService,
    ConfigServer configServer,
    RandomUtil randomUtil,
    ModData modData
) : IOnLoad
{
    public static readonly FrozenSet<string> AllMaps =
    [
        "bigmap",
        "factory4_day",
        "factory4_night",
        "interchange",
        "laboratory",
        "lighthouse",
        "rezervbase",
        "shoreline",
        "tarkovstreets",
        "labyrinth",
        "woods",
        "sandbox",
        "sandbox_high"
    ];

    public static readonly FrozenSet<string> SmallMaps =
    [
        "factory4_day",
        "factory4_night",
        "laboratory",
        "rezervbase",
    ];

    static readonly FrozenSet<string> MapsWithDoubleMarksmans =
        ["shoreline", "tarkovstreets"];

    private readonly ModConfig _modConfig = modData.ModConfig;
    private readonly BotConfig botConfig = configServer.GetConfig<BotConfig>();
    public readonly Dictionary<string, GeneralLocationInfo>
        GeneralLocationInfo = new();

    public Task OnLoad()
    {
        FillInitialData();
        return Task.CompletedTask;
    }

    private void FillInitialData()
    {
        foreach (var locationId in AllMaps)
        {
            var location = databaseService.GetLocation(locationId);

            var marksmanZones = GetAllMarksmanSpawnZones(location.Base);

            var allNamedZones = GetLocationZones(locationId, location.Base);
            var zones = ReviewZones(allNamedZones);

            //if (locationId == "tarkovstreets")
            MakeAllZonesOpen(location, zones);

            var minPlayers = GetLocationMinPlayers(location.Base);

            var maxPlayers = GetLocationMaxPlayers(location.Base);

            var maxMarksmans =
                GetLocationMaxMarksmans(locationId, marksmanZones.Count);

            var maxBots = GetLocationMaxBots(locationId, location.Base);
            var maxScavs = maxBots - maxMarksmans;

            GeneralLocationInfo[locationId] = new GeneralLocationInfo
            {
                MarksmanZones = marksmanZones,
                Zones = zones,
                MaxBots = maxBots,
                MinPlayers = minPlayers,
                MaxPlayers = maxPlayers,
                MaxMarksmans = maxMarksmans,
                MaxScavs = maxScavs
            };
        }

        if (_modConfig.Debug)
        {
            logger.LogWithColor(
                $"[Unda] generalLocationInfo: {JsonSerializer.Serialize(GeneralLocationInfo)}",
                LogTextColor.Blue);
        }
    }

    private List<string> ReviewZones(HashSet<string> allNamedZones)
    {
        if (allNamedZones.Count <= 5)
        {
            var zones = allNamedZones.ToList();

            for (var i = 0; i < 9; i++)
            {
                zones.Add("BotZone");
            }

            return zones;
        }

        return allNamedZones.ToList();
    }

    int GetLocationMaxBots(string locationId, LocationBase locationBase)
    {
        var maxBots = locationBase.BotMax;

        if (maxBots <= 0)
        {
            return botConfig.MaxBotCap[locationId];
        }

        return maxBots;
    }

    int GetLocationMaxMarksmans(string locationId,
        int marksmansLocationAmount)
    {
        if (MapsWithDoubleMarksmans.Contains(locationId))
        {
            return marksmansLocationAmount * 2;
        }

        return marksmansLocationAmount;
    }

    int GetLocationMinPlayers(LocationBase locationBase)
    {
        return locationBase.MinPlayers ?? 8;
    }

    int GetLocationMaxPlayers(LocationBase locationBase)
    {
        return locationBase.MaxPlayers ?? 10;
    }

    HashSet<string> GetLocationZones(string locationId,
        LocationBase locationBase)
    {
        if (locationId == "laboratory")
        {
            return GetLocationZonesLabs(locationBase);
        }

        return GetAllSpawnZonesExceptMarksman(locationBase);
    }

    HashSet<string> GetLocationZonesLabs(LocationBase locationBase)
    {
        HashSet<string> zones = new();

        foreach (var spawnPointParam in locationBase.SpawnPointParams)
        {
            if (string.IsNullOrEmpty(spawnPointParam.BotZoneName)) continue;

            if (spawnPointParam.BotZoneName.Contains("Gate")) continue;

            zones.Add(spawnPointParam.BotZoneName);
        }

        return zones;
    }

    HashSet<string> GetAllSpawnZonesExceptMarksman(LocationBase locationBase)
    {
        HashSet<string> zones = new();

        foreach (var spawnPointParam in locationBase.SpawnPointParams)
        {
            if (string.IsNullOrEmpty(spawnPointParam.BotZoneName)) continue;

            if (spawnPointParam.BotZoneName.Contains("Snipe")) continue;

            zones.Add(spawnPointParam.BotZoneName);
        }

        return zones;
    }

    HashSet<string> GetAllMarksmanSpawnZones(LocationBase locationBase)
    {
        HashSet<string> zones = new();

        foreach (var spawnPointParam in locationBase.SpawnPointParams)
        {
            if (string.IsNullOrEmpty(spawnPointParam.BotZoneName)) continue;

            if (spawnPointParam.BotZoneName.Contains("Snipe"))
            {
                zones.Add(spawnPointParam.BotZoneName);
            }
        }

        return zones;
    }

    void MakeAllZonesOpen(Location location, List<string> zones)
    {
        location.Base.OpenZones = string.Join(",", zones);
    }
}
