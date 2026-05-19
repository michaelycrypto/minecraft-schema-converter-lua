# Texture Preloading Usage Guide

## Quick Start

### Basic Usage
```lua
local WorldImporter = require(script.Parent.WorldImporter_WithTexturePreload)
local buildData = require(script.Parent.LittleIsland1_20)
local BlockMapping = require(script.Parent.LittleIsland_BlockMapping)

-- Import world with automatic texture preloading
local blocksPlaced, textureCache = WorldImporter:ImportWithTextures(
    buildData,
    BlockMapping,
    worldManager,
    game.ServerStorage,  -- ServerStorage location
    game.ServerStorage.Textures,  -- Optional: texture folder
    true  -- Show loading screen (default: true)
)
```

### Advanced Usage (Manual Control)
```lua
local TexturePreloader = require(script.Parent.TexturePreloader)
local BlockMapping = require(script.Parent.LittleIsland_BlockMapping)
local buildData = require(script.Parent.LittleIsland1_20)

-- Step 1: Preload textures manually
local textureCache, loaded, failed = TexturePreloader:PreloadForSchematic(
    buildData,
    BlockMapping,
    game.ServerStorage,
    game.ServerStorage.Textures,  -- Optional texture folder
    function(loaded, total, failed)  -- Optional progress callback
        print(string.format("Loading: %d/%d textures", loaded, total))
    end
)

-- Step 2: Use texture cache during block placement
-- (Your existing block placement code, now with textures preloaded)
```

## Texture Storage Structure

### Recommended Structure
```
ServerStorage/
└── Textures/
    ├── Wool_Gray
    ├── Wool_Green
    ├── Stone
    ├── Stone_Cobblestone
    └── ...
```

### Alternative Structures Supported
- **Flat**: `ServerStorage.Wool_Gray`
- **Nested**: `ServerStorage.Textures.Wool.Wool_Gray`
- **With suffix**: `ServerStorage.Textures.Wool_Gray_Texture`

## How It Works

### 1. Extraction Phase
- Scans the schematic `palette` array
- Maps each Minecraft block name to Roblox block type using `BlockMapping`
- Deduplicates to get unique block types
- **Result**: List of all required textures

### 2. Preloading Phase
- For each block type, searches ServerStorage for matching texture
- Supports multiple naming conventions (see above)
- Loads textures in parallel for speed
- Tracks progress for loading screen
- **Result**: Texture cache ready for use

### 3. Block Placement Phase
- Uses preloaded textures from cache
- No texture loading delays
- Fast block placement

## Loading Screen

The default loading screen shows:
- **Title**: "Loading World..."
- **Status**: Current phase (e.g., "Preloading textures...")
- **Progress Bar**: Visual progress indicator
- **Progress Text**: "X% (loaded/total)"
- **Details**: Number of textures loaded/failed

### Customizing Loading Screen
```lua
-- Disable default loading screen
WorldImporter:ImportWithTextures(
    buildData,
    BlockMapping,
    worldManager,
    game.ServerStorage,
    nil,
    false  -- Don't show loading screen
)

-- Use your own loading screen
local myLoadingScreen = {
    updateProgress = function(loaded, total, failed)
        -- Your custom progress update
    end,
    updateStatus = function(text)
        -- Your custom status update
    end,
    destroy = function()
        -- Cleanup
    end
}
```

## Performance

### Texture Loading Speed
- **Parallel loading**: All textures load concurrently
- **Typical time**: 2-5 seconds for 315 textures
- **Progress updates**: Every texture load completion

### Memory Usage
- **Texture cache**: Stores references (not clones)
- **Minimal overhead**: ~1KB per texture reference
- **Total**: ~315KB for 315 textures

## Error Handling

### Missing Textures
- **Warning logged**: `TexturePreloader: Texture not found for block type: X`
- **Graceful degradation**: Block placement continues without texture
- **No failure**: Import doesn't stop for missing textures

### Failed Preloads
- **Warning logged**: `TexturePreloader: Failed to preload texture for X`
- **Count tracked**: Returns `failed` count
- **Blocks still placed**: Without textures if needed

## Integration with Existing Code

### If Your WorldManager Already Uses Textures
```lua
-- Modify your SetBlock to accept texture parameter
function WorldManager:SetBlock(x, y, z, blockType, texture)
    -- Your existing block placement code
    -- Use texture if provided
    if texture then
        -- Apply texture to block
    end
end
```

### If Your WorldManager Doesn't Use Textures Yet
```lua
-- Texture cache is still created, you can use it later
local textureCache = TexturePreloader:PreloadForSchematic(...)

-- Access textures when needed
local texture = TexturePreloader:GetTexture(textureCache, "Wool_Gray")
```

## Troubleshooting

### Textures Not Found
1. **Check naming**: Ensure texture names match block types (e.g., `"Wool_Gray"`)
2. **Check location**: Verify textures are in ServerStorage (or specified folder)
3. **Check type**: Textures must be Texture, Decal, ImageLabel, or ImageButton

### Slow Loading
1. **Check texture size**: Large textures take longer to load
2. **Check network**: ServerStorage loading depends on network speed
3. **Check count**: More textures = longer load time (but still parallel)

### Loading Screen Not Showing
1. **Check PlayerGui**: Ensure PlayerGui exists
2. **Check ZIndex**: Loading screen uses high ZIndex
3. **Check visibility**: ScreenGui should be visible

## Example: Complete Integration

```lua
-- Server script
local WorldImporter = require(script.Parent.WorldImporter_WithTexturePreload)
local buildData = require(script.Parent.LittleIsland1_20)
local BlockMapping = require(script.Parent.LittleIsland_BlockMapping)
local WorldManager = require(script.Parent.WorldManager)

-- Wait for players
game.Players.PlayerAdded:Connect(function(player)
    player.CharacterAdded:Wait()

    -- Import world with texture preloading
    local blocksPlaced, textureCache = WorldImporter:ImportWithTextures(
        buildData,
        BlockMapping,
        WorldManager,
        game.ServerStorage,
        game.ServerStorage.Textures,
        true  -- Show loading screen
    )

    print(string.format("Imported %d blocks with %d textures preloaded",
        blocksPlaced,
        #textureCache
    ))
end)
```
