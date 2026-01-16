## Product Requirements Document

### Goal
Provide a Node.js component that converts Minecraft WorldEdit `.schematic` and `.schem` files into a chunked Lua table format with a palette for use in a Roblox pipeline.

### Scope
- Parse WorldEdit `.schematic` and `.schem` files (NBT format).
- Output a Lua table file that includes size metadata, a palette, and chunked blocks.
- Support optional inclusion of air blocks.

### Out of Scope
- Importing or placing blocks in Roblox.
- Converting other schematic formats (e.g. `.litematic`).
- Any runtime Roblox plugin or UI.

### Inputs
- A `.schematic` or `.schem` file produced by WorldEdit.

### Outputs
- A `.lua` file containing:
  - `size` table: `width`, `height`, `length`
- `palette` array: block identifiers (names or `id:data`)
- `stride` number: `4`
- `chunks` table: keys are `"chunkX,chunkZ"` and values are flat arrays of `x, y, z, p`

### Functional Requirements
- Provide a CLI entry point:
  - `node src/convert.js <input.schematic|input.schem> <output.lua> [--include-air]`
- Correctly interpret `.schematic` tags:
  - `Width`, `Height`, `Length`
  - `Blocks`, `Data`
  - `AddBlocks` for block IDs > 255
- Correctly interpret `.schem` tags:
  - `Width`, `Height`, `Length`
  - `Palette`, `BlockData`
- Output format must be valid Lua table syntax.
- Chunk size is `16x16` in `x` and `z`.
- Default behavior excludes air blocks (`id = 0` or `name = "minecraft:air"`).
- Optional legacy `--flat` format outputs per-block entries.

### Non-Functional Requirements
- Works on Linux with Node and npm.
- Clear error messages for invalid input.
- Minimal dependencies.

### Acceptance Criteria
- Given a valid `.schematic` or `.schem`, the converter produces a `.lua` file with all non-air blocks in the chunked format.
- Passing `--include-air` includes air blocks in the output.
- Invalid or missing tags produce a non-zero exit code and error message.

### Testing Notes
- Validate with at least one small schematic placed in `schematic/`.
- Confirm output loads in Lua (basic syntax check in Roblox or local Lua interpreter).
