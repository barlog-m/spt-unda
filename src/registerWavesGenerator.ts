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
                url: "/client/match/offline/end",
                action: (_url, _info, _sessionId, output) => {
                    wavesGenerator.generateWaves();
                    return output;
                },
            },
        ],
        "aki"
    );

    logger.info("[Unda] Waves generator registered");
}
