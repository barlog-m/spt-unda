import { DependencyContainer, Lifecycle } from "tsyringe";

import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { IPostAkiLoadMod } from "@spt-aki/models/external/IPostAkiLoadMod";

import { WavesGenerator } from "./WavesGenerator";
import registerWavesGenerator from "./registerWavesGenerator";

export class Unda implements IPreAkiLoadMod, IPostAkiLoadMod {
    constructor() {}

    public preAkiLoad(container: DependencyContainer): void {
        container.register<WavesGenerator>(
            "UndaWavesGenerator",
            WavesGenerator,
            {
                lifecycle: Lifecycle.Singleton,
            }
        );

        registerWavesGenerator(container);
    }

    postAkiLoad(container: DependencyContainer): void {
        const wavesGenerator =
            container.resolve<WavesGenerator>("UndaWavesGenerator");
        wavesGenerator.fillInitialData();
        wavesGenerator.generateWaves();
    }
}

module.exports = { mod: new Unda() };
