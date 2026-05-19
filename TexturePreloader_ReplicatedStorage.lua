--[[
  Texture Preloader for ReplicatedStorage (Optimized Version)

  FASTEST APPROACH: Pre-populate ReplicatedStorage with Decals
  - No loading time (already replicated to clients)
  - No ContentProvider:PreloadAsync needed
  - Just clone and use - instant access

  Performance Benefits:
  ✅ Zero loading time (textures already in ReplicatedStorage)
  ✅ No server replication delay
  ✅ No network requests
  ✅ Instant texture access
  ✅ Best for client-side operations
]]

local TexturePreloader = {}

-- Helper: Normalize Roblox block type name for texture lookup
local function normalizeTextureName(robloxType)
    return robloxType
end

-- Helper: Find Decal in ReplicatedStorage (fast lookup, no loading needed)
local function findDecal(replicatedStorage, textureFolder, blockType)
    local normalizedName = normalizeTextureName(blockType)

    -- Try multiple naming conventions
    local possibleNames = {
        normalizedName,                          -- "Wool_Gray"
        normalizedName .. "_Texture",            -- "Wool_Gray_Texture"
        normalizedName .. ".png",                -- "Wool_Gray.png"
        normalizedName:gsub("_", ""),            -- "WoolGray"
    }

    -- Search in texture folder or root
    local searchFolders = {}
    if textureFolder then
        table.insert(searchFolders, textureFolder)
    end
    table.insert(searchFolders, replicatedStorage)

    for _, folder in ipairs(searchFolders) do
        for _, name in ipairs(possibleNames) do
            local decal = folder:FindFirstChild(name)
            if decal and decal:IsA("Decal") then
                return decal
            end
        end

        -- Also try nested folders (e.g., Textures/Wool/Wool_Gray)
        local category = normalizedName:match("^([^_]+)")  -- "Wool" from "Wool_Gray"
        if category then
            local categoryFolder = folder:FindFirstChild(category)
            if categoryFolder then
                for _, name in ipairs(possibleNames) do
                    local decal = categoryFolder:FindFirstChild(name)
                    if decal and decal:IsA("Decal") then
                        return decal
                    end
                end
            end
        end
    end

    return nil
end

-- Extract all unique Roblox block types from schematic palette
function TexturePreloader:ExtractRequiredBlockTypes(buildData, blockMapping)
    local palette = buildData.palette
    if not palette then
        warn("TexturePreloader: No palette found in buildData")
        return {}
    end

    local blockTypes = {}
    local seen = {}

    -- Iterate through palette and map to Roblox block types
    for _, minecraftName in ipairs(palette) do
        -- Get Roblox block type from mapping
        local robloxType = blockMapping:Get(minecraftName)

        -- Skip unknown blocks
        if robloxType and robloxType ~= "Block_Unknown" then
            -- Deduplicate
            if not seen[robloxType] then
                seen[robloxType] = true
                table.insert(blockTypes, robloxType)
            end
        end
    end

    return blockTypes
end

-- Build texture cache from ReplicatedStorage (NO LOADING - instant access)
function TexturePreloader:BuildTextureCache(blockTypes, replicatedStorage, textureFolder)
    local textureCache = {}
    local found = 0
    local missing = 0

    -- Build cache instantly (textures already in ReplicatedStorage)
    for _, blockType in ipairs(blockTypes) do
        local decal = findDecal(replicatedStorage, textureFolder, blockType)

        if decal then
            -- Store reference (no cloning needed yet - clone when placing blocks)
            textureCache[blockType] = decal
            found = found + 1
        else
            warn(string.format("TexturePreloader: Decal not found in ReplicatedStorage for block type: %s", blockType))
            missing = missing + 1
        end
    end

    return textureCache, found, missing
end

-- Main entry point: Build texture cache from ReplicatedStorage
-- NOTE: This is INSTANT - no loading time since ReplicatedStorage is already replicated
function TexturePreloader:PreloadForSchematic(buildData, blockMapping, replicatedStorage, textureFolder, progressCallback)
    -- Extract required block types
    local blockTypes = self:ExtractRequiredBlockTypes(buildData, blockMapping)

    if #blockTypes == 0 then
        warn("TexturePreloader: No block types found")
        return {}, 0, 0
    end

    print(string.format("TexturePreloader: Building cache for %d unique block types from ReplicatedStorage", #blockTypes))

    -- Build cache instantly (no loading needed)
    local textureCache, found, missing = self:BuildTextureCache(
        blockTypes,
        replicatedStorage,
        textureFolder
    )

    -- Call progress callback if provided (instant completion)
    if progressCallback then
        progressCallback(#blockTypes, #blockTypes, missing)
    end

    print(string.format("TexturePreloader: Cache built instantly - %d found, %d missing", found, missing))

    return textureCache, found, missing
end

-- Get Decal from cache (for use during block placement)
function TexturePreloader:GetTexture(textureCache, blockType)
    local decal = textureCache[blockType]
    if decal then
        -- Clone the Decal for use (fast operation)
        return decal:Clone()
    end
    return nil
end

-- Clone Decal for block placement (optimized)
function TexturePreloader:CloneDecalForBlock(textureCache, blockType)
    local decal = textureCache[blockType]
    if decal then
        return decal:Clone()
    end
    return nil
end

return TexturePreloader
