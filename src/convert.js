const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const nbt = require("prismarine-nbt");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const CHUNK_SIZE_X = 16;
const CHUNK_SIZE_Y = 256;
const CHUNK_SIZE_Z = 16;

const AIR_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
  "air",
]);

// State abbreviation mappings for compact metadata
const STATE_KEY_ABBREV = {
  facing: "f",
  half: "h",
  axis: "a",
  shape: "s",
  type: "t",
  waterlogged: "w",
  powered: "pw",
  open: "o",
  persistent: "ps",
  distance: "d",
  snowy: "sn",
  lit: "l",
  extended: "ex",
  face: "fc",
  part: "p",
  hinge: "hi",
  in_wall: "iw",
  attached: "at",
  hanging: "hg",
  occupied: "oc",
  rotation: "r",
  layers: "ly",
  level: "lv",
  age: "ag",
  moisture: "m",
  bites: "b",
  eggs: "eg",
  pickles: "pk",
  candles: "cn",
  honey_level: "hl",
  enabled: "en",
  triggered: "tr",
  inverted: "iv",
  signal_fire: "sf",
  has_bottle_0: "hb0",
  has_bottle_1: "hb1",
  has_bottle_2: "hb2",
  eye: "ey",
  mode: "md",
  locked: "lk",
  short: "sh",
  unstable: "us",
  disarmed: "da",
  conditional: "cd",
  drag: "dr",
  bottom: "bt",
  north: "n",
  south: "so",
  east: "e",
  west: "wt",
  up: "u",
  down: "dn",
};

const STATE_VALUE_ABBREV = {
  // Facing/direction
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  up: "u",
  down: "d",
  // Half
  top: "t",
  bottom: "b",
  upper: "u",
  lower: "l",
  // Axis
  // x, y, z are already short
  // Shape (stairs)
  straight: "st",
  inner_left: "il",
  inner_right: "ir",
  outer_left: "ol",
  outer_right: "or",
  // Type (slabs)
  double: "db",
  // Boolean - omit false entirely, true becomes 1
  true: "1",
  false: null, // Will be omitted
  // Face (buttons)
  floor: "fl",
  wall: "wl",
  ceiling: "cl",
  // Part (beds)
  head: "hd",
  foot: "ft",
  // Hinge
  left: "l",
  right: "r",
  // Rail shape
  north_south: "ns",
  east_west: "ew",
  ascending_north: "an",
  ascending_south: "as",
  ascending_east: "ae",
  ascending_west: "aw",
  north_east: "ne",
  north_west: "nw",
  south_east: "se",
  south_west: "sw",
};

