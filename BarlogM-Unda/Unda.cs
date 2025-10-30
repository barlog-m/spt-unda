using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.DI;
using SPTarkov.Server.Core.Models.Spt.Mod;
using SPTarkov.Server.Core.Models.Utils;

namespace BarlogM_Unda;

public record ModMetadata : AbstractModMetadata
{
    public override string ModGuid { get; init; } = "li.barlog.unda";
    public override string Name { get; init; } = "Unda";
    public override string Author { get; init; } = "Barlog_M";
    public override List<string>? Contributors { get; init; }
    public override SemanticVersioning.Version Version { get; init; } = new("2.0.1");
    public override SemanticVersioning.Range SptVersion { get; init; } = new("~4.0.0");
    public override List<string>? Incompatibilities { get; init; }
    public override Dictionary<string, SemanticVersioning.Range>? ModDependencies { get; init; }
    public override string? Url { get; init; } = "https://github.com/barlog-m/spt-unda";
    public override bool? IsBundleMod { get; init; } = false;
    public override string? License { get; init; } = "MIT";
}

[Injectable(InjectionType.Singleton, TypePriority = OnLoadOrder.PostSptModLoader + 1)]
public class Unda(ISptLogger<Unda> logger) : IOnLoad
{
    public Task OnLoad()
    {
        return Task.CompletedTask;
    }
}
