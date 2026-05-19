--[[
  World Importer with Texture Preloading
  Example integration showing how to preload textures before block placement.

  Usage:
  ```lua
  local WorldImporter = require("WorldImporter_WithTexturePreload")
  local buildData = require("LittleIsland1_20")
  local BlockMapping = require("LittleIsland_BlockMapping")

  WorldImporter:ImportWithTextures(buildData, BlockMapping, worldManager, game.ServerStorage)
  ```
]]

local TexturePreloader = require(script.Parent.TexturePreloader)

local WorldImporter = {}

-- Simple loading screen GUI (customize as needed)
local function createLoadingScreen()
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "LoadingScreen"
    screenGui.ResetOnSpawn = false
    screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
    screenGui.Parent = game.Players.LocalPlayer:WaitForChild("PlayerGui")

    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0, 400, 0, 200)
    frame.Position = UDim2.new(0.5, -200, 0.5, -100)
    frame.BackgroundColor3 = Color3.new(0.1, 0.1, 0.1)
    frame.BorderSizePixel = 2
    frame.BorderColor3 = Color3.new(0.3, 0.3, 0.3)
    frame.Parent = screenGui

    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, -20, 0, 40)
    title.Position = UDim2.new(0, 10, 0, 10)
    title.BackgroundTransparency = 1
    title.Text = "Loading World..."
    title.TextColor3 = Color3.new(1, 1, 1)
    title.TextSize = 24
    title.Font = Enum.Font.SourceSansBold
    title.TextXAlignment = Enum.TextXAlignment.Left
    title.Parent = frame

    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(1, -20, 0, 30)
    statusLabel.Position = UDim2.new(0, 10, 0, 50)
    statusLabel.BackgroundTransparency = 1
    statusLabel.Text = "Preloading textures..."
    statusLabel.TextColor3 = Color3.new(0.8, 0.8, 0.8)
    statusLabel.TextSize = 18
    statusLabel.Font = Enum.Font.SourceSans
    statusLabel.TextXAlignment = Enum.TextXAlignment.Left
    statusLabel.Parent = frame

    local progressBarBg = Instance.new("Frame")
    progressBarBg.Size = UDim2.new(1, -20, 0, 30)
    progressBarBg.Position = UDim2.new(0, 10, 0, 90)
    progressBarBg.BackgroundColor3 = Color3.new(0.2, 0.2, 0.2)
    progressBarBg.BorderSizePixel = 1
    progressBarBg.BorderColor3 = Color3.new(0.4, 0.4, 0.4)
    progressBarBg.Parent = frame

    local progressBar = Instance.new("Frame")
    progressBar.Size = UDim2.new(0, 0, 1, 0)
    progressBar.Position = UDim2.new(0, 0, 0, 0)
    progressBar.BackgroundColor3 = Color3.new(0, 0.7, 1)
    progressBar.BorderSizePixel = 0
    progressBar.Parent = progressBarBg

    local progressLabel = Instance.new("TextLabel")
    progressLabel.Size = UDim2.new(1, 0, 1, 0)
    progressLabel.Position = UDim2.new(0, 0, 0, 0)
    progressLabel.BackgroundTransparency = 1
    progressLabel.Text = "0%"
    progressLabel.TextColor3 = Color3.new(1, 1, 1)
    progressLabel.TextSize = 16
    progressLabel.Font = Enum.Font.SourceSansBold
    progressLabel.Parent = progressBarBg

    local blocksLabel = Instance.new("TextLabel")
    blocksLabel.Size = UDim2.new(1, -20, 0, 30)
    blocksLabel.Position = UDim2.new(0, 10, 0, 130)
    blocksLabel.BackgroundTransparency = 1
    blocksLabel.Text = ""
    blocksLabel.TextColor3 = Color3.new(0.7, 0.7, 0.7)
    blocksLabel.TextSize = 14
    blocksLabel.Font = Enum.Font.SourceSans
    blocksLabel.TextXAlignment = Enum.TextXAlignment.Left
    blocksLabel.Parent = frame

    return {
        gui = screenGui,
        updateProgress = function(loaded, total, failed)
            local percent = total > 0 and (loaded / total) * 100 or 0
            progressBar.Size = UDim2.new(percent / 100, 0, 1, 0)
            progressLabel.Text = string.format("%.0f%% (%d/%d)", percent, loaded, total)

            if failed > 0 then
                blocksLabel.Text = string.format("Failed: %d textures", failed)
                blocksLabel.TextColor3 = Color3.new(1, 0.5, 0.5)
            else
                blocksLabel.Text = string.format("Loaded: %d textures", loaded)
                blocksLabel.TextColor3 = Color3.new(0.5, 1, 0.5)
            end
        end,
        updateStatus = function(text)
            statusLabel.Text = text
        end,
        destroy = function()
            screenGui:Destroy()
        end
    }
