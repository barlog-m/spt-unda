using System.Reflection;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Helpers;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Utils;

namespace BarlogM_Unda;

[Injectable]
public class ModData
{
    public readonly ModConfig ModConfig;
    public readonly string PathToMod;

    public ModData(ISptLogger<ModData> logger, ModHelper modHelper, JsonUtil jsonUtil)
    {
        PathToMod =
            modHelper.GetAbsolutePathToModFolder(Assembly.GetExecutingAssembly());

        var pathToConfig = Path.Join(PathToMod, "config");
        ModConfig = jsonUtil.Deserialize<ModConfig>(
            modHelper.GetRawFileData(pathToConfig, "config.json"));
    }
}
