# PRD: SchematicImporter Redesign

## Context
The schema converter now outputs chunk batch files with **direct block IDs** instead of palette indices. The chunk data format has changed from palette-based to ID-based.

## Current Format
- **Chunk data**: `{y, blockId}` (sparse) or `{y, length, blockId}` (RLE)
- **Block IDs**: Direct numeric values (not palette indices)
- **Palette mapping**: Separate `BlockPalette.lua` file maps `blockId -> blockName`
- **Structure**: Main file + Chunks_Batch_*.lua files + BlockPalette.lua

## Requirements

### 1. Block ID Reading
- Read block IDs directly from chunk data (third value in arrays)
- Do NOT use palette indices - IDs are already resolved
- Support both RLE format: `{y, length, blockId}` and Sparse: `{y, blockId}`

### 2. Palette Mapping
- Load `BlockPalette.lua` as a lookup table: `palette[blockId] = blockName`
- Handle missing mappings gracefully (fallback to "air" or log warning)
- Cache palette in memory for performance

### 3. Block Placement
- Iterate through chunks → columns → block entries
- For RLE: expand runs using `{y, length, blockId}` to place `length` blocks starting at `y`
- For Sparse: place single block at `y` with `blockId`
- Lookup block name via `palette[blockId]`
- Place blocks using existing block mapping system

### 4. Performance
- Batch block placements where possible
- Process chunks in parallel if supported
- Minimize palette lookups (cache results)

## Success Criteria
- Successfully imports schematics using new block ID format
- Correctly maps all block IDs to block names via palette
- Handles both RLE and Sparse encoding formats
- Maintains or improves import performance

## Example Usage
```lua
local buildData = require(script.Parent.Main)
local palette = require(script.Parent.BlockPalette)

-- Iterate chunks
for chunkKey, columns in pairs(buildData.chunks) do
  for colKey, blocks in pairs(columns) do
    for _, entry in ipairs(blocks) do
      local y, blockId = entry[1], entry[2] -- Sparse
      -- OR
      local y, length, blockId = entry[1], entry[2], entry[3] -- RLE
      local blockName = palette[blockId]
      -- Place block...
    end
  end
end
```
