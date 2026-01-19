--[[
  Block Mapping for LittleIsland Schematic
  Maps all 197 Minecraft block names from the LittleIsland schematic to Roblox block types

  This mapping can be customized to match your Roblox voxel engine's block type system.
  Each Minecraft block name is mapped to a corresponding Roblox block type identifier.
]]

local BlockMapping = {}

-- Helper function to get base block name (without states)
local function getBaseName(blockName)
  return blockName:match("^([^%[]+)") or blockName
end

-- Helper function to normalize block names (group variants together)
local function normalizeBlockName(blockName)
  local base = getBaseName(blockName)

  -- Group all stairs variants
  if base:match("_stairs$") then
    return base -- e.g., "oak_stairs", "stone_stairs"
  end

  -- Group all slab variants
  if base:match("_slab$") then
    return base -- e.g., "oak_slab", "stone_slab"
  end

  -- Group all log variants (axis doesn't matter for mapping)
  if base:match("_log$") then
    return base -- e.g., "oak_log", "spruce_log"
  end

  -- Return full name for blocks where states matter
  return blockName
end

-- Complete mapping of all 197 blocks from LittleIsland schematic
BlockMapping.Mapping = {
  -- Wool blocks
  ["gray_wool"] = "Wool_Gray",
  ["light_gray_wool"] = "Wool_LightGray",
  ["green_wool"] = "Wool_Green",
  ["orange_wool"] = "Wool_Orange",
  ["red_wool"] = "Wool_Red",
  ["white_wool"] = "Wool_White",
  ["brown_wool"] = "Wool_Brown",

  -- Terracotta blocks
  ["cyan_terracotta"] = "Terracotta_Cyan",
  ["orange_terracotta"] = "Terracotta_Orange",
  ["green_terracotta"] = "Terracotta_Green",
  ["yellow_terracotta"] = "Terracotta_Yellow",
  ["red_terracotta"] = "Terracotta_Red",
  ["brown_terracotta"] = "Terracotta_Brown",
  ["hardened_clay"] = "Terracotta",

  -- Logs
  ["acacia_log"] = "Log_Acacia",
  ["oak_log"] = "Log_Oak",
  ["oak_log[a=y]"] = "Log_Oak",
  ["oak_log[a=x]"] = "Log_Oak",
  ["oak_log[a=z]"] = "Log_Oak",
  ["spruce_log[a=z]"] = "Log_Spruce",

  -- Stone variants
  ["andesite"] = "Stone_Andesite",
  ["diorite"] = "Stone_Diorite",
  ["polished_andesite"] = "Stone_PolishedAndesite",
  ["stone"] = "Stone",
  ["cobblestone"] = "Stone_Cobblestone",
  ["mossy_cobblestone"] = "Stone_MossyCobblestone",
  ["stone_bricks"] = "Stone_Bricks",
  ["obsidian"] = "Obsidian",

  -- Leaves
  ["oak_leaves"] = "Leaves_Oak",
  ["jungle_leaves"] = "Leaves_Jungle",
  ["birch_leaves"] = "Leaves_Birch",
  ["spruce_leaves"] = "Leaves_Spruce",

  -- Dirt/Ground blocks
  ["coarse_dirt"] = "Dirt_Coarse",
  ["dirt"] = "Dirt",
  ["grass_block"] = "Grass",
  ["farmland"] = "Farmland",
  ["clay"] = "Clay",

  -- Glass blocks
  ["green_stained_glass"] = "Glass_Green",
  ["light_gray_stained_glass"] = "Glass_LightGray",
  ["white_stained_glass_pane"] = "GlassPane_White",
  ["light_gray_stained_glass_pane"] = "GlassPane_LightGray",
  ["brown_stained_glass_pane"] = "GlassPane_Brown",

  -- Slime
  ["slime"] = "Slime",

  -- Plants/Vegetation
  ["red_flower"] = "Flower_Red",
  ["tall_grass"] = "Grass_Tall",
  ["lilac"] = "Flower_Lilac",
  ["rose_bush"] = "Flower_RoseBush",
  ["large_fern"] = "Fern_Large",
  ["fern"] = "Fern",
  ["wheat"] = "Crop_Wheat",

  -- Food blocks
  ["melon_block"] = "Melon",
  ["cake"] = "Cake",
  ["hay_block"] = "Hay",

  -- Wood planks
  ["spruce_planks"] = "Planks_Spruce",
  ["oak_planks"] = "Planks_Oak",
  ["acacia_planks"] = "Planks_Acacia",
  ["dark_oak_planks"] = "Planks_DarkOak",
  ["birch_planks"] = "Planks_Birch",
  ["jungle_planks"] = "Planks_Jungle",

  -- Slabs (all variants)
  ["jungle_slab[t=t]"] = "Slab_Jungle_Top",
  ["jungle_slab[t=b]"] = "Slab_Jungle_Bottom",
  ["jungle_slab"] = "Slab_Jungle",
  ["spruce_slab[t=t]"] = "Slab_Spruce_Top",
  ["spruce_slab[t=b]"] = "Slab_Spruce_Bottom",
  ["stone_brick_slab[t=t]"] = "Slab_StoneBrick_Top",
  ["stone_brick_slab[t=b]"] = "Slab_StoneBrick_Bottom",
  ["stone_brick_slab"] = "Slab_StoneBrick",
  ["stone_slab[t=b]"] = "Slab_Stone_Bottom",
  ["stone_slab"] = "Slab_Stone",
  ["cobblestone_slab[t=b]"] = "Slab_Cobblestone_Bottom",
  ["cobblestone_slab[t=t]"] = "Slab_Cobblestone_Top",
  ["dark_oak_slab[t=b]"] = "Slab_DarkOak_Bottom",
  ["birch_slab[t=t]"] = "Slab_Birch_Top",
  ["acacia_slab[t=t]"] = "Slab_Acacia_Top",

  -- Stairs (all variants - grouped by material)
  ["stone_brick_stairs[f=w,h=b]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=n,h=b]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=e,h=b]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=s,h=b]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=w,h=t]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=e,h=t]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=n,h=t]"] = "Stairs_StoneBrick",
  ["stone_brick_stairs[f=s,h=t]"] = "Stairs_StoneBrick",

  ["dark_oak_stairs[f=e,h=t]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=w,h=b]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=s,h=t]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=n,h=b]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=s,h=b]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=n,h=t]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=e,h=b]"] = "Stairs_DarkOak",
  ["dark_oak_stairs[f=w,h=t]"] = "Stairs_DarkOak",

  ["spruce_stairs[f=s,h=t]"] = "Stairs_Spruce",
  ["spruce_stairs[f=n,h=b]"] = "Stairs_Spruce",
  ["spruce_stairs[f=n,h=t]"] = "Stairs_Spruce",
  ["spruce_stairs[f=w,h=b]"] = "Stairs_Spruce",
  ["spruce_stairs[f=s,h=b]"] = "Stairs_Spruce",
  ["spruce_stairs[f=e,h=b]"] = "Stairs_Spruce",
  ["spruce_stairs[f=e,h=t]"] = "Stairs_Spruce",
  ["spruce_stairs[f=w,h=t]"] = "Stairs_Spruce",

  ["stone_stairs[f=w,h=b]"] = "Stairs_Stone",
  ["stone_stairs[f=e,h=b]"] = "Stairs_Stone",
  ["stone_stairs[f=e,h=t]"] = "Stairs_Stone",
  ["stone_stairs[f=w,h=t]"] = "Stairs_Stone",
  ["stone_stairs[f=n,h=b]"] = "Stairs_Stone",
  ["stone_stairs[f=s,h=b]"] = "Stairs_Stone",
  ["stone_stairs[f=n,h=t]"] = "Stairs_Stone",
  ["stone_stairs[f=s,h=t]"] = "Stairs_Stone",

  ["sandstone_stairs[f=s,h=b]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=e,h=b]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=w,h=b]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=n,h=b]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=n,h=t]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=e,h=t]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=s,h=t]"] = "Stairs_Sandstone",
  ["sandstone_stairs[f=w,h=t]"] = "Stairs_Sandstone",

  ["brick_stairs[f=n,h=b]"] = "Stairs_Brick",
  ["brick_stairs[f=w,h=t]"] = "Stairs_Brick",
  ["brick_stairs[f=e,h=t]"] = "Stairs_Brick",
  ["brick_stairs[f=e,h=b]"] = "Stairs_Brick",
  ["brick_stairs[f=s,h=t]"] = "Stairs_Brick",
  ["brick_stairs[f=w,h=b]"] = "Stairs_Brick",
  ["brick_stairs[f=s,h=b]"] = "Stairs_Brick",

  ["oak_stairs[f=e,h=b]"] = "Stairs_Oak",
  ["oak_stairs[f=s,h=b]"] = "Stairs_Oak",
  ["oak_stairs[f=w,h=b]"] = "Stairs_Oak",
  ["oak_stairs[f=n,h=b]"] = "Stairs_Oak",
  ["oak_stairs[f=s,h=t]"] = "Stairs_Oak",
  ["oak_stairs[f=e,h=t]"] = "Stairs_Oak",
  ["oak_stairs[f=w,h=t]"] = "Stairs_Oak",
  ["oak_stairs[f=n,h=t]"] = "Stairs_Oak",

  ["birch_stairs[f=w,h=t]"] = "Stairs_Birch",
  ["birch_stairs[f=e,h=t]"] = "Stairs_Birch",
  ["birch_stairs[f=s,h=t]"] = "Stairs_Birch",
  ["birch_stairs[f=n,h=t]"] = "Stairs_Birch",

  ["jungle_stairs[f=n,h=b]"] = "Stairs_Jungle",
  ["jungle_stairs[f=s,h=b]"] = "Stairs_Jungle",
  ["jungle_stairs[f=w,h=b]"] = "Stairs_Jungle",
  ["jungle_stairs[f=e,h=b]"] = "Stairs_Jungle",

  -- Fences
  ["spruce_fence"] = "Fence_Spruce",
  ["dark_oak_fence"] = "Fence_DarkOak",
  ["fence"] = "Fence_Oak",
  ["nether_brick_fence"] = "Fence_NetherBrick",
  ["jungle_fence"] = "Fence_Jungle",

  -- Fence gates
  ["spruce_fence_gate"] = "FenceGate_Spruce",
  ["fence_gate"] = "FenceGate_Oak",

  -- Doors
  ["spruce_door"] = "Door_Spruce",
  ["jungle_door"] = "Door_Jungle",
  ["dark_oak_door"] = "Door_DarkOak",

  -- Other blocks
  ["brown_mushroom_block"] = "MushroomBlock_Brown",
  ["cauldron"] = "Cauldron",
  ["cobblestone_wall"] = "Wall_Cobblestone",
  ["bookshelf"] = "Bookshelf",
  ["trapdoor"] = "Trapdoor",
  ["iron_trapdoor"] = "Trapdoor_Iron",
  ["very_damaged_anvil"] = "Anvil_VeryDamaged",
  ["slightly_damaged_anvil"] = "Anvil_SlightlyDamaged",
  ["anvil"] = "Anvil",
  ["chest"] = "Chest",
  ["ender_chest"] = "Chest_Ender",
  ["end_portal_frame"] = "EndPortalFrame",
  ["brick_block"] = "Brick",
  ["light_weighted_pressure_plate"] = "PressurePlate_Light",
  ["heavy_weighted_pressure_plate"] = "PressurePlate_Heavy",
  ["wooden_pressure_plate"] = "PressurePlate_Wooden",
  ["light_gray_concrete_powder"] = "ConcretePowder_LightGray",
  ["red_concrete"] = "Concrete_Red",
  ["black_concrete"] = "Concrete_Black",
  ["hopper"] = "Hopper",
  ["furnace"] = "Furnace",
  ["torch"] = "Torch",
  ["detector_rail"] = "Rail_Detector",
  ["wall_sign"] = "Sign_Wall",
  ["gray_carpet"] = "Carpet_Gray",
  ["light_gray_carpet"] = "Carpet_LightGray",
  ["red_carpet"] = "Carpet_Red",
  ["white_carpet"] = "Carpet_White",
  ["netherrack"] = "Netherrack",
  ["stone_button"] = "Button_Stone",
  ["wooden_button"] = "Button_Wooden",
  ["smooth_sandstone"] = "Sandstone_Smooth",
  ["sandstone"] = "Sandstone",
  ["ladder"] = "Ladder",
  ["flower_pot"] = "FlowerPot",
  ["iron_bars"] = "IronBars",
  ["bed"] = "Bed",
  ["tripwire_hook"] = "TripwireHook",
  ["barrier"] = "Barrier",
  ["crafting_table"] = "CraftingTable",
  ["wall_banner"] = "Banner_Wall",
  ["enchanting_table"] = "EnchantingTable",
  ["web"] = "Web",
  ["fire"] = "Fire",
  ["snow_layer"] = "Snow_Layer",
  ["beacon"] = "Beacon",
  ["lit_redstone_lamp"] = "RedstoneLamp_Lit",
  ["redstone_block"] = "RedstoneBlock",
  ["daylight_detector"] = "DaylightDetector",
  ["piston_head"] = "PistonHead",
}

-- Simplified mapping (groups variants together)
BlockMapping.SimplifiedMapping = {}
for minecraftName, robloxType in pairs(BlockMapping.Mapping) do
  local baseName = normalizeBlockName(minecraftName)
  if not BlockMapping.SimplifiedMapping[baseName] then
    BlockMapping.SimplifiedMapping[baseName] = robloxType
  end
end

-- Get mapping for a Minecraft block name
function BlockMapping:Get(minecraftBlockName)
  return self.Mapping[minecraftBlockName] or self.SimplifiedMapping[normalizeBlockName(minecraftBlockName)] or "Block_Unknown"
end

-- Get all unique block types used in this schematic
function BlockMapping:GetAllBlockTypes()
  local types = {}
  for _, robloxType in pairs(self.Mapping) do
    types[robloxType] = true
  end
  return types
end

-- Get count of unique block types
function BlockMapping:GetBlockTypeCount()
  local count = 0
  for _ in pairs(self:GetAllBlockTypes()) do
    count = count + 1
  end
  return count
end

return BlockMapping