const USAGE = `
Schema Converter - Minecraft to Roblox Voxel Format

Usage:
  node src/convert.js <input> <output> [options]

Input formats:
  .schem      WorldEdit Sponge schematic
  .schematic  WorldEdit classic schematic
  .litematic  Litematica schematic

Options:
  --out <format>   Output format: lua (default) or json
  --include-air    Include air blocks in output
  --no-rle         Disable RLE compression (use sparse format)
  --compact        Compact block names (strip prefix, abbreviate states)
  --strip-states   Strip all block states (loses metadata)
  --stats          Print detailed statistics

Examples:
  node src/convert.js build.schem output.lua
  node src/convert.js build.schem output.lua --compact
  node src/convert.js build.litematic output.json --out json --stats
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    inputPath: null,
    outputPath: null,
    outFormat: "lua",
    includeAir: false,
    useRle: true,
    compact: false,
    stripStates: false,
    showStats: false,
  };

  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out" && i + 1 < args.length) {
      options.outFormat = args[++i].toLowerCase();
    } else if (arg === "--include-air") {
      options.includeAir = true;
    } else if (arg === "--no-rle") {
      options.useRle = false;
    } else if (arg === "--compact") {
      options.compact = true;
    } else if (arg === "--strip-states" || arg === "--normalize") {
      options.stripStates = true;
    } else if (arg === "--stats") {
      options.showStats = true;
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    return { error: "Missing input or output path." };
  }

  options.inputPath = positional[0];
  options.outputPath = positional[1];

  if (!["lua", "json"].includes(options.outFormat)) {
    return { error: `Invalid output format: ${options.outFormat}. Use 'lua' or 'json'.` };
  }

  return options;
}

// ─────────────────────────────────────────────────────────────────────────────
// Block Utilities
// ─────────────────────────────────────────────────────────────────────────────
function isAirBlock(block) {
  if (block.name) {
    return AIR_BLOCKS.has(block.name) || AIR_BLOCKS.has(block.name.split("[")[0]);
  }
  return block.id === 0;
}

/**
 * Parse block states from a block name like "oak_stairs[facing=north,half=top]"
 * Returns { baseName: "oak_stairs", states: { facing: "north", half: "top" } }
 */
function parseBlockStates(name) {
  const bracketIdx = name.indexOf("[");
  if (bracketIdx === -1) {
    return { baseName: name, states: {} };
  }

  const baseName = name.substring(0, bracketIdx);
  const stateStr = name.substring(bracketIdx + 1, name.length - 1);
  const states = {};

  if (stateStr) {
    for (const pair of stateStr.split(",")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx !== -1) {
        const key = pair.substring(0, eqIdx);
        const value = pair.substring(eqIdx + 1);
        states[key] = value;
      }
    }
  }

  return { baseName, states };
}

/**
 * Compact block name: strip minecraft: prefix and abbreviate states
 * "minecraft:oak_stairs[facing=north,half=top,waterlogged=false]"
 * becomes "oak_stairs[f=n,h=t]" (waterlogged=false is omitted as default)
 */
function compactBlockName(name) {
  // Strip minecraft: prefix
  let stripped = name.replace(/^minecraft:/, "");
  
  const { baseName, states } = parseBlockStates(stripped);
  
  // No states - just return base name
  if (Object.keys(states).length === 0) {
    return baseName;
  }

  // Abbreviate states
  const compactStates = [];
  const sortedKeys = Object.keys(states).sort();
  
  for (const key of sortedKeys) {
    const value = states[key];
    
    // Skip false values (they're usually defaults)
    const abbrevValue = STATE_VALUE_ABBREV[value];
    if (abbrevValue === null) continue; // Explicitly skip false
    
    const abbrevKey = STATE_KEY_ABBREV[key] || key;
    const finalValue = abbrevValue !== undefined ? abbrevValue : value;
    
    compactStates.push(`${abbrevKey}=${finalValue}`);
  }

  if (compactStates.length === 0) {
    return baseName;
  }

  return `${baseName}[${compactStates.join(",")}]`;
}

/**
 * Strip all states, just keep base block name
 */
function stripBlockStates(name) {
  let stripped = name.replace(/^minecraft:/, "");
  return stripped.split("[")[0];
}

function blockKey(block, options) {
  if (block.name) {
    if (options.stripStates) {
      return stripBlockStates(block.name);
    }
    if (options.compact) {
      return compactBlockName(block.name);
    }
    return block.name;
  }
  return `${block.id}:${block.data}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// NBT Parsing Utilities
// ─────────────────────────────────────────────────────────────────────────────
function decodeVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let size = 0;

  while (true) {
    if (offset + size >= buffer.length) {
      throw new Error("Truncated varint in block data.");
    }
    const byte = buffer[offset + size];
    value |= (byte & 0x7f) << shift;
    size += 1;
    if ((byte & 0x80) === 0) break;
    shift += 7;
    if (shift > 35) {
      throw new Error("Varint too large.");
    }
  }

  return { value, size };
}

function buildPaletteIndex(paletteTag) {
  const entries = paletteTag?.value;
  if (!entries || typeof entries !== "object") {
    throw new Error("Missing palette in schematic.");
  }

  const palette = [];
  for (const [name, indexTag] of Object.entries(entries)) {
    palette[indexTag.value] = name;
  }
  return palette;
}

function blockIdForIndex(blocks, addBlocks, index) {
  const low = blocks[index] & 0xff;
  if (!addBlocks) return low;

  const addIndex = Math.floor(index / 2);
  const addValue = addBlocks[addIndex] & 0xff;
  const high = index % 2 === 0 ? addValue & 0x0f : (addValue >> 4) & 0x0f;
  return low | (high << 8);
}

// ─────────────────────────────────────────────────────────────────────────────
// Schematic Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse WorldEdit classic .schematic format
 */
