import type { CallToolResult, TextContent, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { BlueprintTool, Context, ToolKit } from "../types.js";

import { executeIntentTool } from "./execute.intent.tool.js";
import { getWalletAddressTool } from "./get.wallet.address.tool.js";

export class LocalToolKit implements ToolKit {
    private readonly registry: BlueprintTool[] = [
        getWalletAddressTool,
        executeIntentTool,
    ];
    private readonly names: Set<string>;

    constructor(private readonly context: Context) {
        this.names = new Set(this.registry.map((t) => t.definition.name));
    }

    has(name: string): boolean {
        return this.names.has(name);
    }

    async listTools(): Promise<Tool[]> {
        return this.registry.map((t) => t.definition);
    }

    async call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
        const tool = this.registry.find((t) => t.definition.name === name);
        if (tool) {
            return tool.handler(args, this.context);
        }

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ error: `unknown local tool: ${name}` }, null, 2),
                } as TextContent,
            ],
            isError: true,
        };
    }
}
