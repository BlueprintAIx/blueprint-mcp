import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import type { Intent, IntentExecutor, SolanaAction, Transaction } from "../types.js";

export interface SolanaClient {
    signAndSendTransaction(payload: string): Promise<string>;
    confirmTransaction(hash: string): Promise<{ err: any }>;
}

export class SolanaIntentExecutor implements IntentExecutor {
    constructor(private readonly client: SolanaClient) { }

    static create(connection: Connection, keypair: Keypair): SolanaIntentExecutor {
        const client: SolanaClient = {
            async signAndSendTransaction(payload: string): Promise<string> {
                const txBuffer = Buffer.from(payload, 'base64');
                const transaction = VersionedTransaction.deserialize(txBuffer);
                transaction.sign([keypair]);
                return connection.sendTransaction(transaction);
            },
            async confirmTransaction(hash: string): Promise<{ err: any }> {
                const result = await connection.confirmTransaction(hash, 'confirmed');
                return result.value;
            },
        };
        return new SolanaIntentExecutor(client);
    }

    async execute(intent: Intent): Promise<Transaction[]> {
        const results: Transaction[] = [];

        for (const action of intent.actions.filter((action) => !action.description.toLowerCase().includes('blueprint fee'))) {
            const solanaAction = action as SolanaAction;

            const hash = await this.client.signAndSendTransaction(solanaAction.payload);
            const confirmation = await this.client.confirmTransaction(hash);

            results.push({
                hash,
                description: solanaAction.description,
                status: confirmation.err ? 'failed' : 'success',
            });
        }

        return results;
    }
}