function parseClassicSchematic(root) {
  const width = root.Width?.value;
  const height = root.Height?.value;
  const length = root.Length?.value;
  const blocks = root.Blocks?.value;
  const data = root.Data?.value;
  const addBlocks = root.AddBlocks?.value;

  if (typeof width !== "number" || typeof height !== "number" || 
      typeof length !== "number" || !blocks || !data) {
    throw new Error("Invalid classic schematic: missing required tags.");
  }

  const total = width * height * length;
  if (blocks.length !== total || data.length !== total) {
    throw new Error("Block array size mismatch.");
  }

  return {
    width,
    height,
    length,
    *iterateBlocks() {
      let index = 0;
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < length; z++) {
          for (let x = 0; x < width; x++) {
            const id = blockIdForIndex(blocks, addBlocks, index);
            const dataValue = data[index] & 0xff;
            yield { id, data: dataValue, x, y, z };
            index++;
          }
        }
      }
    },
  };
}

/**
 * Parse WorldEdit Sponge .schem format (v2)
 */
function parseSpongeSchematicV2(root) {
  const width = root.Width?.value;
  const height = root.Height?.value;
  const length = root.Length?.value;
  const paletteTag = root.Palette;
  const blockData = root.BlockData?.value;

  if (typeof width !== "number" || typeof height !== "number" || 
      typeof length !== "number" || !paletteTag || !blockData) {
    throw new Error("Invalid Sponge v2 schematic: missing required tags.");
  }

  const palette = buildPaletteIndex(paletteTag);

  return {
    width,
    height,
    length,
    *iterateBlocks() {
      const data = Buffer.from(blockData);
      let offset = 0;
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < length; z++) {
          for (let x = 0; x < width; x++) {
            const { value, size } = decodeVarint(data, offset);
            const name = palette[value];
            if (!name) {
              throw new Error(`Missing palette index ${value}.`);
            }
            yield { name, x, y, z };
            offset += size;
          }
        }
      }
    },
  };
}

/**
 * Parse WorldEdit Sponge .schem format (v3)
 * v3 has nested Schematic tag and Blocks.Palette/Blocks.Data structure
 */
function parseSpongeSchematicV3(root) {
  const schematic = root.Schematic?.value;
  if (!schematic) {
    throw new Error("Invalid Sponge v3 schematic: missing Schematic tag.");
  }

  const width = schematic.Width?.value;
  const height = schematic.Height?.value;
  const length = schematic.Length?.value;
  const blocks = schematic.Blocks?.value;
  
  if (!blocks) {
    throw new Error("Invalid Sponge v3 schematic: missing Blocks tag.");
  }

  const paletteTag = blocks.Palette;
  const blockData = blocks.Data?.value;

  if (typeof width !== "number" || typeof height !== "number" || 
      typeof length !== "number" || !paletteTag || !blockData) {
    throw new Error("Invalid Sponge v3 schematic: missing required tags.");
  }

  const palette = buildPaletteIndex(paletteTag);

  return {
    width,
    height,
    length,
    *iterateBlocks() {
      const data = Buffer.from(blockData);
      let offset = 0;
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < length; z++) {
          for (let x = 0; x < width; x++) {
            const { value, size } = decodeVarint(data, offset);
            const name = palette[value];
            if (!name) {
              throw new Error(`Missing palette index ${value}.`);
            }
            yield { name, x, y, z };
            offset += size;
          }
        }
      }
    },
  };
}

/**
 * Parse Litematica .litematic format
 */
