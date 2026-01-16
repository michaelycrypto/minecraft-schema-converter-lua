# Schema Converter

Convert Minecraft schematics into optimized Lua/JSON tables for Roblox voxel engines.

**Features:**
- ✅ RLE compression (58% smaller files)
- ✅ Compact metadata preservation (block rotation/facing)
- ✅ Multiple format support (WorldEdit, Litematica)
- ✅ Streaming parser (memory efficient)
- ✅ Deterministic output (stable chunk ordering)

## Supported Formats

- **WorldEdit Sponge v2/v3** (`.schem`) - Modern format with named blocks
- **WorldEdit Classic** (`.schematic`) - Legacy format with numeric IDs
- **Litematica** (`.litematic`) - Litematica mod format

## Setup

```bash
npm install
```

## Usage

```bash
node src/convert.js <input> <output> [options]
```

### Options

| Flag | Description |
|------|-------------|
| `--out lua` | Output as Lua module (default) |
| `--out json` | Output as JSON |
| `--compact` | Compact metadata (preserves states with abbreviations) |
| `--strip-states` | Strip all block states (loses rotation/facing data) |
| `--no-rle` | Disable RLE compression, use sparse format |
| `--include-air` | Include air blocks in output |
| `--stats` | Print detailed statistics |

### Examples

```bash
# Basic conversion (full block names with states)
node src/convert.js build.schem output.lua

# Compact mode - preserves metadata efficiently (recommended)
node src/convert.js build.schem output.lua --compact --stats

# Strip states - smaller palette but loses rotation/facing
node src/convert.js build.schem output.lua --strip-states

# JSON output
node src/convert.js build.schem output.json --out json --compact

# Litematica format
node src/convert.js castle.litematic castle.lua --compact --stats
```

### Block Name Modes

| Mode | Example | Palette Size | Metadata |
|------|---------|--------------|----------|
| Default | `minecraft:oak_stairs[facing=north,half=top,waterlogged=false]` | 308 | Full |
| `--compact` | `oak_stairs[f=n,h=t]` | 308 | Preserved |
| `--strip-states` | `oak_stairs` | 93 | Lost |

**Compact abbreviations:**
- **Keys**: `f`=facing, `h`=half, `s`=shape, `a`=axis, `t`=type, `d`=distance, `o`=open, `ps`=persistent
- **Values**: `n/s/e/w`=directions, `t/b`=top/bottom, `st/il/ir/ol/or`=stair shapes
- **Booleans**: `false` omitted (default), `true` → `1`

## Output Format

The converter produces a compact, chunk-based format optimized for voxel engines.

### Structure

```lua
return {
  -- Build dimensions
  size = { width = 320, height = 146, length = 197 },
  
  -- Chunk dimensions (configurable, default 16x256x16)
  chunkSize = { x = 16, y = 256, z = 16 },
  
  -- Block palette (1-indexed in Lua, 0-indexed in JSON)
  palette = {
    "minecraft:stone",
    "minecraft:dirt",
    "minecraft:grass_block[snowy=false]",
  },
  
  -- Encoding type: "rle" or "sparse"
  encoding = "rle",
  
  -- Chunks keyed by "chunkX,chunkZ"
  chunks = {
    ["0,0"] = {
      -- Columns keyed by "localX,localZ"
      ["5,3"] = {
        -- RLE: {startY, length, paletteIndex}
        {0, 3, 2},   -- 3 dirt blocks from Y=0-2
        {3, 1, 3},   -- 1 grass block at Y=3
      },
    },
  },
}
```

### Encoding Formats

**RLE (Run-Length Encoding)** - Default, best for builds with vertical runs:
```lua
-- {startY, runLength, paletteIndex}
{0, 5, 1},  -- 5 consecutive stone blocks starting at Y=0
{5, 2, 2},  -- 2 consecutive dirt blocks starting at Y=5
```

**Sparse** - Better for scattered blocks:
```lua
-- {y, paletteIndex}
{0, 1}, {1, 1}, {5, 2}, {6, 2},
```

## Roblox Importer Example

```lua
-- WorldImporter.lua
local WorldImporter = {}

function WorldImporter.import(buildData, worldManager, blockMapping)
    local palette = buildData.palette
    local chunks = buildData.chunks
    local chunkSize = buildData.chunkSize
    local isRle = buildData.encoding == "rle"
    
    local blocksPlaced = 0
    
    for chunkKey, columns in pairs(chunks) do
        local cx, cz = chunkKey:match("([^,]+),([^,]+)")
        cx, cz = tonumber(cx), tonumber(cz)
        local baseX = cx * chunkSize.x
        local baseZ = cz * chunkSize.z
        
        for colKey, runs in pairs(columns) do
            local lx, lz = colKey:match("([^,]+),([^,]+)")
            lx, lz = tonumber(lx), tonumber(lz)
            local worldX = baseX + lx
            local worldZ = baseZ + lz
            
            for _, run in ipairs(runs) do
                local blockName = palette[run[3] or run[2]]  -- RLE: idx 3, Sparse: idx 2
                local blockType = blockMapping[blockName]
                
                if blockType then
                    if isRle then
                        -- RLE: startY, length, paletteIdx
                        local startY, length = run[1], run[2]
                        for y = startY, startY + length - 1 do
                            worldManager:SetBlock(worldX, y, worldZ, blockType)
                            blocksPlaced += 1
                        end
                    else
                        -- Sparse: y, paletteIdx
                        local y = run[1]
                        worldManager:SetBlock(worldX, y, worldZ, blockType)
                        blocksPlaced += 1
                    end
                end
            end
        end
    end
    
    return blocksPlaced
end

return WorldImporter
```

## Performance Notes

### File Size Comparison (346K blocks)

| Format | Size | Notes |
|--------|------|-------|
| Original (flat stride-4) | 4.8 MB | Every block as x,y,z,idx |
| RLE Lua | **2.0 MB** | **58% smaller** - Best for voxel builds |
| Sparse Lua | 3.6 MB | 25% smaller - Good for scattered blocks |
| RLE JSON | 7.5 MB | More verbose but machine-readable |

### Memory Efficiency

- **Streaming iterator**: Blocks are parsed on-demand, not loaded into memory
- **Palette deduplication**: Block names stored once, referenced by index
- **Column-based storage**: Only non-air columns are stored
- **RLE compression**: Consecutive identical blocks compressed to single entry

### Import Performance Tips

1. **Batch block placement** using `BlockBatcher` or similar
2. **Process chunks in parallel** if your engine supports it
3. **Precompute block mapping** once before import loop
4. **Use `--compact`** for smallest file size while preserving block rotation/facing

## Chunk Coordinate System

```
World Position → Chunk + Local
(47, 80, 33)  → Chunk(2,2) + Local(15, 80, 1)

chunkX = floor(worldX / 16)
chunkZ = floor(worldZ / 16)
localX = worldX % 16
localZ = worldZ % 16
```

## Block Name Format

Block names follow Minecraft's format:
- Simple: `minecraft:stone`
- With state: `minecraft:oak_stairs[facing=north,half=top,waterlogged=false]`

Use `--compact` for efficient metadata preservation:
- `oak_stairs[f=n,h=t]` (facing=north, half=top, false values omitted)

Use `--strip-states` to remove all metadata:
- `oak_stairs` (rotation/facing lost)
