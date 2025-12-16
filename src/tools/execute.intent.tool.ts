import type { BlueprintTool, Intent } from "../types.js";

export const executeIntentTool: BlueprintTool = {
    definition: {
        name: "execute_intent",
        description: "Executes an intent by signing and sending the transaction to the blockchain. Use this after receiving an intent from deposit/withdraw tools.",
        inputSchema: {
            type: "object",
            properties: {
                chainType: {
                    type: "string",
                    enum: ["solana", "evm", "sui"],
                    description: "The chain type of the intent",
                },
                intent: {
                    type: "string",
                    description: "The base64-encoded intent string returned by the blueprint tools",
                },
            },
            required: ["chainType", "intent"],
        },
    },
    handler: async (args, context) => {
        const { chainType, intent } = args as { chainType: string; intent: string };
        const rawIntent = Buffer.from(intent, 'base64').toString('utf-8');
        const intentDto = JSON.parse(rawIntent) as Intent;
        const results = await context.executeIntent(chainType, intentDto);

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        transactions: results,
                        message: `Successfully executed ${results.length} transaction(s)`,
                    }, null, 2),
                },
            ],
        };
    }
};