function parseLitematic(root) {
  const regions = root.Regions?.value;
  if (!regions) {
    throw new Error("Invalid litematic: missing Regions tag.");
  }

  // Get dimensions from metadata or compute from regions
  const metadata = root.Metadata?.value;
  const enclosingSize = metadata?.EnclosingSize?.value;
  
  let totalWidth = enclosingSize?.x?.value || 0;
  let totalHeight = enclosingSize?.y?.value || 0;
  let totalLength = enclosingSize?.z?.value || 0;

  // Collect all region data
  const regionList = [];
  for (const [regionName, regionTag] of Object.entries(regions)) {
    const region = regionTag.value;
    const pos = region.Position?.value;
    const size = region.Size?.value;
    const blockStates = region.BlockStates?.value;
    const palette = region.BlockStatePalette?.value?.value;

    if (!pos || !size || !blockStates || !palette) {
      console.warn(`Skipping malformed region: ${regionName}`);
      continue;
    }

    const posX = pos.x?.value || 0;
    const posY = pos.y?.value || 0;
    const posZ = pos.z?.value || 0;
    
    // Size can be negative in litematic
    const sizeX = Math.abs(size.x?.value || 0);
    const sizeY = Math.abs(size.y?.value || 0);
    const sizeZ = Math.abs(size.z?.value || 0);

    // Build palette for this region
    const regionPalette = palette.map((entry) => {
      return entry.Name?.value || "minecraft:air";
    });

    regionList.push({
      posX,
      posY,
      posZ,
      sizeX,
      sizeY,
      sizeZ,
      blockStates: Array.from(blockStates),
      palette: regionPalette,
    });

    // Update total dimensions
    totalWidth = Math.max(totalWidth, posX + sizeX);
    totalHeight = Math.max(totalHeight, posY + sizeY);
    totalLength = Math.max(totalLength, posZ + sizeZ);
  }

  return {
    width: totalWidth,
    height: totalHeight,
    length: totalLength,
    *iterateBlocks() {
      for (const region of regionList) {
        const { posX, posY, posZ, sizeX, sizeY, sizeZ, blockStates, palette } = region;
        const volume = sizeX * sizeY * sizeZ;
        const bitsPerEntry = Math.max(2, Math.ceil(Math.log2(palette.length)));
        const entriesPerLong = Math.floor(64 / bitsPerEntry);
        const mask = (1n << BigInt(bitsPerEntry)) - 1n;

        for (let i = 0; i < volume; i++) {
          const longIndex = Math.floor(i / entriesPerLong);
          const bitOffset = (i % entriesPerLong) * bitsPerEntry;

          if (longIndex >= blockStates.length) break;

          // Litematic stores as signed 64-bit, convert to BigInt for bit ops
          const longVal = BigInt.asUintN(64, BigInt(blockStates[longIndex]));
          const paletteIdx = Number((longVal >> BigInt(bitOffset)) & mask);
          const name = palette[paletteIdx] || "minecraft:air";

          // Calculate position within region (YZX order in litematic)
          const y = Math.floor(i / (sizeX * sizeZ));
          const remainder = i % (sizeX * sizeZ);
          const z = Math.floor(remainder / sizeX);
          const x = remainder % sizeX;

          yield {
            name,
            x: posX + x,
            y: posY + y,
            z: posZ + z,
          };
        }
      }
    },
  };
}

/**
 * Detect format and parse schematic file
 */
