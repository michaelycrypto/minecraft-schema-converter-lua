# LittleIsland Schematic Block Mapping

## Overview
This document describes the block mapping for the **LittleIsland** Minecraft schematic. All 197 unique block types found in the schematic have been mapped to Roblox block type identifiers.

## Files Generated

1. **LittleIsland_BlockMapping.lua** - Complete Lua module with mapping functions
2. **LittleIsland_BlockMapping.json** - JSON format mapping for easy integration

## Statistics

- **Total Blocks in Schematic**: 130,549 blocks
- **Unique Block Types**: 197 different Minecraft block names
- **Schematic Dimensions**: 202 x 136 x 166 (width x height x length)
- **Chunks**: 59 chunks
- **Mapping Coverage**: 100% (all blocks mapped)

## Block Categories

The mapping organizes blocks into logical categories:

### Building Materials
- **Stone variants**: Stone, Cobblestone, Stone Bricks, Andesite, Diorite, etc.
- **Wood planks**: Oak, Spruce, Birch, Jungle, Acacia, Dark Oak
- **Terracotta**: Various colored terracotta blocks
- **Bricks**: Brick blocks and brick stairs

### Decorative Blocks
- **Wool**: 7 different colors (gray, light gray, green, orange, red, white, brown)
- **Carpets**: 4 different colors
- **Glass**: Stained glass and glass panes
- **Concrete**: Red and black concrete

### Natural Blocks
- **Dirt/Ground**: Dirt, Coarse Dirt, Grass Block, Farmland, Clay
- **Leaves**: Oak, Spruce, Birch, Jungle leaves
- **Logs**: Oak, Spruce, Acacia logs (various axis orientations)
- **Sandstone**: Regular and smooth sandstone

### Functional Blocks
- **Doors**: Spruce, Jungle, Dark Oak doors
- **Fences**: Various wood types and Nether Brick
- **Stairs**: Multiple materials with all facing/half combinations
- **Slabs**: Various materials with top/bottom variants
- **Chests**: Regular and Ender chests
- **Furnaces**: Furnace block
- **Crafting Tables**: Crafting table
- **Anvils**: Regular, slightly damaged, very damaged

### Special Blocks
- **Redstone**: Redstone block, lit redstone lamp, daylight detector
- **Beacon**: Beacon block
- **Obsidian**: Obsidian
- **Netherrack**: Netherrack
- **End Portal Frame**: End portal frame
- **Barrier**: Barrier block

### Plants & Vegetation
- **Flowers**: Red flower, Lilac, Rose bush
- **Grass**: Tall grass, Fern, Large fern
- **Crops**: Wheat
- **Food**: Melon, Cake, Hay

### Other Blocks
- **Torches**: Torch
- **Ladders**: Ladder
- **Signs**: Wall sign, Wall banner
- **Buttons**: Stone and wooden buttons
- **Pressure Plates**: Light, heavy, and wooden pressure plates
- **Rails**: Detector rail
- **Misc**: Web, Fire, Snow layer, Slime, etc.

## Usage Examples

### Lua Usage

```lua
local BlockMapping = require("LittleIsland_BlockMapping")

-- Get Roblox block type for a Minecraft block name
local robloxType = BlockMapping:Get("oak_planks")
-- Returns: "Planks_Oak"

-- Get all unique block types
local allTypes = BlockMapping:GetAllBlockTypes()

-- Get count of unique types
local count = BlockMapping:GetBlockTypeCount()
```

### JSON Usage

```lua
local HttpService = game:GetService("HttpService")
local mapping = HttpService:JSONDecode(FileContent)

-- Get Roblox block type
local robloxType = mapping["oak_planks"]
-- Returns: "Planks_Oak"
```

### Integration with World Importer

```lua
local WorldImporter = require("WorldImporter")
local BlockMapping = require("LittleIsland_BlockMapping")
local buildData = require("LittleIsland")

function WorldImporter.import(buildData, worldManager)
    local palette = buildData.palette
    local chunks = buildData.chunks

    for chunkKey, columns in pairs(chunks) do
        -- ... chunk processing ...
        for colKey, runs in pairs(columns) do
            for _, run in ipairs(runs) do
                local blockName = palette[run[3]]  -- RLE format
                local robloxBlockType = BlockMapping:Get(blockName)

                if robloxBlockType ~= "Block_Unknown" then
                    -- Place block in Roblox world
                    worldManager:SetBlock(worldX, y, worldZ, robloxBlockType)
                end
            end
        end
    end
end
```

## Block Type Naming Convention

The mapping uses a consistent naming convention:

- **Category_Material**: `Wool_Gray`, `Terracotta_Cyan`, `Planks_Oak`
- **Category_Material_Variant**: `Slab_Jungle_Top`, `Anvil_VeryDamaged`
- **Simple names**: `Stone`, `Dirt`, `Grass`, `Chest`

### Grouped Variants

Some block variants are grouped together:
- **Stairs**: All facing/half combinations map to the same base type (e.g., all `oak_stairs` variants → `Stairs_Oak`)
- **Logs**: All axis orientations map to the same base type (e.g., `oak_log[a=y]` → `Log_Oak`)
- **Slabs**: Top/bottom variants are distinguished (e.g., `jungle_slab[t=t]` → `Slab_Jungle_Top`)

## Customization

To customize the mapping for your Roblox voxel engine:

1. Edit `LittleIsland_BlockMapping.lua` and modify the `BlockMapping.Mapping` table
2. Replace Roblox block type strings with your engine's block identifiers
3. Regenerate JSON if needed using `node generate_mapping_json.js`

## Notes

- All 197 blocks from the LittleIsland schematic are mapped
- Block states (facing, half, etc.) are preserved in the mapping where relevant
- Unknown blocks will map to `Block_Unknown` (none in this schematic)
- The mapping is case-sensitive for Minecraft block names

## Files

- `LittleIsland.schematic` - Original Minecraft schematic
- `output/LittleIsland.lua` - Converted schematic data
- `LittleIsland_BlockMapping.lua` - Lua mapping module
- `LittleIsland_BlockMapping.json` - JSON mapping file
- `LittleIsland_Mapping_Summary.md` - This document
