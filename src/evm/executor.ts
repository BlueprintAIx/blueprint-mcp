import type { Account, Chain, Transport, WalletClient } from "viem";
import type { EvmAction, Intent, IntentExecutor, Transaction } from "../types.js";
import { evmChains } from "./chain.js";

interface ReceiptProvider {
    waitForTransactionReceipt(args: { hash: `0x${string}`; confirmations?: number }): Promise<{ status: 'success' | 'reverted' }>;
}

export class EvmIntentExecutor implements IntentExecutor {
    constructor(
        private readonly walletClient: WalletClient<Transport, Chain, Account>,
        private readonly publicClient: ReceiptProvider
    ) { }

    static create(walletClient: WalletClient, publicClient: ReceiptProvider): EvmIntentExecutor {
        return new EvmIntentExecutor(
            walletClient as WalletClient<Transport, Chain, Account>,
            publicClient as ReceiptProvider
        );
    }

    async execute(intent: Intent): Promise<Transaction[]> {
        const results: Transaction[] = [];

        for (const action of intent.actions.filter((action) => !action.description.toLowerCase().includes('blueprint fee'))) {
            const evmAction = action as EvmAction;
            const chain = evmChains[Number(evmAction.chainId)];

            const hash = await this.walletClient.sendTransaction({
                chain,
                account: this.walletClient.account!,
                to: evmAction.to as `0x${string}`,
                data: evmAction.data as `0x${string}`,
            });

            const receipt = await this.publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 2,
            });

            results.push({
                hash,
                description: evmAction.description,
                status: receipt.status === 'success' ? 'success' : 'failed',
            });
        }

        return results;
    }
}
