import {DependencyContainer, Lifecycle} from "tsyringe";

import {IPreSptLoadMod} from "@spt/models/external/IPreSptLoadMod";
import {IPostSptLoadMod} from "@spt/models/external/IPostSptLoadMod";

import {WavesGenerator} from "./WavesGenerator";
import registerWavesGenerator from "./registerWavesGenerator";

export class Unda implements IPreSptLoadMod, IPostSptLoadMod {
    constructor() {
    }

    preSptLoad(container: DependencyContainer): void {
        container.register<WavesGenerator>(
            "UndaWavesGenerator",
            WavesGenerator,
            {
                lifecycle: Lifecycle.Singleton,
            }
        );

        registerWavesGenerator(container);
    }

    postSptLoad(container: DependencyContainer): void {
        const wavesGenerator =
            container.resolve<WavesGenerator>("UndaWavesGenerator");
        wavesGenerator.fillInitialData();
        wavesGenerator.generateWaves();
    }
}

module.exports = {mod: new Unda()};
