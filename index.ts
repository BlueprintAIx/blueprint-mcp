#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import {
    createPublicClient,
    createWalletClient,
    http,
    type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { createSigner, wrapFetchWithPayment } from "x402-fetch";
import { z } from "zod";

import { EvmIntentExecutor } from "./src/evm/executor.js";
import { RemoteToolKit } from "./src/remote.js";
import { SolanaIntentExecutor } from "./src/solana/executor.js";
import { LocalToolKit } from "./src/tools/index.js";
import type { Context, Intent } from "./src/types.js";
import { log } from "./src/utils/logger.js";

const envSchema = z.object({
    BLUEPRINT_API_KEY: z.string().optional().transform(s => s?.trim()),
    BLUEPRINT_MCP_URL: z.string().default('https://blueprint-beta.api.sui-dev.bluefin.io/discover/mcp'),
    EVM_PRIVATE_KEY: z.string().transform(s => s.trim()).optional().transform(s => s && !s.startsWith('0x') ? `0x${s}` : s),
    BASE_RPC_URL: z.string().default('https://mainnet.base.org'),
    SOLANA_PRIVATE_KEY: z.string().transform(s => s.trim()).optional(),
    SOLANA_RPC_URL: z.string().default('https://api.mainnet-beta.solana.com'),
}).refine(
    data => data.EVM_PRIVATE_KEY || data.SOLANA_PRIVATE_KEY,
    { message: 'At least one of EVM_PRIVATE_KEY or SOLANA_PRIVATE_KEY is required' }
).refine(
    data => data.BLUEPRINT_API_KEY || data.EVM_PRIVATE_KEY,
    { message: 'EVM_PRIVATE_KEY is required when BLUEPRINT_API_KEY is not provided (needed for x402 payments)' }
);

const env = envSchema.parse(process.env);

function createEvmExecutor(privateKey: Hex) {
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({ chain: base, transport: http(env.BASE_RPC_URL) });
    const walletClient = createWalletClient({ account, chain: base, transport: http(env.BASE_RPC_URL) });
    log(`EVM wallet address: ${account.address}`);
    return { executor: EvmIntentExecutor.create(walletClient, publicClient), address: account.address };
}

function createSolanaExecutor(privateKey: string) {
    const connection = new Connection(env.SOLANA_RPC_URL);
    const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
    log(`Solana wallet address: ${keypair.publicKey.toBase58()}`);
    return { executor: SolanaIntentExecutor.create(connection, keypair), address: keypair.publicKey.toBase58() };
}

async function createRemoteTransport(): Promise<StreamableHTTPClientTransport> {
    const acceptHeader = 'application/json, text/event-stream';

    if (env.BLUEPRINT_API_KEY) {
        return new StreamableHTTPClientTransport(new URL(env.BLUEPRINT_MCP_URL), {
            requestInit: {
                headers: {
                    Authorization: `Bearer ${env.BLUEPRINT_API_KEY}`,
                    Accept: acceptHeader,
                },
            },
        });
    }

    log("no api key provided, using x402 to make tool calls!!!");
    const signer = await createSigner('base', env.EVM_PRIVATE_KEY as Hex);
    const fetchWithHeaders = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        const headers = new Headers(init?.headers);
        headers.set('Accept', acceptHeader);
        headers.set('Content-Type', 'application/json');
        return fetch(input, { ...init, headers });
    };

    return new StreamableHTTPClientTransport(new URL(env.BLUEPRINT_MCP_URL), {
        fetch: wrapFetchWithPayment(fetchWithHeaders as typeof fetch, signer),
    });
}

async function main() {
    const evmExecutor = env.EVM_PRIVATE_KEY ? createEvmExecutor(env.EVM_PRIVATE_KEY as `0x${string}`) : null;
    const solanaExecutor = env.SOLANA_PRIVATE_KEY ? createSolanaExecutor(env.SOLANA_PRIVATE_KEY) : null;

    const context: Context = {
        wallet: { evmAddress: evmExecutor?.address ?? '', solanaAddress: solanaExecutor?.address ?? '', suiAddress: '' },
        executeIntent: (chainType: string, intent: Intent) => {
            if (chainType === 'evm') {
                if (!evmExecutor) throw new Error('EVM executor not configured. Set EVM_PRIVATE_KEY.');
                return evmExecutor.executor.execute(intent);
            }
            if (chainType === 'solana') {
                if (!solanaExecutor) throw new Error('Solana executor not configured. Set SOLANA_PRIVATE_KEY.');
                return solanaExecutor.executor.execute(intent);
            }
            throw new Error(`Unsupported chain type: ${chainType}`);
        },
    };

    const localToolKit = new LocalToolKit(context);
    const remoteClient = new Client({ name: "blueprint-mcp-client", version: "1.0.0" });
    const remoteTransport = await createRemoteTransport();
    await remoteClient.connect(remoteTransport);
    const remoteToolKit = new RemoteToolKit(remoteClient);

    const mcpServer = new McpServer(
        { name: "blueprint-mcp", version: "1.0.0" },
        { capabilities: { tools: {} } },
    );

    mcpServer.server.setRequestHandler(ListToolsRequestSchema, async () => {
        try {
            const [remote, local] = await Promise.all([
                remoteToolKit.listTools(),
                localToolKit.listTools(),
            ]);
            return { tools: [...remote, ...local] };
        } catch (error) {
            log("Failed to fetch remote tools", error);
            return { tools: await localToolKit.listTools() };
        }
    });

    mcpServer.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args = {} } = request.params;
        if (localToolKit.has(name)) {
            log(`calling local tool '${name}' with args: ${JSON.stringify(args)}`);
            return localToolKit.call(name, args as Record<string, unknown>);
        }

        try {
            log(`calling remote tool '${name}' with args: ${JSON.stringify(args)}`);
            return await remoteToolKit.call(name, args as Record<string, unknown>);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [{ type: "text", text: JSON.stringify({ error: `error calling remote tool '${name}': ${errorMessage}` }) }],
                isError: true,
            };
        }
    });

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    log("Blueprint MCP server started");
    log(`Blueprint MCP URL: ${env.BLUEPRINT_MCP_URL}`);
}

main().catch((error) => {
    log("error starting server", error);
    process.exit(1);
});
