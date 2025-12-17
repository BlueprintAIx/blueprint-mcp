# @blueprintaix/blueprint-mcp

An MCP server that connects AI assistants to DeFi yield opportunities across EVM and Solana chains. Discover, evaluate, and execute yield strategies through natural conversation—with transactions signed locally on your machine.

## Features

- **Multi-chain support** — Base (EVM) and Solana, with more chains coming soon
- **Local signing** — Private keys never leave your machine
- **MCP integration** — Works with Claude Desktop and other MCP-compatible clients
- **Intent execution** — Automatically signs and submits transactions

## Quick Start

Add the following to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "blueprint": {
      "command": "npx",
      "args": ["-y", "@blueprintaix/blueprint-mcp"],
      "env": {
        "BLUEPRINT_API_KEY": "<your-api-key>",
        "EVM_PRIVATE_KEY": "<your-evm-private-key>",
        "SOLANA_PRIVATE_KEY": "<your-solana-private-key>"
      }
    }
  }
}
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `BLUEPRINT_API_KEY` | Yes | API key for Blueprint services |
| `EVM_PRIVATE_KEY` | One required | Private key for EVM transactions |
| `SOLANA_PRIVATE_KEY` | One required | Private key for Solana transactions (base58) |
| `BASE_RPC_URL` | No | Custom Base RPC endpoint |
| `SOLANA_RPC_URL` | No | Custom Solana RPC endpoint |

> At least one of `EVM_PRIVATE_KEY` or `SOLANA_PRIVATE_KEY` must be provided.

## Get an API Key

Contact **meet@emberlabs.io** to request a Blueprint API key.

## License

MIT
