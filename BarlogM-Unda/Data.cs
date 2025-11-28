using System.Collections.Frozen;
using System.Text.Json;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.DI;
using SPTarkov.Server.Core.Models.Eft.Common;
using SPTarkov.Server.Core.Models.Logging;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Services;

namespace BarlogM_Unda;

[Injectable(InjectionType.Singleton, TypePriority = OnLoadOrder.PostSptModLoader + 1)]
public class Data(
    ISptLogger<Data> logger,
    DatabaseService databaseService,
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

    private readonly ModConfig _modConfig = modData.ModConfig;
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

            var allNamedZones = GetLocationZones(locationId, location.Base);
            var zones = ReviewZones(allNamedZones);

            MakeAllZonesOpen(location, zones);

            var minPlayers = GetLocationMinPlayers(location.Base);

            var maxPlayers = GetLocationMaxPlayers(location.Base);

            GeneralLocationInfo[locationId] = new GeneralLocationInfo
            {
                MinPlayers = minPlayers,
                MaxPlayers = maxPlayers,
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

    int GetLocationMinPlayers(LocationBase locationBase)
    {
        return locationBase.MinPlayers ?? 6;
    }

    int GetLocationMaxPlayers(LocationBase locationBase)
    {
        return locationBase.MaxPlayers ?? 8;
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

    void MakeAllZonesOpen(Location location, List<string> zones)
    {
        location.Base.OpenZones = string.Join(",", zones);
    }
}