async function parseSchematic(inputPath) {
  const buffer = fs.readFileSync(inputPath);
  const ext = path.extname(inputPath).toLowerCase();

  let parsed;
  try {
    parsed = await nbt.parse(buffer);
  } catch (e) {
    // Try gzip decompression for litematic
    if (ext === ".litematic") {
      const decompressed = zlib.gunzipSync(buffer);
      parsed = await nbt.parse(decompressed);
    } else {
      throw e;
    }
  }

  const root = parsed.parsed?.value ?? parsed.value;
  if (!root) {
    throw new Error("Failed to parse NBT root.");
  }

  // Detect format
  if (ext === ".litematic" || root.Regions) {
    return parseLitematic(root);
  }
  // Sponge v3: nested Schematic tag with Blocks.Palette and Blocks.Data
  if (root.Schematic?.value?.Blocks) {
    return parseSpongeSchematicV3(root);
  }
  // Sponge v2: top-level Palette and BlockData
  if (root.BlockData && root.Palette) {
    return parseSpongeSchematicV2(root);
  }
  // Classic: Blocks and Data arrays
  if (root.Blocks && root.Data) {
    return parseClassicSchematic(root);
  }

  throw new Error("Unrecognized schematic format.");
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunking & Compression
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build chunked, RLE-compressed data structure
 * 
 * Output format:
 * - palette: string[] of unique block names
 * - chunks: { "cx,cz": { columns: { "lx,lz": [[y, len, paletteIdx], ...] } } }
 * 
 * RLE encodes consecutive runs along the Y axis for each (x,z) column
 */
function buildChunkedData(schematic, options) {
  const { includeAir, useRle } = options;
  
  // Build palette and collect blocks by chunk/column
  const paletteMap = new Map(); // blockKey -> index
  const palette = [];
  const chunkMap = new Map(); // "cx,cz" -> Map("lx,lz" -> [{y, idx}...])
  
  // Stats
  let totalBlocks = 0;
  let nonAirBlocks = 0;
  let maxY = 0;
  let minY = Infinity;

  for (const block of schematic.iterateBlocks()) {
    totalBlocks++;

    // Skip air unless requested
    if (!includeAir && isAirBlock(block)) continue;

    // Clamp to world height
    if (block.y < 0 || block.y >= CHUNK_SIZE_Y) continue;

    nonAirBlocks++;
    maxY = Math.max(maxY, block.y);
    minY = Math.min(minY, block.y);

    // Get or create palette index
    const key = blockKey(block, options);
    let paletteIdx = paletteMap.get(key);
    if (paletteIdx === undefined) {
      paletteIdx = palette.length;
      palette.push(key);
      paletteMap.set(key, paletteIdx);
    }

    // Chunk coordinates
    const cx = Math.floor(block.x / CHUNK_SIZE_X);
    const cz = Math.floor(block.z / CHUNK_SIZE_Z);
    const lx = ((block.x % CHUNK_SIZE_X) + CHUNK_SIZE_X) % CHUNK_SIZE_X;
    const lz = ((block.z % CHUNK_SIZE_Z) + CHUNK_SIZE_Z) % CHUNK_SIZE_Z;

    const chunkKey = `${cx},${cz}`;
    if (!chunkMap.has(chunkKey)) {
      chunkMap.set(chunkKey, new Map());
    }
    const columns = chunkMap.get(chunkKey);
    
    const colKey = `${lx},${lz}`;
    if (!columns.has(colKey)) {
      columns.set(colKey, []);
    }
    columns.get(colKey).push({ y: block.y, idx: paletteIdx });
  }

  // Build final chunk structure with RLE or sparse encoding
  const chunks = {};
  const sortedChunkKeys = Array.from(chunkMap.keys()).sort((a, b) => {
    const [ax, az] = a.split(",").map(Number);
    const [bx, bz] = b.split(",").map(Number);
    return ax !== bx ? ax - bx : az - bz;
  });

  for (const chunkKey of sortedChunkKeys) {
    const columns = chunkMap.get(chunkKey);
    const chunkData = {};

    // Sort column keys deterministically
    const sortedColKeys = Array.from(columns.keys()).sort((a, b) => {
      const [ax, az] = a.split(",").map(Number);
      const [bx, bz] = b.split(",").map(Number);
      return ax !== bx ? ax - bx : az - bz;
    });

    for (const colKey of sortedColKeys) {
      const blocks = columns.get(colKey);
      
      // Sort by Y
      blocks.sort((a, b) => a.y - b.y);

      if (useRle) {
        // RLE encode: [startY, length, paletteIdx, ...]
        const runs = [];
        let runStart = blocks[0].y;
        let runIdx = blocks[0].idx;
        let runLen = 1;

        for (let i = 1; i < blocks.length; i++) {
          const b = blocks[i];
          if (b.y === runStart + runLen && b.idx === runIdx) {
            runLen++;
          } else {
            runs.push([runStart, runLen, runIdx]);
            runStart = b.y;
            runIdx = b.idx;
            runLen = 1;
          }
        }
        runs.push([runStart, runLen, runIdx]);
        chunkData[colKey] = runs;
      } else {
        // Sparse: [y, paletteIdx, ...]
        chunkData[colKey] = blocks.map((b) => [b.y, b.idx]);
      }
    }

    chunks[chunkKey] = chunkData;
  }

  return {
    palette,
    chunks,
    stats: {
      totalBlocks,
      nonAirBlocks,
      paletteSize: palette.length,
      chunkCount: Object.keys(chunks).length,
      maxY: maxY === 0 && minY === Infinity ? 0 : maxY,
      minY: minY === Infinity ? 0 : minY,
      size: {
        width: schematic.width,
        height: schematic.height,
        length: schematic.length,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Formatters
// ─────────────────────────────────────────────────────────────────────────────

function escapeLuaString(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function toLua(data, useRle) {
  const lines = [];
  lines.push("--[[");
  lines.push("  Generated by schema-converter");
  lines.push(`  Format: ${useRle ? "RLE per Y-column" : "Sparse"}`);
  lines.push(`  Chunks: ${data.stats.chunkCount}, Palette: ${data.stats.paletteSize}, Blocks: ${data.stats.nonAirBlocks}`);
  lines.push("]]");
  lines.push("");
  lines.push("return {");
  
  // Size metadata
  lines.push(`  size = { width = ${data.stats.size.width}, height = ${data.stats.size.height}, length = ${data.stats.size.length} },`);
  
  // Chunk constants
  lines.push(`  chunkSize = { x = ${CHUNK_SIZE_X}, y = ${CHUNK_SIZE_Y}, z = ${CHUNK_SIZE_Z} },`);
  
  // Palette (1-indexed for Lua)
  lines.push("  palette = {");
  for (const entry of data.palette) {
    lines.push(`    "${escapeLuaString(entry)}",`);
  }
  lines.push("  },");
  
  // Encoding hint
  lines.push(`  encoding = "${useRle ? "rle" : "sparse"}",`);
  
  // Chunks
  lines.push("  chunks = {");
  for (const [chunkKey, columns] of Object.entries(data.chunks)) {
    lines.push(`    ["${chunkKey}"] = {`);
    for (const [colKey, runs] of Object.entries(columns)) {
      // Flatten runs array for compact output
      // RLE: [y, len, idx+1], Sparse: [y, idx+1] (1-indexed palette)
      const flatRuns = runs.map((r) => 
        useRle 
          ? `{${r[0]}, ${r[1]}, ${r[2] + 1}}` 
          : `{${r[0]}, ${r[1] + 1}}`
      ).join(", ");
      lines.push(`      ["${colKey}"] = { ${flatRuns} },`);
    }
    lines.push("    },");
  }
  lines.push("  },");
  
  lines.push("}");
  return lines.join("\n");
}

function toJson(data, useRle) {
  // For JSON, keep 0-indexed palette
  const output = {
    _meta: {
      generator: "schema-converter",
      encoding: useRle ? "rle" : "sparse",
      chunkSize: { x: CHUNK_SIZE_X, y: CHUNK_SIZE_Y, z: CHUNK_SIZE_Z },
    },
    size: data.stats.size,
    palette: data.palette,
    chunks: data.chunks,
  };
  return JSON.stringify(output, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats Printing
// ─────────────────────────────────────────────────────────────────────────────

function printStats(stats) {
  console.log("\n─── Conversion Statistics ───");
  console.log(`  Build size:      ${stats.size.width} x ${stats.size.height} x ${stats.size.length}`);
  console.log(`  Total blocks:    ${stats.totalBlocks.toLocaleString()}`);
  console.log(`  Non-air blocks:  ${stats.nonAirBlocks.toLocaleString()}`);
  console.log(`  Palette size:    ${stats.paletteSize}`);
  console.log(`  Chunk count:     ${stats.chunkCount}`);
  console.log(`  Y range:         ${stats.minY} - ${stats.maxY}`);
  console.log("─────────────────────────────\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv);
  
  if (options.error) {
    console.error(`Error: ${options.error}\n`);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(options.inputPath);
  const outputPath = path.resolve(options.outputPath);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`Reading: ${inputPath}`);
    const schematic = await parseSchematic(inputPath);
    console.log(`Parsed: ${schematic.width}x${schematic.height}x${schematic.length}`);

    console.log("Building chunked data...");
    const data = buildChunkedData(schematic, options);

    if (options.showStats) {
      printStats(data.stats);
    }

    // Generate output
    const output = options.outFormat === "json"
      ? toJson(data, options.useRle)
      : toLua(data, options.useRle);

    // Write file
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output, "utf8");
    
    const fileSizeKb = (Buffer.byteLength(output) / 1024).toFixed(2);
    console.log(`Wrote ${options.outFormat.toUpperCase()} to: ${outputPath} (${fileSizeKb} KB)`);
    console.log(`Summary: ${data.stats.nonAirBlocks.toLocaleString()} blocks, ${data.stats.paletteSize} palette entries, ${data.stats.chunkCount} chunks`);

  } catch (error) {
    console.error(`Error: ${error.message || error}`);
    if (process.env.DEBUG) console.error(error.stack);
    process.exitCode = 1;
  }
}

main();
