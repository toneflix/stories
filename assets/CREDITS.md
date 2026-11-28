# Asset credits

Everything here is free to use commercially. The prepared files live in `public/assets/`.

| Asset | Author | License | Used for |
| --- | --- | --- | --- |
| Universal Base Characters [Standard] | [Quaternius](https://quaternius.com) | CC0 1.0 | Pip's body, face and hair (`pip-body.glb`, `hair-buns.glb`) |
| Modular Character Outfits (Peasant) | [Quaternius](https://quaternius.com) | CC0 1.0 | Pip's clothes (`pip-outfit.glb`) |
| Universal Animation Library 1 & 2 [Standard] | [Quaternius](https://quaternius.com) | CC0 1.0 | Pip's animation (`ual1.glb`, `ual2.glb`) |
| Chatterbox TTS | [Resemble AI](https://github.com/resemble-ai/chatterbox) | MIT | Narration |
| Voice reference `narrator.wav`: LibriTTS-R speaker 652 | Koizumi et al., from [LibriVox](https://librivox.org) (public domain) | CC BY 4.0 | Narrator voice |
| Voice reference `narrator-alt.wav`: Hi-Fi TTS speaker 9017 | Bakhturina et al., from [LibriVox](https://librivox.org) (public domain) | CC BY 4.0 | Alternative narrator voice, Baba Ayo in Route 7 |
| Voice reference `passenger.wav`: Hi-Fi TTS speaker 92 | Bakhturina et al., from [LibriVox](https://librivox.org) (public domain) | CC BY 4.0 | The passenger in Route 7 |
| Microsoft Rocketbox avatars `Male_Adult_12`, `Female_Party_02` and animations | [Microsoft](https://github.com/microsoft/Microsoft-Rocketbox) | MIT | Baba Ayo and the passenger in Route 7 (`rb-*.glb`) |
| Microsoft Rocketbox animations and the `Business_Female_01` skeleton | [Microsoft](https://github.com/microsoft/Microsoft-Rocketbox) | MIT | How the woman in The Other Lamp moves (`rb-neighbour-*.glb`) |
| "African Makehuman Character with PBR Textures" | [mertbbicak](https://sketchfab.com/3d-models/1a88f2e4a0724c639e81e6fe92587b9c) | CC BY 4.0 | The woman in The Other Lamp (`characters/neighbour.glb`, rigged with `tools/skin-transfer.mjs`) |
| "Volkswagen T3" | [art_yom_3d](https://sketchfab.com/3d-models/a08d416576c64bec96b10fd889d6d274) | CC BY 4.0 | The danfo in Route 7 (`props/vw-t3.glb`) |
| "Old Residential Building [4k]" | [andrej.grave](https://sketchfab.com/3d-models/dd400ed693cf416e940c5b8e3107205e) | CC BY 4.0 | Route 7 street, The Other Lamp street (`props/old-residential.glb`) |
| "Modular Slums" | [lexferreira89](https://sketchfab.com/3d-models/e2b6f532e1fe4f7280890971d78183f4) | CC BY 4.0 | Route 7 street (`props/modular-slums.glb`) |
| "Slum house" | [designbureau](https://sketchfab.com/3d-models/e902e0af80804d01924387da6af8eecf) | CC BY 4.0 | Route 7 street, The Other Lamp street (`props/slum-house.glb`) |
| "Basic Clock Rigged" | [Blender3D](https://sketchfab.com/3d-models/edc8c38a80f5419092f72e8febf3598b) | CC BY 4.0 | The Other Lamp wall clock (`props/wall-clock.glb`) |
| Freesound sound 129678 | [freesound.org/s/129678](https://freesound.org/s/129678/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | Crickets in The Other Lamp (`sounds/night-crickets.mp3`) |
| Freesound sound 118959 | [freesound.org/s/118959](https://freesound.org/s/118959/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | The far-off generator in The Other Lamp (`sounds/night-crickets.mp3`) |
| Freesound sound 398977 | [freesound.org/s/398977](https://freesound.org/s/398977/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | The wall switch in The Other Lamp (`sounds/light-switch.mp3`) |
| Freesound sound 406770 | [freesound.org/s/406770](https://freesound.org/s/406770/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | The lamp's switch in The Other Lamp (`sounds/lamp-switch.mp3`) |
| Freesound sound 257456 | [freesound.org/s/257456](https://freesound.org/s/257456/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | The clock in The Other Lamp (`sounds/clock-tick.mp3`) |
| Freesound sound 146209 | [freesound.org/s/146209](https://freesound.org/s/146209/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | The street door in The Other Lamp (`sounds/street-door.mp3`) |
| Freesound sound 152976 | [freesound.org/s/152976](https://freesound.org/s/152976/), via the [FSD50K](https://zenodo.org/records/4060432) dataset | CC0 1.0 | The old door in The Other Lamp (`sounds/door-creak.mp3`) |
| AmbientCG textures PaintedPlaster011, PaintedPlaster012, Tiles038, Wood060, Fabric030 | [ambientcg.com](https://ambientcg.com), via the [nyuuzyou/ambientcg](https://huggingface.co/datasets/nyuuzyou/ambientcg) mirror | CC0 1.0 | Plaster, floor tiles, wood and cloth in the flats (`textures/`) |

Made in code (no external asset): terrain, trees, village, lanterns, sky, fireflies; Route 7's flood, palms, poles and bus stops; all music and sound effects except The Other Lamp's.

Quaternius' packs were fetched from public GitHub mirrors (see `tools/fetch-sources.sh`) because the official download sites aren't reachable from our build environment. They are the free "Standard" editions; consider supporting Quaternius on Patreon.

Body textures: the dark-skin variant of the base character; the hair texture is tinted in code.
