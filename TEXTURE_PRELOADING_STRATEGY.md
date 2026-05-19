# Texture Preloading Strategy

## Objective
Load all required textures from ServerStorage **before** placing any blocks in the world schematic. This ensures fast loading and prevents texture pop-in during block placement.

## Current Situation

### Data Flow
1. **Schematic File** (`LittleIsland1_20.lua`):
   - Contains a `palette` array with Minecraft block names (e.g., `"minecraft:gray_wool"`)
   - Contains `chunks` with block placement data
   - Format: RLE encoding with palette indices

2. **Block Mapping** (`LittleIsland_BlockMapping.lua`):
   - Maps Minecraft block names → Roblox block types (e.g., `"gray_wool"` → `"Wool_Gray"`)
   - Provides `BlockMapping:Get(minecraftName)` function

3. **Texture Storage** (ServerStorage):
   - Textures stored as ImageLabel/Decal/Texture objects
   - Naming convention likely matches Roblox block types (e.g., `"Wool_Gray"`, `"Stone"`)

### Current Problem
- Textures are loaded on-demand as blocks are placed
- This causes texture pop-in and slower performance
- No preloading mechanism exists

## Strategy

### Phase 1: Extract Required Block Types
1. **Scan the palette** to get all unique Minecraft block names
2. **Map to Roblox block types** using `BlockMapping:Get()`
3. **Deduplicate** to get unique Roblox block types
4. **Result**: List of all block types that need textures

### Phase 2: Preload Textures
1. **Locate ServerStorage** and find texture container (likely a folder)
2. **For each required block type**:
   - Construct texture name (e.g., `"Wool_Gray"`)
   - Find texture in ServerStorage (handle variations: `.png`, `_Texture`, etc.)
   - Clone texture to workspace or cache location
   - Wait for texture to load (if async)
3. **Track progress** for loading screen
4. **Return texture cache** for use during block placement

### Phase 3: Integration
1. **Before block placement**:
   - Call texture preloader
   - Show loading screen with progress
   - Wait for all textures to load
2. **During block placement**:
   - Use preloaded textures from cache
   - No texture loading delays

## Implementation Approach

### Option A: Synchronous Preloading (Simple)
- Load textures one by one
- Simple to implement
- Slower but predictable

### Option B: Parallel Preloading (Fast) ⭐ RECOMMENDED
- Load multiple textures concurrently
- Use `task.spawn()` or coroutines
- Much faster for many textures
- Better for loading screen UX

### Option C: Batch Preloading (Balanced)
- Load textures in batches (e.g., 10 at a time)
- Good balance between speed and resource usage
- Easier to track progress

## Recommended Implementation: Option B (Parallel)

### Module Structure
```lua
local TexturePreloader = {}

-- Extract unique block types from palette
function TexturePreloader:ExtractRequiredBlockTypes(buildData, blockMapping)
    -- Scan palette, map to Roblox types, deduplicate
end

-- Preload all textures from ServerStorage
function TexturePreloader:PreloadTextures(blockTypes, serverStorage, textureFolder)
    -- Parallel load all textures
    -- Return texture cache
end

-- Main entry point
function TexturePreloader:PreloadForSchematic(buildData, blockMapping, serverStorage)
    -- Extract types → Preload textures → Return cache
end

return TexturePreloader
```

### Usage Flow
```lua
-- 1. Load schematic data
local buildData = require("LittleIsland1_20")
local BlockMapping = require("LittleIsland_BlockMapping")
local TexturePreloader = require("TexturePreloader")

-- 2. Preload textures (with loading screen)
local textureCache = TexturePreloader:PreloadForSchematic(
    buildData,
    BlockMapping,
    game.ServerStorage.Textures
)

-- 3. Now place blocks (textures already loaded)
WorldImporter:import(buildData, worldManager, BlockMapping, textureCache)
```

## Performance Considerations

### Texture Loading Speed
- **Roblox texture loading**: Can be async, use `ContentProvider:PreloadAsync()`
- **Parallel loading**: Use `task.spawn()` for concurrent loads
- **Progress tracking**: Update loading screen every N textures

### Memory Management
- **Texture cache**: Store references, not clones (until needed)
- **Cleanup**: Clear cache after world is loaded if needed

### Loading Screen
- **Progress bar**: Show percentage of textures loaded
- **Status text**: "Loading textures: 45/315"
- **Estimated time**: Calculate based on load speed

## Edge Cases

1. **Missing textures**:
   - Log warning, use fallback/default texture
   - Don't fail entire import

2. **Texture naming variations**:
   - Support multiple naming conventions
   - Try: `"Wool_Gray"`, `"Wool_Gray_Texture"`, `"Wool_Gray.png"`

3. **Large texture count**:
   - 315 unique block types in palette
   - Parallel loading essential for speed

4. **Texture folder structure**:
   - Support flat structure: `ServerStorage.Textures.Wool_Gray`
   - Support nested: `ServerStorage.Textures.Wool.Wool_Gray`

## Success Criteria

✅ All textures loaded before first block is placed
✅ Loading screen shows accurate progress
✅ No texture pop-in during block placement
✅ Fast loading time (< 5 seconds for 315 textures)
✅ Graceful handling of missing textures
