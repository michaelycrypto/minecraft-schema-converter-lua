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
  // Doors and trapdoors (treated as air)
  "minecraft:oak_door",
  "oak_door",
  "minecraft:spruce_door",
  "spruce_door",
  "minecraft:birch_door",
  "birch_door",
  "minecraft:jungle_door",
  "jungle_door",
  "minecraft:acacia_door",
  "acacia_door",
  "minecraft:dark_oak_door",
  "dark_oak_door",
  "minecraft:iron_door",
  "iron_door",
  "minecraft:oak_trapdoor",
  "oak_trapdoor",
  "minecraft:spruce_trapdoor",
  "spruce_trapdoor",
  "minecraft:birch_trapdoor",
  "birch_trapdoor",
  "minecraft:jungle_trapdoor",
  "jungle_trapdoor",
  "minecraft:acacia_trapdoor",
  "acacia_trapdoor",
  "minecraft:dark_oak_trapdoor",
  "dark_oak_trapdoor",
  "minecraft:iron_trapdoor",
  "iron_trapdoor",
  // Other blocks to treat as air
  "minecraft:ladder",
  "ladder",
  "minecraft:hopper",
  "hopper",
  "minecraft:lever",
  "lever",
]);

// Blocks to exclude from conversion (unmapped blocks)
const EXCLUDED_BLOCKS = new Set([
  "minecraft:potted_cactus",
  "potted_cactus",
  "minecraft:red_bed",
  "red_bed",
  "minecraft:potted_fern",
  "potted_fern",
  "minecraft:potted_poppy",
  "potted_poppy",
  "minecraft:white_wall_banner",
  "white_wall_banner",
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
  --batch           Split output into multiple batch files (for Roblox size limits)
  --batch-size <n> Chunks per batch file (default: 20, only with --batch)

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
    batch: false,
    batchSize: 20,
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
    } else if (arg === "--batch") {
      options.batch = true;
    } else if (arg === "--batch-size" && i + 1 < args.length) {
      options.batchSize = parseInt(args[++i], 10) || 20;
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

function isExcludedBlock(block) {
  if (block.name) {
    const baseName = block.name.split("[")[0];
    const withoutPrefix = baseName.replace(/^minecraft:/, "");
    return EXCLUDED_BLOCKS.has(block.name) ||
           EXCLUDED_BLOCKS.has(baseName) ||
           EXCLUDED_BLOCKS.has(withoutPrefix);
  }
  // For numeric IDs, we'd need to check after conversion, but this is handled
  // in buildChunkedData after blockKey conversion
  return false;
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

/**
 * Convert legacy numeric block ID + data value to modern block name
 * Maps Minecraft 1.12.2 numeric IDs to 1.13+ string names with states
 */
function convertNumericBlockId(id, data) {
  // Comprehensive mapping of block ID to base name
  const blockNames = {
    0: "minecraft:air",
    1: "minecraft:stone",
    2: "minecraft:grass_block",
    3: "minecraft:dirt",
    4: "minecraft:cobblestone",
    5: "minecraft:planks",
    6: "minecraft:sapling",
    7: "minecraft:bedrock",
    8: "minecraft:flowing_water",
    9: "minecraft:water",
    10: "minecraft:flowing_lava",
    11: "minecraft:lava",
    12: "minecraft:sand",
    13: "minecraft:gravel",
    14: "minecraft:gold_ore",
    15: "minecraft:iron_ore",
    16: "minecraft:coal_ore",
    17: "minecraft:log",
    18: "minecraft:leaves",
    19: "minecraft:sponge",
    20: "minecraft:glass",
    21: "minecraft:lapis_ore",
    22: "minecraft:lapis_block",
    23: "minecraft:dispenser",
    24: "minecraft:sandstone",
    25: "minecraft:noteblock",
    26: "minecraft:bed",
    27: "minecraft:golden_rail",
    28: "minecraft:detector_rail",
    29: "minecraft:sticky_piston",
    30: "minecraft:web",
    31: "minecraft:tallgrass",
    32: "minecraft:deadbush",
    33: "minecraft:piston",
    34: "minecraft:piston_head",
    35: "minecraft:wool",
    36: "minecraft:piston_extension",
    37: "minecraft:yellow_flower",
    38: "minecraft:red_flower",
    39: "minecraft:brown_mushroom",
    40: "minecraft:red_mushroom",
    41: "minecraft:gold_block",
    42: "minecraft:iron_block",
    43: "minecraft:double_stone_slab",
    44: "minecraft:stone_slab",
    45: "minecraft:brick_block",
    46: "minecraft:tnt",
    47: "minecraft:bookshelf",
    48: "minecraft:mossy_cobblestone",
    49: "minecraft:obsidian",
    50: "minecraft:torch",
    51: "minecraft:fire",
    52: "minecraft:mob_spawner",
    53: "minecraft:oak_stairs",
    54: "minecraft:chest",
    55: "minecraft:redstone_wire",
    56: "minecraft:diamond_ore",
    57: "minecraft:diamond_block",
    58: "minecraft:crafting_table",
    59: "minecraft:wheat",
    60: "minecraft:farmland",
    61: "minecraft:furnace",
    62: "minecraft:lit_furnace",
    63: "minecraft:standing_sign",
    64: "minecraft:wooden_door",
    65: "minecraft:ladder",
    66: "minecraft:rail",
    67: "minecraft:stone_stairs",
    68: "minecraft:wall_sign",
    69: "minecraft:lever",
    70: "minecraft:stone_pressure_plate",
    71: "minecraft:iron_door",
    72: "minecraft:wooden_pressure_plate",
    73: "minecraft:redstone_ore",
    74: "minecraft:lit_redstone_ore",
    75: "minecraft:unlit_redstone_torch",
    76: "minecraft:redstone_torch",
    77: "minecraft:stone_button",
    78: "minecraft:snow_layer",
    79: "minecraft:ice",
    80: "minecraft:snow",
    81: "minecraft:cactus",
    82: "minecraft:clay",
    83: "minecraft:reeds",
    84: "minecraft:jukebox",
    85: "minecraft:fence",
    86: "minecraft:pumpkin",
    87: "minecraft:netherrack",
    88: "minecraft:soul_sand",
    89: "minecraft:glowstone",
    90: "minecraft:portal",
    91: "minecraft:lit_pumpkin",
    92: "minecraft:cake",
    93: "minecraft:unpowered_repeater",
    94: "minecraft:powered_repeater",
    95: "minecraft:stained_glass",
    96: "minecraft:trapdoor",
    97: "minecraft:monster_egg",
    98: "minecraft:stonebrick",
    99: "minecraft:brown_mushroom_block",
    100: "minecraft:red_mushroom_block",
    101: "minecraft:iron_bars",
    102: "minecraft:glass_pane",
    103: "minecraft:melon_block",
    104: "minecraft:pumpkin_stem",
    105: "minecraft:melon_stem",
    106: "minecraft:vine",
    107: "minecraft:fence_gate",
    108: "minecraft:brick_stairs",
    109: "minecraft:stone_brick_stairs",
    110: "minecraft:mycelium",
    111: "minecraft:waterlily",
    112: "minecraft:nether_brick",
    113: "minecraft:nether_brick_fence",
    114: "minecraft:nether_brick_stairs",
    115: "minecraft:nether_wart",
    116: "minecraft:enchanting_table",
    117: "minecraft:brewing_stand",
    118: "minecraft:cauldron",
    119: "minecraft:end_portal",
    120: "minecraft:end_portal_frame",
    121: "minecraft:end_stone",
    122: "minecraft:dragon_egg",
    123: "minecraft:redstone_lamp",
    124: "minecraft:lit_redstone_lamp",
    125: "minecraft:double_wooden_slab",
    126: "minecraft:wooden_slab",
    127: "minecraft:cocoa",
    128: "minecraft:sandstone_stairs",
    129: "minecraft:emerald_ore",
    130: "minecraft:ender_chest",
    131: "minecraft:tripwire_hook",
    132: "minecraft:tripwire",
    133: "minecraft:emerald_block",
    134: "minecraft:spruce_stairs",
    135: "minecraft:birch_stairs",
    136: "minecraft:jungle_stairs",
    137: "minecraft:command_block",
    138: "minecraft:beacon",
    139: "minecraft:cobblestone_wall",
    140: "minecraft:flower_pot",
    141: "minecraft:carrots",
    142: "minecraft:potatoes",
    143: "minecraft:wooden_button",
    144: "minecraft:skull",
    145: "minecraft:anvil",
    146: "minecraft:trapped_chest",
    147: "minecraft:light_weighted_pressure_plate",
    148: "minecraft:heavy_weighted_pressure_plate",
    149: "minecraft:unpowered_comparator",
    150: "minecraft:powered_comparator",
    151: "minecraft:daylight_detector",
    152: "minecraft:redstone_block",
    153: "minecraft:quartz_ore",
    154: "minecraft:hopper",
    155: "minecraft:quartz_block",
    156: "minecraft:quartz_stairs",
    157: "minecraft:activator_rail",
    158: "minecraft:dropper",
    159: "minecraft:stained_hardened_clay",
    160: "minecraft:stained_glass_pane",
    161: "minecraft:leaves2",
    162: "minecraft:log2",
    163: "minecraft:acacia_stairs",
    164: "minecraft:dark_oak_stairs",
    165: "minecraft:slime",
    166: "minecraft:barrier",
    167: "minecraft:iron_trapdoor",
    168: "minecraft:prismarine",
    169: "minecraft:sea_lantern",
    170: "minecraft:hay_block",
    171: "minecraft:carpet",
    172: "minecraft:hardened_clay",
    173: "minecraft:coal_block",
    174: "minecraft:packed_ice",
    175: "minecraft:double_plant",
    176: "minecraft:standing_banner",
    177: "minecraft:wall_banner",
    178: "minecraft:daylight_detector_inverted",
    179: "minecraft:red_sandstone",
    180: "minecraft:red_sandstone_stairs",
    181: "minecraft:double_stone_slab2",
    182: "minecraft:stone_slab2",
    183: "minecraft:spruce_fence_gate",
    184: "minecraft:birch_fence_gate",
    185: "minecraft:jungle_fence_gate",
    186: "minecraft:dark_oak_fence_gate",
    187: "minecraft:acacia_fence_gate",
    188: "minecraft:spruce_fence",
    189: "minecraft:birch_fence",
    190: "minecraft:jungle_fence",
    191: "minecraft:dark_oak_fence",
    192: "minecraft:acacia_fence",
    193: "minecraft:spruce_door",
    194: "minecraft:birch_door",
    195: "minecraft:jungle_door",
    196: "minecraft:acacia_door",
    197: "minecraft:dark_oak_door",
    198: "minecraft:end_rod",
    199: "minecraft:chorus_plant",
    200: "minecraft:chorus_flower",
    201: "minecraft:purpur_block",
    202: "minecraft:purpur_pillar",
    203: "minecraft:purpur_stairs",
    204: "minecraft:purpur_double_slab",
    205: "minecraft:purpur_slab",
    206: "minecraft:end_bricks",
    207: "minecraft:beetroots",
    208: "minecraft:grass_path",
    209: "minecraft:end_gateway",
    210: "minecraft:repeating_command_block",
    211: "minecraft:chain_command_block",
    212: "minecraft:frosted_ice",
    213: "minecraft:magma",
    214: "minecraft:nether_wart_block",
    215: "minecraft:red_nether_brick",
    216: "minecraft:bone_block",
    217: "minecraft:structure_void",
    218: "minecraft:observer",
    219: "minecraft:white_shulker_box",
    220: "minecraft:orange_shulker_box",
    221: "minecraft:magenta_shulker_box",
    222: "minecraft:light_blue_shulker_box",
    223: "minecraft:yellow_shulker_box",
    224: "minecraft:lime_shulker_box",
    225: "minecraft:pink_shulker_box",
    226: "minecraft:gray_shulker_box",
    227: "minecraft:silver_shulker_box",
    228: "minecraft:cyan_shulker_box",
    229: "minecraft:purple_shulker_box",
    230: "minecraft:blue_shulker_box",
    231: "minecraft:brown_shulker_box",
    232: "minecraft:green_shulker_box",
    233: "minecraft:red_shulker_box",
    234: "minecraft:black_shulker_box",
    235: "minecraft:white_glazed_terracotta",
    236: "minecraft:orange_glazed_terracotta",
    237: "minecraft:magenta_glazed_terracotta",
    238: "minecraft:light_blue_glazed_terracotta",
    239: "minecraft:yellow_glazed_terracotta",
    240: "minecraft:lime_glazed_terracotta",
    241: "minecraft:pink_glazed_terracotta",
    242: "minecraft:gray_glazed_terracotta",
    243: "minecraft:light_gray_glazed_terracotta",
    244: "minecraft:cyan_glazed_terracotta",
    245: "minecraft:purple_glazed_terracotta",
    246: "minecraft:blue_glazed_terracotta",
    247: "minecraft:brown_glazed_terracotta",
    248: "minecraft:green_glazed_terracotta",
    249: "minecraft:red_glazed_terracotta",
    250: "minecraft:black_glazed_terracotta",
    251: "minecraft:concrete",
    252: "minecraft:concrete_powder",
    253: "minecraft:air", // Reserved/unused in 1.12.2
    254: "minecraft:air", // Reserved/unused in 1.12.2
    255: "minecraft:structure_block",
  };

  const baseName = blockNames[id];
  if (!baseName) {
    // Unknown block ID, return as-is
    return `minecraft:unknown_${id}:${data}`;
  }

  // Handle blocks with data variants
  const d = data & 0xf; // Only use lower 4 bits

  // Color array for wool, stained glass, terracotta, etc.
  const colors = ["white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray", "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"];

  // Special handling for blocks with complex data mappings
  switch (id) {
    case 1: // stone
      const stoneTypes = ["stone", "granite", "polished_granite", "diorite", "polished_diorite", "andesite", "polished_andesite"];
      if (d < stoneTypes.length) {
        return `minecraft:${stoneTypes[d]}`;
      }
      return baseName;

    case 3: // dirt
      if (d === 1) {
        return "minecraft:coarse_dirt";
      }
      return baseName;

    case 31: // tallgrass
      const grassTypes = ["dead_bush", "tall_grass", "fern"];
      if (d < grassTypes.length) {
        return `minecraft:${grassTypes[d]}`;
      }
      return baseName;

    case 5: // planks
      const woodTypes = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
      return `minecraft:${woodTypes[d % 6]}_planks`;

    case 6: // sapling
      const saplingTypes = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
      return `minecraft:${saplingTypes[d % 6]}_sapling`;

    case 17: // log
      const logTypes = ["oak", "spruce", "birch", "jungle"];
      const logAxis = ["y", "y", "y", "y", "x", "x", "x", "x", "z", "z", "z", "z", "none", "none", "none", "none"];
      const type = logTypes[(d & 0x3) % 4];
      const axis = logAxis[d] || "none";
      if (axis === "none") return `minecraft:${type}_log`;
      return `minecraft:${type}_log[axis=${axis}]`;

    case 18: // leaves
      const leafTypes = ["oak", "spruce", "birch", "jungle"];
      // Data values: lower 2 bits = type, bit 4 = check decay
      const leafType = leafTypes[(d & 0x3) % 4];
      return `minecraft:${leafType}_leaves`;

    case 24: // sandstone
      const sandstoneTypes = ["sandstone", "chiseled_sandstone", "smooth_sandstone"];
      return `minecraft:${sandstoneTypes[d % 3]}`;

    case 35: // wool
      return `minecraft:${colors[d % 16]}_wool`;

    case 43: // double_stone_slab
    case 44: // stone_slab
      const slabTypes = ["stone", "sandstone", "wooden", "cobblestone", "brick", "stone_brick", "nether_brick", "quartz"];
      const slabName = id === 44 ? "stone_slab" : "double_stone_slab";
      const slabVariant = slabTypes[d % 8];
      if (id === 44) {
        const half = (d & 0x8) ? "top" : "bottom";
        return `minecraft:${slabVariant}_slab[type=${half}]`;
      }
      return `minecraft:${slabVariant}_slab`;

    case 53: // oak_stairs
      return convertStairsData("oak", d);
    case 67: // stone_stairs
      return convertStairsData("stone", d);
    case 108: // brick_stairs
      return convertStairsData("brick", d);
    case 109: // stone_brick_stairs
      return convertStairsData("stone_brick", d);
    case 114: // nether_brick_stairs
      return convertStairsData("nether_brick", d);
    case 128: // sandstone_stairs
      return convertStairsData("sandstone", d);
    case 134: // spruce_stairs
      return convertStairsData("spruce", d);
    case 135: // birch_stairs
      return convertStairsData("birch", d);
    case 136: // jungle_stairs
      return convertStairsData("jungle", d);
    case 156: // quartz_stairs
      return convertStairsData("quartz", d);
    case 163: // acacia_stairs
      return convertStairsData("acacia", d);
    case 164: // dark_oak_stairs
      return convertStairsData("dark_oak", d);
    case 180: // red_sandstone_stairs
      return convertStairsData("red_sandstone", d);
    case 203: // purpur_stairs
      return convertStairsData("purpur", d);

    case 95: // stained_glass
      return `minecraft:${colors[d % 16]}_stained_glass`;

    case 125: // double_wooden_slab
    case 126: // wooden_slab
      const woodSlabTypes = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
      const woodSlabVariant = woodSlabTypes[d % 6];
      if (id === 126) {
        const half = (d & 0x8) ? "top" : "bottom";
        return `minecraft:${woodSlabVariant}_slab[type=${half}]`;
      }
      return `minecraft:${woodSlabVariant}_slab`;

    case 159: // stained_hardened_clay (terracotta)
      return `minecraft:${colors[d % 16]}_terracotta`;

    case 160: // stained_glass_pane
      return `minecraft:${colors[d % 16]}_stained_glass_pane`;

    case 161: // leaves2
      const leaf2Types = ["acacia", "dark_oak"];
      return `minecraft:${leaf2Types[d % 2]}_leaves`;

    case 162: // log2
      const log2Types = ["acacia", "dark_oak"];
      const log2Axis = ["y", "y", "y", "y", "x", "x", "x", "x", "z", "z", "z", "z", "none", "none", "none", "none"];
      const type2 = log2Types[(d & 0x3) % 2];
      const axis2 = log2Axis[d] || "none";
      if (axis2 === "none") return `minecraft:${type2}_log`;
      return `minecraft:${type2}_log[axis=${axis2}]`;

    case 171: // carpet
      return `minecraft:${colors[d % 16]}_carpet`;

    case 251: // concrete
      return `minecraft:${colors[d % 16]}_concrete`;

    case 252: // concrete_powder
      return `minecraft:${colors[d % 16]}_concrete_powder`;

    case 98: // stonebrick
      const stonebrickTypes = ["stone_bricks", "mossy_stone_bricks", "cracked_stone_bricks", "chiseled_stone_bricks"];
      if (d < stonebrickTypes.length) {
        return `minecraft:${stonebrickTypes[d]}`;
      }
      return baseName;

    case 145: // anvil
      const anvilTypes = ["anvil", "anvil", "slightly_damaged_anvil", "very_damaged_anvil"];
      if (d < anvilTypes.length) {
        return `minecraft:${anvilTypes[d]}`;
      }
      return baseName;

    case 155: // quartz_block
      const quartzTypes = ["quartz_block", "chiseled_quartz_block", "quartz_pillar"];
      if (d < quartzTypes.length) {
        return `minecraft:${quartzTypes[d]}`;
      }
      return baseName;

    case 168: // prismarine
      const prismarineTypes = ["prismarine", "prismarine_bricks", "dark_prismarine"];
      if (d < prismarineTypes.length) {
        return `minecraft:${prismarineTypes[d]}`;
      }
      return baseName;

    case 175: // double_plant
      const plantTypes = ["sunflower", "lilac", "tall_grass", "large_fern", "rose_bush", "peony"];
      // Data values: 0=sunflower, 1=lilac, 2=tall_grass, 3=large_fern, 4=rose_bush, 5=peony
      // Upper bit (8) indicates upper half
      const plantType = plantTypes[d & 0x7];
      if (plantType) {
        return `minecraft:${plantType}`;
      }
      return baseName;

    case 181: // double_stone_slab2
    case 182: // stone_slab2
      const slab2Types = ["red_sandstone", "purpur_slab"];
      const slab2Variant = slab2Types[d % 2];
      if (id === 182) {
        const half = (d & 0x8) ? "top" : "bottom";
        return `minecraft:${slab2Variant}_slab[type=${half}]`;
      }
      return `minecraft:${slab2Variant}_slab`;

    default:
      // For most blocks, data value 0 is the default variant
      if (d === 0) {
        return baseName;
      }
      // Return base name with data value as fallback
      return baseName;
  }
}

/**
 * Convert stairs data value to block name with states
 */
function convertStairsData(woodType, data) {
  const facing = ["east", "west", "south", "north"][data & 0x3];
  const half = (data & 0x4) ? "top" : "bottom";
  const shape = (data & 0x8) ? "outer_right" : "straight"; // Simplified
  return `minecraft:${woodType}_stairs[facing=${facing},half=${half}]`;
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
  // Convert numeric ID to block name
  const blockName = convertNumericBlockId(block.id, block.data);
  if (options.stripStates) {
    return stripBlockStates(blockName);
  }
  if (options.compact) {
    return compactBlockName(blockName);
  }
  return blockName;
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

    // Skip excluded blocks (unmapped blocks)
    if (isExcludedBlock(block)) continue;

    // Clamp to world height
    if (block.y < 0 || block.y >= CHUNK_SIZE_Y) continue;

    // Get or create palette index
    const key = blockKey(block, options);

    // Also check the converted key in case it's an excluded block
    const baseKey = key.split("[")[0];
    const keyWithoutPrefix = baseKey.replace(/^minecraft:/, "");
    if (EXCLUDED_BLOCKS.has(key) || EXCLUDED_BLOCKS.has(baseKey) || EXCLUDED_BLOCKS.has(keyWithoutPrefix)) {
      continue;
    }

    nonAirBlocks++;
    maxY = Math.max(maxY, block.y);
    minY = Math.min(minY, block.y);
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
  if (str == null) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function escapeLuaKey(str) {
  if (str == null) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function toLuaNumber(num) {
  if (num == null || isNaN(num) || !isFinite(num)) {
    return "0";
  }
  return String(num);
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
  lines.push(`  size = { width = ${toLuaNumber(data.stats.size.width)}, height = ${toLuaNumber(data.stats.size.height)}, length = ${toLuaNumber(data.stats.size.length)} },`);

  // Chunk constants
  lines.push(`  chunkSize = { x = ${toLuaNumber(CHUNK_SIZE_X)}, y = ${toLuaNumber(CHUNK_SIZE_Y)}, z = ${toLuaNumber(CHUNK_SIZE_Z)} },`);

  // Palette (1-indexed for Lua)
  lines.push("  palette = {");
  for (const entry of data.palette) {
    if (entry == null) {
      lines.push(`    "",`);
    } else {
      lines.push(`    "${escapeLuaString(entry)}",`);
    }
  }
  lines.push("  },");

  // Encoding hint
  lines.push(`  encoding = "${useRle ? "rle" : "sparse"}",`);

  // Chunks
  const paletteSize = data.palette.length;
  lines.push("  chunks = {");
  for (const [chunkKey, columns] of Object.entries(data.chunks)) {
    lines.push(`    ["${escapeLuaKey(chunkKey)}"] = {`);
    for (const [colKey, runs] of Object.entries(columns)) {
      // Flatten runs array for compact output
      // RLE: [y, len, idx+1], Sparse: [y, idx+1] (1-indexed palette)
      if (!runs || runs.length === 0) {
        lines.push(`      ["${escapeLuaKey(colKey)}"] = { },`);
        continue;
      }
      const flatRuns = runs.map((r) => {
        if (useRle) {
          // RLE format: [y, length, paletteIdx] where paletteIdx is 0-based
          // Convert to 1-based for Lua arrays: palette[1] = first entry
          const y = toLuaNumber(r[0]);
          const len = toLuaNumber(r[1]);
          const paletteIdx0Based = r[2] ?? 0; // 0-based palette index (0 to palette.length-1)

          // Validate palette index is in valid range
          if (paletteIdx0Based < 0 || paletteIdx0Based >= paletteSize) {
            throw new Error(`Invalid palette index ${paletteIdx0Based} (valid range: 0-${paletteSize - 1}) in chunk ${chunkKey}, column ${colKey}`);
          }

          const paletteIdx1Based = paletteIdx0Based + 1; // Convert to 1-based for Lua (1 to palette.length)
          const idx = toLuaNumber(paletteIdx1Based);
          return `{${y}, ${len}, ${idx}}`;
        } else {
          // Sparse format: [y, paletteIdx] where paletteIdx is 0-based
          // Convert to 1-based for Lua arrays
          const y = toLuaNumber(r[0]);
          const paletteIdx0Based = r[1] ?? 0; // 0-based palette index

          // Validate palette index is in valid range
          if (paletteIdx0Based < 0 || paletteIdx0Based >= paletteSize) {
            throw new Error(`Invalid palette index ${paletteIdx0Based} (valid range: 0-${paletteSize - 1}) in chunk ${chunkKey}, column ${colKey}`);
          }

          const paletteIdx1Based = paletteIdx0Based + 1; // Convert to 1-based for Lua
          const idx = toLuaNumber(paletteIdx1Based);
          return `{${y}, ${idx}}`;
        }
      }).join(", ");
      lines.push(`      ["${escapeLuaKey(colKey)}"] = { ${flatRuns} },`);
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

/**
 * Generate batch files for chunk data (splits chunks into multiple files)
 * Returns array of batch file paths
 */
function generateBatchFiles(data, outputPath, useRle, batchSize) {
  const outputDir = path.dirname(outputPath);
  const baseName = path.basename(outputPath, path.extname(outputPath));

  const chunkKeys = Object.keys(data.chunks).sort((a, b) => {
    const [ax, az] = a.split(",").map(Number);
    const [bx, bz] = b.split(",").map(Number);
    return ax !== bx ? ax - bx : az - bz;
  });

  const batches = [];
  const batchFiles = [];

  // Split chunks into batches
  for (let i = 0; i < chunkKeys.length; i += batchSize) {
    const batchChunks = chunkKeys.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize);
    batches.push(batchChunks);

    const batchPath = path.join(outputDir, `${baseName}_Batch_${batchNum}.lua`);
    batchFiles.push(batchPath);

    // Generate batch file
    const lines = [];
    lines.push("--[[");
    lines.push(`  Chunk batch ${batchNum + 1} of ${Math.ceil(chunkKeys.length / batchSize)}`);
    lines.push(`  Contains ${batchChunks.length} chunks`);
    lines.push("]]");
    lines.push("");
    lines.push("return {");

    for (const chunkKey of batchChunks) {
      const columns = data.chunks[chunkKey];
      lines.push(`  ["${escapeLuaKey(chunkKey)}"] = {`);

      for (const [colKey, runs] of Object.entries(columns)) {
        if (!runs || runs.length === 0) {
          lines.push(`    ["${escapeLuaKey(colKey)}"] = { },`);
          continue;
        }

        const flatRuns = runs.map((r) => {
          if (useRle) {
            const y = toLuaNumber(r[0]);
            const len = toLuaNumber(r[1]);
            const paletteIdx0Based = r[2] ?? 0;
            if (paletteIdx0Based < 0 || paletteIdx0Based >= data.palette.length) {
              throw new Error(`Invalid palette index ${paletteIdx0Based}`);
            }
            const paletteIdx1Based = paletteIdx0Based + 1;
            const idx = toLuaNumber(paletteIdx1Based);
            return `{${y}, ${len}, ${idx}}`;
          } else {
            const y = toLuaNumber(r[0]);
            const paletteIdx0Based = r[1] ?? 0;
            if (paletteIdx0Based < 0 || paletteIdx0Based >= data.palette.length) {
              throw new Error(`Invalid palette index ${paletteIdx0Based}`);
            }
            const paletteIdx1Based = paletteIdx0Based + 1;
            const idx = toLuaNumber(paletteIdx1Based);
            return `{${y}, ${idx}}`;
          }
        }).join(", ");

        lines.push(`    ["${escapeLuaKey(colKey)}"] = { ${flatRuns} },`);
      }

      lines.push("  },");
    }

    lines.push("}");
    fs.writeFileSync(batchPath, lines.join("\n"), "utf8");
  }

  return batchFiles;
}

/**
 * Generate main file that references batch files
 */
function toLuaBatched(data, useRle, batchFiles, outputPath) {
  const lines = [];

  lines.push("--[[");
  lines.push("  Generated by schema-converter (Batched Mode)");
  lines.push(`  Format: ${useRle ? "RLE per Y-column" : "Sparse"}`);
  lines.push(`  Chunks: ${data.stats.chunkCount}, Palette: ${data.stats.paletteSize}, Blocks: ${data.stats.nonAirBlocks}`);
  lines.push(`  Batch files: ${batchFiles.length}`);
  lines.push("]]");
  lines.push("");
  lines.push("-- Load batch files");
  for (let i = 0; i < batchFiles.length; i++) {
    const batchName = path.basename(batchFiles[i], ".lua");
    lines.push(`local Batch${i} = require(script.Parent["${batchName}"])`);
  }
  lines.push("");
  lines.push("local chunks = {}");
  for (let i = 0; i < batchFiles.length; i++) {
    lines.push(`for chunkKey, columns in pairs(Batch${i}) do`);
    lines.push(`  chunks[chunkKey] = columns`);
    lines.push(`end`);
  }
  lines.push("");
  lines.push("return {");
  lines.push(`  size = { width = ${toLuaNumber(data.stats.size.width)}, height = ${toLuaNumber(data.stats.size.height)}, length = ${toLuaNumber(data.stats.size.length)} },`);
  lines.push(`  chunkSize = { x = ${toLuaNumber(CHUNK_SIZE_X)}, y = ${toLuaNumber(CHUNK_SIZE_Y)}, z = ${toLuaNumber(CHUNK_SIZE_Z)} },`);

  // Palette
  lines.push("  palette = {");
  for (const entry of data.palette) {
    if (entry == null) {
      lines.push(`    "",`);
    } else {
      lines.push(`    "${escapeLuaString(entry)}",`);
    }
  }
  lines.push("  },");

  lines.push(`  encoding = "${useRle ? "rle" : "sparse"}",`);
  lines.push(`  batchCount = ${batchFiles.length},`);
  lines.push("  chunks = chunks,");
  lines.push("}");

  return lines.join("\n");
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
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (options.batch && options.outFormat === "lua") {
      // Generate batch files
      console.log(`Generating batch files (${options.batchSize} chunks per batch)...`);
      const batchFiles = generateBatchFiles(data, outputPath, options.useRle, options.batchSize);

      // Generate main file
      const output = toLuaBatched(data, options.useRle, batchFiles, outputPath);
      fs.writeFileSync(outputPath, output, "utf8");

      // Report file sizes
      const mainSizeKb = (Buffer.byteLength(output) / 1024).toFixed(2);
      console.log(`Wrote main file: ${outputPath} (${mainSizeKb} KB)`);

      let totalSize = Buffer.byteLength(output);
      for (const batchFile of batchFiles) {
        const batchSize = fs.statSync(batchFile).size;
        const batchSizeKb = (batchSize / 1024).toFixed(2);
        totalSize += batchSize;
        console.log(`  Batch: ${path.basename(batchFile)} (${batchSizeKb} KB)`);
      }

      const totalSizeKb = (totalSize / 1024).toFixed(2);
      console.log(`Total size: ${totalSizeKb} KB across ${batchFiles.length + 1} files`);
      console.log(`Summary: ${data.stats.nonAirBlocks.toLocaleString()} blocks, ${data.stats.paletteSize} palette entries, ${data.stats.chunkCount} chunks`);
    } else {
      const output = options.outFormat === "json"
        ? toJson(data, options.useRle)
        : toLua(data, options.useRle);

      fs.writeFileSync(outputPath, output, "utf8");

      const fileSizeKb = (Buffer.byteLength(output) / 1024).toFixed(2);
      console.log(`Wrote ${options.outFormat.toUpperCase()} to: ${outputPath} (${fileSizeKb} KB)`);
      console.log(`Summary: ${data.stats.nonAirBlocks.toLocaleString()} blocks, ${data.stats.paletteSize} palette entries, ${data.stats.chunkCount} chunks`);
    }

  } catch (error) {
    console.error(`Error: ${error.message || error}`);
    if (process.env.DEBUG) console.error(error.stack);
    process.exitCode = 1;
  }
}

main();
