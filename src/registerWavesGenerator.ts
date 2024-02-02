import { DependencyContainer } from "tsyringe";
import { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { WavesGenerator } from "./WavesGenerator";

export default function registerWavesGenerator(
    container: DependencyContainer
): undefined {
    const logger = container.resolve<ILogger>("WinstonLogger");
    const staticRouterModService = container.resolve<StaticRouterModService>(
        "StaticRouterModService"
    );
    const wavesGenerator =
        container.resolve<WavesGenerator>("UndaWavesGenerator");

    staticRouterModService.registerStaticRouter(
        "UndaWavesGeneratorUpdate",
        [
            {
                url: "/singleplayer/settings/getRaidTime",
                action: (_url: string, info: any, _sessionID: string, output: string) => {
                    if (info.Side.toLowerCase() === "pmc") {
                        wavesGenerator.generateWavesForPMCRaid();
                    } else {
                        wavesGenerator.generateWavesForScavRaid();
                    }
                    return output;
                },
            },
        ],
        "aki"
    );

    logger.info("[Unda] Waves generator registered");
}
