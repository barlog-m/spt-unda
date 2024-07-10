import {DependencyContainer} from "tsyringe";
import {
    StaticRouterModService
} from "@spt/services/mod/staticRouter/StaticRouterModService";
import {ILogger} from "@spt/models/spt/utils/ILogger";
import {WavesGenerator} from "./WavesGenerator";

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
                    return new Promise((resolve) => {
                        wavesGenerator.generateWaves();
                        resolve(output);
                    })
                },
            },
        ],
        "spt"
    );

    logger.info("[Unda] Waves generator registered");
}
