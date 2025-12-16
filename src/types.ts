import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolKit {
    listTools(): Promise<Tool[]>;
    call(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
}

export interface Transaction {
    hash: string;
    description: string;
    status: 'success' | 'failed';
}

export interface IntentExecutor {
    execute(intent: Intent): Promise<Transaction[]>;
}

export interface SolanaAction {
    chainId: string
    description: string
    payload: string
}

export interface SuiAction {
    chainId: string
    description: string
    payload: string
}

export interface EvmAction {
    chainId: string
    description: string
    to: string
    data: string
}

export interface Intent {
    id: string
    requestId: string
    description: string
    type: string
    input: object | null
    actions: (SolanaAction | EvmAction | SuiAction)[]
}

export interface Context {
    wallet: {
        evmAddress: string;
        solanaAddress: string;
        suiAddress: string;
    };
    executeIntent(chainType: string, intent: Intent): Promise<Transaction[]>;
}

export interface BlueprintTool {
    definition: Tool;
    handler: (args: Record<string, unknown>, context: Context) => Promise<CallToolResult>;
}

