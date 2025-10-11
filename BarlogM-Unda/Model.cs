namespace BarlogM_Unda;

public class ZoneGroupSize
{
    public string ZoneName { get; set; }
    public int GroupSize { get; set; }
}

public class GeneralLocationInfo
{
    public HashSet<string> MarksmanZones { get; set; } = new();
    public List<string> Zones { get; set; } = new();
    public int MaxBots { get; set; }
    public int MinPlayers { get; set; }
    public int MaxPlayers { get; set; }
    public int MaxMarksmans { get; set; }
    public int MaxScavs { get; set; }
}