end

-- Import world with texture preloading
function WorldImporter:ImportWithTextures(buildData, blockMapping, worldManager, serverStorage, textureFolder, showLoadingScreen)
    local loadingScreen = nil

    if showLoadingScreen ~= false then
        loadingScreen = createLoadingScreen()
    end

    -- Step 1: Preload all textures
    if loadingScreen then
        loadingScreen.updateStatus("Preloading textures...")
    end

    local progressCallback = loadingScreen and function(loaded, total, failed)
        loadingScreen.updateProgress(loaded, total, failed)
    end or nil

    local textureCache, loaded, failed = TexturePreloader:PreloadForSchematic(
        buildData,
        blockMapping,
        serverStorage,
        textureFolder,
        progressCallback
    )

    -- Step 2: Place blocks (textures are now preloaded)
    if loadingScreen then
        loadingScreen.updateStatus("Placing blocks...")
        loadingScreen.updateProgress(0, 1, 0) -- Reset for block placement
    end

    local blocksPlaced = self:ImportBlocks(buildData, blockMapping, worldManager, textureCache, loadingScreen)

    -- Step 3: Cleanup loading screen
    if loadingScreen then
        task.wait(0.5) -- Brief pause to show completion
        loadingScreen.destroy()
    end

    return blocksPlaced, textureCache
end

-- Import blocks (original import logic, now with texture cache)
function WorldImporter:ImportBlocks(buildData, blockMapping, worldManager, textureCache, loadingScreen)
    local palette = buildData.palette
    local chunks = buildData.chunks
    local chunkSize = buildData.chunkSize
    local isRle = buildData.encoding == "rle"

    local blocksPlaced = 0
    local totalBlocks = 0

    -- Count total blocks first (for progress)
    for _, columns in pairs(chunks) do
        for _, runs in pairs(columns) do
            for _, run in ipairs(runs) do
                if isRle then
                    totalBlocks = totalBlocks + (run[2] or 0) -- length
                else
                    totalBlocks = totalBlocks + 1
                end
            end
        end
    end

    local blocksProcessed = 0
    local lastUpdateTime = tick()

    -- Place blocks
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
                local paletteIdx = run[3] or run[2] -- RLE: idx 3, Sparse: idx 2
                local blockName = palette[paletteIdx]

                if blockName then
                    local robloxType = blockMapping:Get(blockName)

                    if robloxType and robloxType ~= "Block_Unknown" then
                        -- Get preloaded texture if available
                        local texture = textureCache and TexturePreloader:GetTexture(textureCache, robloxType) or nil

                        if isRle then
                            -- RLE: startY, length, paletteIdx
                            local startY, length = run[1], run[2]
                            for y = startY, startY + length - 1 do
                                worldManager:SetBlock(worldX, y, worldZ, robloxType, texture)
                                blocksPlaced = blocksPlaced + 1
                                blocksProcessed = blocksProcessed + 1
                            end
                        else
                            -- Sparse: y, paletteIdx
                            local y = run[1]
                            worldManager:SetBlock(worldX, y, worldZ, robloxType, texture)
                            blocksPlaced = blocksPlaced + 1
                            blocksProcessed = blocksProcessed + 1
                        end
                    end
                end

                -- Update loading screen periodically (every 100ms or 100 blocks)
                if loadingScreen and (tick() - lastUpdateTime > 0.1 or blocksProcessed % 100 == 0) then
                    local percent = totalBlocks > 0 and (blocksProcessed / totalBlocks) * 100 or 0
                    loadingScreen.updateProgress(blocksProcessed, totalBlocks, 0)
                    lastUpdateTime = tick()
                end
            end
        end
    end

    return blocksPlaced
end

return WorldImporter
