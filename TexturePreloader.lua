--[[
  Texture Preloader for World Schematic
  Preloads all required textures from ServerStorage before block placement.

  Strategy:
  1. Extract unique block types from schematic palette
  2. Map Minecraft names to Roblox block types
  3. Preload all textures in parallel from ServerStorage
  4. Return texture cache for use during block placement
]]

local TexturePreloader = {}

local ContentProvider = game:GetService("ContentProvider")
local RunService = game:GetService("RunService")

-- Helper: Extract base name from Minecraft block name (remove states)
local function getBaseBlockName(minecraftName)
    -- Remove "minecraft:" prefix if present
    local name = minecraftName:gsub("^minecraft:", "")
    -- Remove state brackets [axis=y, ...]
    local base = name:match("^([^%[]+)") or name
    return base
end

-- Helper: Normalize Roblox block type name for texture lookup
local function normalizeTextureName(robloxType)
    -- Block types like "Wool_Gray" should map to texture "Wool_Gray"
    -- Handle any special cases here
    return robloxType
end

-- Helper: Find texture in ServerStorage with flexible naming
local function findTexture(serverStorage, textureFolder, blockType)
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
    table.insert(searchFolders, serverStorage)

    for _, folder in ipairs(searchFolders) do
        for _, name in ipairs(possibleNames) do
            local texture = folder:FindFirstChild(name)
            if texture then
                -- Check if it's a valid texture object
                if texture:IsA("Texture") or texture:IsA("Decal") or
                   texture:IsA("ImageLabel") or texture:IsA("ImageButton") then
                    return texture
                end
            end
        end

        -- Also try nested folders (e.g., Textures/Wool/Wool_Gray)
        local category = normalizedName:match("^([^_]+)")  -- "Wool" from "Wool_Gray"
        if category then
            local categoryFolder = folder:FindFirstChild(category)
            if categoryFolder then
                for _, name in ipairs(possibleNames) do
                    local texture = categoryFolder:FindFirstChild(name)
                    if texture and (texture:IsA("Texture") or texture:IsA("Decal") or
                                   texture:IsA("ImageLabel") or texture:IsA("ImageButton")) then
                        return texture
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

-- Preload a single texture (async)
local function preloadSingleTexture(serverStorage, textureFolder, blockType, textureCache, progressCallback)
    local texture = findTexture(serverStorage, textureFolder, blockType)

    if texture then
        -- Store reference in cache
        textureCache[blockType] = texture

        -- Preload the texture content
        local success, err = pcall(function()
            if texture:IsA("Texture") or texture:IsA("Decal") then
                -- Preload texture content
                ContentProvider:PreloadAsync({texture})
            elseif texture:IsA("ImageLabel") or texture:IsA("ImageButton") then
                -- Preload image content
                if texture.Image then
                    ContentProvider:PreloadAsync({texture})
                end
            end
        end)

        if not success then
            warn(string.format("TexturePreloader: Failed to preload texture for %s: %s", blockType, tostring(err)))
        end

        if progressCallback then
            progressCallback(blockType, true)
        end
    else
        warn(string.format("TexturePreloader: Texture not found for block type: %s", blockType))
        if progressCallback then
            progressCallback(blockType, false)
        end
    end
end

-- Preload all textures in parallel
function TexturePreloader:PreloadTextures(blockTypes, serverStorage, textureFolder, progressCallback)
    local textureCache = {}
    local total = #blockTypes
    local loaded = 0
    local failed = 0

    -- Progress tracking wrapper
    local function onTextureLoaded(blockType, success)
        loaded = loaded + 1
        if not success then
            failed = failed + 1
        end

        if progressCallback then
            progressCallback(loaded, total, failed)
        end
    end

    -- Preload all textures in parallel using task.spawn
    local threads = {}
    for _, blockType in ipairs(blockTypes) do
        local thread = task.spawn(function()
            preloadSingleTexture(serverStorage, textureFolder, blockType, textureCache, onTextureLoaded)
        end)
        table.insert(threads, thread)
    end

    -- Wait for all threads to complete
    -- Note: In Roblox, task.spawn threads run concurrently
    -- We'll wait a bit to let them start, then poll for completion
    local startTime = tick()
    local maxWaitTime = 30 -- Maximum 30 seconds

    while loaded < total and (tick() - startTime) < maxWaitTime do
        task.wait(0.1) -- Check every 100ms
    end

    if loaded < total then
        warn(string.format("TexturePreloader: Timeout waiting for textures. Loaded %d/%d", loaded, total))
    end

    return textureCache, loaded, failed
end

-- Main entry point: Preload all textures for a schematic
function TexturePreloader:PreloadForSchematic(buildData, blockMapping, serverStorage, textureFolder, progressCallback)
    -- Extract required block types
    local blockTypes = self:ExtractRequiredBlockTypes(buildData, blockMapping)

    if #blockTypes == 0 then
        warn("TexturePreloader: No block types found to preload")
        return {}, 0, 0
    end

    print(string.format("TexturePreloader: Found %d unique block types to preload", #blockTypes))

    -- Preload all textures
    local textureCache, loaded, failed = self:PreloadTextures(
        blockTypes,
        serverStorage,
        textureFolder,
        progressCallback
    )

    print(string.format("TexturePreloader: Preloaded %d/%d textures (%d failed)", loaded, #blockTypes, failed))

    return textureCache, loaded, failed
end

-- Get texture from cache (for use during block placement)
function TexturePreloader:GetTexture(textureCache, blockType)
    return textureCache[blockType]
end

return TexturePreloader
