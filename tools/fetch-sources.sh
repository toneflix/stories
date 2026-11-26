#!/usr/bin/env bash
# Downloads the CC0 source packs into .sources/ (git-ignored). Only needed to
# re-run tools/prepare-assets.mjs; the prepared .glb files are committed.
#
# Originals (all by Quaternius, CC0 1.0): https://quaternius.com
#   Universal Base Characters [Standard], Universal Animation Library 1 & 2 [Standard],
#   Modular Character Outfits - Fantasy.
# Fetched from public GitHub mirrors because quaternius.com / itch.io are not reachable
# from our build sandbox. Swap in the official downloads if you have them.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .sources/ubc .sources/ual .sources/outfits .sources/hair
raw() { curl -fsSL --retry 3 -o "$2" "$1"; }

M=https://raw.githubusercontent.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender/main
UBC="$M/Universal%20Base%20Characters%5BStandard%5D/Universal%20Base%20Characters%5BStandard%5D/Base%20Characters/Godot%20-%20UE"
for f in Superhero_Female_FullBody.gltf Superhero_Female_FullBody.bin Superhero_Male_FullBody.gltf Superhero_Male_FullBody.bin \
         T_Eye_Brown.png T_Hair_1_BaseColor.png T_Hair_2_BaseColor.png T_Superhero_Female_Dark_BaseColor.png T_Superhero_Male_Dark.png; do
  raw "$UBC/$f" ".sources/ubc/$f"
done
raw "$M/Universal%20Base%20Characters%5BStandard%5D/Universal%20Base%20Characters%5BStandard%5D/License_Standard.txt" .sources/ubc/License.txt
HAIR="$M/Universal%20Base%20Characters%5BStandard%5D/Universal%20Base%20Characters%5BStandard%5D/Hairstyles/Origin%20at%200/glTF%20(Godot)"
for f in Hair_Buns Hair_Beard Hair_Buzzed Hair_Long; do
  raw "$HAIR/$f.gltf" ".sources/hair/$f.gltf"; raw "$HAIR/$f.bin" ".sources/hair/$f.bin"
done
raw "$HAIR/T_Hair_1_BaseColor.png" .sources/hair/T_Hair_1_BaseColor.png
raw "$HAIR/T_Hair_2_BaseColor.png" .sources/hair/T_Hair_2_BaseColor.png
raw "$M/Universal%20Animation%20Library%5BStandard%5D/Universal%20Animation%20Library%5BStandard%5D/Unreal-Godot/UAL1_Standard.glb" .sources/ual/UAL1_Standard.glb
raw "$M/Universal%20Animation%20Library%202%5BStandard%5D/Universal%20Animation%20Library%202%5BStandard%5D/Unreal-Godot/UAL2_Standard.glb" .sources/ual/UAL2_Standard.glb
raw "$M/Universal%20Animation%20Library%202%5BStandard%5D/Universal%20Animation%20Library%202%5BStandard%5D/License.txt" .sources/ual/License.txt

O=https://raw.githubusercontent.com/254684589-max/ooglex-site/main/games/ironcrown/godot/assets/characters/outfits
for f in Outfit_Female_Peasant.gltf Outfit_Female_Peasant.bin Outfit_Male_Peasant.gltf Outfit_Male_Peasant.bin \
         Outfit_Female_Ranger.gltf Outfit_Female_Ranger.bin Outfit_Male_Ranger.gltf Outfit_Male_Ranger.bin \
         T_Peasant_BaseColor.png T_Ranger_BaseColor.png T_Regular_Male_Dark_BaseColor.png; do
  raw "$O/$f" ".sources/outfits/$f"
done
echo "sources ready in .sources/"

# Realistic props (CC BY 4.0, credited in assets/CREDITS.md), from the Objaverse 1.0
# snapshot of Sketchfab on Hugging Face (allenai/objaverse).
mkdir -p .sources/props
OBJ=https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs
raw "$OBJ/000-061/a08d416576c64bec96b10fd889d6d274.glb" .sources/props/vw-t3.glb
raw "$OBJ/000-075/dd400ed693cf416e940c5b8e3107205e.glb" .sources/props/old-residential.glb
raw "$OBJ/000-056/e2b6f532e1fe4f7280890971d78183f4.glb" .sources/props/modular-slums.glb
raw "$OBJ/000-008/e902e0af80804d01924387da6af8eecf.glb" .sources/props/slum-house.glb

# Realistic people (MIT): Microsoft Rocketbox avatars and animations, from GitHub.
# Only the files we use are checked out (the full repository is several GB).
RB=.sources/rocketbox/repo
if [ ! -d "$RB" ]; then
  git clone -q --filter=blob:none --no-checkout --depth 1 https://github.com/microsoft/Microsoft-Rocketbox.git "$RB"
fi
AV=Assets/Avatars/Adults; ST=Assets/Animations/all_animations_max_motextr_static; XY=Assets/Animations/all_animations_max_motextr_xy
ANIMS="$ST/m_sit_chair_idle_neutral_01.max.fbx $ST/m_sit_chair_gestic_shrug_01.max.fbx $ST/m_idle_neutral_01.max.fbx $ST/f_sit_chair_idle_neutral_01.max.fbx $ST/f_sit_chair_gestic_shrug_01.max.fbx $ST/f_idle_neutral_01.max.fbx $ST/f_wave_01.max.fbx $XY/f_walk_neutral_01.max.fbx"
git -C "$RB" sparse-checkout set --no-cone "$AV/Male_Adult_12/Export/Male_Adult_12.fbx" "$AV/Male_Adult_12/Textures/*" "$AV/Female_Party_02/Export/Female_Party_02.fbx" "$AV/Female_Party_02/Textures/*" $ANIMS
git -C "$RB" checkout -q HEAD
mkdir -p .sources/rocketbox/avatars .sources/rocketbox/anims
for a in Male_Adult_12 Female_Party_02; do
  mkdir -p ".sources/rocketbox/avatars/$a"
  cp "$RB/$AV/$a/Export/$a.fbx" ".sources/rocketbox/avatars/$a/"
  cp -r "$RB/$AV/$a/Textures" ".sources/rocketbox/avatars/$a/"
done
for f in $ANIMS; do cp "$RB/$f" .sources/rocketbox/anims/; done
