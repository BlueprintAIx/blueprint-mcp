import { describe, expect, it, mock } from "bun:test";
import type { Intent, SolanaAction } from "../src/types.js";
import { SolanaIntentExecutor, type SolanaClient } from "../src/solana/executor.js";

describe("SolanaIntentExecutor", () => {
    it("should execute a single action intent successfully", async () => {
        // Given
        const txHash = "txhash123";
        const client = createMockClient({
            signAndSendTransaction: () => Promise.resolve(txHash),
        });
        const executor = new SolanaIntentExecutor(client);
        const intent = createIntent([createSolanaAction({ description: "Swap SOL to USDC" })]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({
            hash: txHash,
            description: "Swap SOL to USDC",
            status: "success",
        });
    });

    it("should execute multiple actions in sequence", async () => {
        // Given
        const hashes = ["tx1", "tx2", "tx3"];
        let callCount = 0;
        const client = createMockClient({
            signAndSendTransaction: () => Promise.resolve(hashes[callCount++]!),
        });
        const executor = new SolanaIntentExecutor(client);
        const intent = createIntent([
            createSolanaAction({ description: "Approve" }),
            createSolanaAction({ description: "Swap" }),
            createSolanaAction({ description: "Transfer" }),
        ]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results).toHaveLength(3);
        expect(results.map(r => r.description)).toEqual(["Approve", "Swap", "Transfer"]);
        expect(results.map(r => r.hash)).toEqual(hashes);
    });

    it("should handle transaction failures", async () => {
        // Given
        const client = createMockClient({
            confirmTransaction: () => Promise.resolve({ err: "Transaction failed" }),
        });
        const executor = new SolanaIntentExecutor(client);
        const intent = createIntent([createSolanaAction()]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results[0]?.status).toBe("failed");
    });

    it("should confirm transaction", async () => {
        // Given
        const txHash = "txhash456";
        const client = createMockClient({
            signAndSendTransaction: () => Promise.resolve(txHash),
        });
        const executor = new SolanaIntentExecutor(client);
        const intent = createIntent([createSolanaAction()]);

        // When
        await executor.execute(intent);

        // Then
        expect(client.confirmTransaction).toHaveBeenCalledWith(txHash);
    });

    it("should handle transaction errors", async () => {
        // Given
        const client = createMockClient({
            signAndSendTransaction: () => Promise.reject(new Error("Network error")),
        });
        const executor = new SolanaIntentExecutor(client);
        const intent = createIntent([createSolanaAction()]);

        // When & Then
        await expect(executor.execute(intent)).rejects.toThrow("Network error");
    });

    it("should ignore blueprint fee actions", async () => {
        // Given
        const txHash = "txhash123";
        const client = createMockClient({
            signAndSendTransaction: () => Promise.resolve(txHash),
        });
        const executor = new SolanaIntentExecutor(client);
        const intent = createIntent([
            createSolanaAction({ description: "Swap SOL" }),
            createSolanaAction({ description: "blueprint fee" }),
            createSolanaAction({ description: "Transfer USDC" }),
        ]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results).toHaveLength(2);
        expect(results.map(r => r.description)).toEqual(["Swap SOL", "Transfer USDC"]);
        expect(client.signAndSendTransaction).toHaveBeenCalledTimes(2);
    });
});

const createMockClient = (overrides?: {
    signAndSendTransaction?: () => Promise<string>;
    confirmTransaction?: () => Promise<{ err: any }>;
}): SolanaClient => ({
    signAndSendTransaction: mock(overrides?.signAndSendTransaction ?? (() => Promise.resolve("txhash123"))),
    confirmTransaction: mock(overrides?.confirmTransaction ?? (() => Promise.resolve({ err: null }))),
});

const createIntent = (actions: SolanaAction[]): Intent => ({
    id: "intent-1",
    requestId: "request-1",
    description: "Test intent",
    type: "solana",
    input: null,
    actions,
});

const createSolanaAction = (overrides?: Partial<SolanaAction>): SolanaAction => ({
    chainId: "mainnet-beta",
    description: "Test action",
    payload: "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEDAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    ...overrides,
});
