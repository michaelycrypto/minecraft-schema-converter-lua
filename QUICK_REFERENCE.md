# Quick Reference: Texture Loading Approaches

## ⚡ FASTEST: ReplicatedStorage with Decals

**Use this for maximum performance**

```lua
local TexturePreloader = require(script.Parent.TexturePreloader_ReplicatedStorage)

-- INSTANT - no loading time!
local textureCache = TexturePreloader:PreloadForSchematic(
    buildData,
    blockMapping,
    game.ReplicatedStorage,
    game.ReplicatedStorage.Textures
)
```

**Setup**: Pre-populate `ReplicatedStorage.Textures` with all Decals
**Time**: < 0.1 seconds (instant)
**Best for**: Client-side, fastest possible loading

---

## 🚀 FAST: ServerStorage with Preloading

**Use this for server-side operations**

```lua
local TexturePreloader = require(script.Parent.TexturePreloader)

-- Parallel loading
local textureCache = TexturePreloader:PreloadForSchematic(
    buildData,
    blockMapping,
    game.ServerStorage,
    game.ServerStorage.Textures
)
```

**Setup**: Place textures in `ServerStorage.Textures`
**Time**: 2-5 seconds (parallel loading)
**Best for**: Server-only, dynamic textures

---

## Performance Comparison

| Metric | ReplicatedStorage | ServerStorage |
|--------|------------------|---------------|
| **Loading Time** | < 0.1s (instant) | 2-5s (parallel) |
| **Network Requests** | 0 | 315 |
| **Client Access** | ✅ Instant | ❌ Requires replication |
| **Server Access** | ✅ Instant | ✅ Instant |
| **Best For** | ⭐ Fastest | Server-only |

---

## Recommendation

**For block textures**: Use **ReplicatedStorage** ⚡
- Pre-populate with Decals
- Zero loading time
- Fastest possible access

**For dynamic content**: Use **ServerStorage**
- Server-controlled
- Can change at runtime
