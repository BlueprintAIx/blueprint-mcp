import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult, TextContent, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolKit } from "./types.js";

export class RemoteToolKit implements ToolKit {
    constructor(private readonly client: Client) { }

    async listTools(): Promise<Tool[]> {
        const result = await this.client.listTools();

        return result.tools.map((tool) => ({
            ...tool,
            inputSchema: this.sanitizeSchema(tool.inputSchema) as Tool['inputSchema'],
            outputSchema: undefined,
        })) as Tool[];
    }

    async call(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
        const result = await this.client.callTool({ name, arguments: args });
        const toolResult = result as CallToolResult & { structuredContent?: unknown };

        if (toolResult.structuredContent && (!toolResult.content || toolResult.content.length === 0)) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(toolResult.structuredContent, null, 2),
                    } as TextContent,
                ],
            };
        }

        return toolResult;
    }

    private sanitizeSchema(schema: unknown): unknown {
        if (schema === null || typeof schema !== 'object') {
            return schema;
        }

        if (Array.isArray(schema)) {
            return schema.map((item) => this.sanitizeSchema(item));
        }

        const obj = schema as Record<string, unknown>;
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            if (['$schema', '$ref', 'definitions', '$defs'].includes(key)) {
                continue;
            }
            sanitized[key] = this.sanitizeSchema(value);
        }

        return sanitized;
    }
}
