#!/usr/bin/env node
import { startServer } from "./server.js";

const vaultPath = process.env.OBSIDIAN_VAULT_PATH || process.argv[2];

if (!vaultPath) {
  console.error("Usage: obsidian-mcp <vault-path>");
  console.error("  or set OBSIDIAN_VAULT_PATH environment variable");
  process.exit(1);
}

startServer(vaultPath, true);
