import { DependencyContainer, Lifecycle } from "tsyringe";

import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";

import { UndaWavesGenerator } from "./UndaWavesGenerator";

export class Unda implements IPreSptLoadMod, IPostSptLoadMod {
    constructor() {}

    preSptLoad(container: DependencyContainer): void {
        container.register<UndaWavesGenerator>(
            "PmcWaveGenerator",
            UndaWavesGenerator,
            {
                lifecycle: Lifecycle.Singleton,
            }
        );
    }

    postSptLoad(container: DependencyContainer): void {
        const wavesGenerator =
            container.resolve<UndaWavesGenerator>("PmcWaveGenerator");
        wavesGenerator.fillInitialData();
    }
}

module.exports = { mod: new Unda() };
