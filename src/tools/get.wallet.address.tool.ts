import type { BlueprintTool } from "../types.js";

export const getWalletAddressTool: BlueprintTool = {
    definition: {
        name: "get_wallet_address",
        description: "fetch all the wallet addresses of the user",
        inputSchema: {
            type: "object",
            properties: {},
        },
    },
    handler: async (_args, context) => ({
        content: [
            {
                type: "text",
                text: JSON.stringify({
                    evmWalletAddress: context.wallet.evmAddress,
                    solanaWalletAddress: context.wallet.solanaAddress,
                    suiWalletAddress: context.wallet.suiAddress,
                }, null, 2),
            },
        ],
    }),
};
