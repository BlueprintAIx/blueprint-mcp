import { describe, expect, it, mock } from "bun:test";
import { EvmIntentExecutor } from "../src/evm/executor.js";
import type { EvmAction, Intent } from "../src/types.js";

describe("EvmIntentExecutor", () => {
    it("should execute a single action intent successfully", async () => {
        // Given
        const txHash = "0xabc123" as `0x${string}`;
        const walletClient = createMockWalletClient(() => Promise.resolve(txHash));
        const publicClient = createMockPublicClient('success');
        const executor = EvmIntentExecutor.create(walletClient as any, publicClient);
        const intent = createIntent([createEvmAction({ description: "Deposit USDC" })]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({
            hash: txHash,
            description: "Deposit USDC",
            status: "success",
        });
    });

    it("should execute multiple actions in sequence", async () => {
        // Given
        const hashes = ["0xaaa", "0xbbb", "0xccc"] as `0x${string}`[];
        let callCount = 0;
        const walletClient = createMockWalletClient(() => Promise.resolve(hashes[callCount++]!));
        const publicClient = createMockPublicClient('success');
        const executor = EvmIntentExecutor.create(walletClient as any, publicClient);
        const intent = createIntent([
            createEvmAction({ description: "Approve" }),
            createEvmAction({ description: "Deposit" }),
            createEvmAction({ description: "Stake" }),
        ]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results).toHaveLength(3);
        expect(results.map(r => r.description)).toEqual(["Approve", "Deposit", "Stake"]);
        expect(results.map(r => r.hash)).toEqual(hashes);
    });

    it("should handle transaction reverts", async () => {
        // Given
        const txHash = "0xfailed" as `0x${string}`;
        const walletClient = createMockWalletClient(() => Promise.resolve(txHash));
        const publicClient = createMockPublicClient('reverted');
        const executor = EvmIntentExecutor.create(walletClient as any, publicClient);
        const intent = createIntent([createEvmAction()]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results[0]?.status).toBe("failed");
        expect(results[0]?.hash).toBe(txHash);
    });

    it("should expect a transaction receipt with 2 confirmations", async () => {
        // Given
        const txHash = "0xdef456" as `0x${string}`;
        const walletClient = createMockWalletClient(() => Promise.resolve(txHash));
        const publicClient = createMockPublicClient('success');
        const executor = EvmIntentExecutor.create(walletClient as any, publicClient);
        const intent = createIntent([createEvmAction()]);

        // When
        await executor.execute(intent);

        // Then
        expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({
            hash: txHash,
            confirmations: 2,
        });
    });

    it("should handle transaction errors", async () => {
        // Given
        const walletClient = createMockWalletClient(() => Promise.reject(new Error("Insufficient funds")));
        const publicClient = createMockPublicClient('success');
        const executor = EvmIntentExecutor.create(walletClient as any, publicClient);
        const intent = createIntent([createEvmAction()]);

        // When & Then
        await expect(executor.execute(intent)).rejects.toThrow("Insufficient funds");
    });

    it("should ignore blueprint fee actions", async () => {
        // Given
        const txHash = "0xabc123" as `0x${string}`;
        const walletClient = createMockWalletClient(() => Promise.resolve(txHash));
        const publicClient = createMockPublicClient('success');
        const executor = EvmIntentExecutor.create(walletClient as any, publicClient);
        const intent = createIntent([
            createEvmAction({ description: "Approve token" }),
            createEvmAction({ description: "blueprint fee" }),
            createEvmAction({ description: "Deposit USDC" }),
        ]);

        // When
        const results = await executor.execute(intent);

        // Then
        expect(results).toHaveLength(2);
        expect(results.map(r => r.description)).toEqual(["Approve token", "Deposit USDC"]);
        expect(walletClient.sendTransaction).toHaveBeenCalledTimes(2);
    });
});


const createMockWalletClient = (sendTransaction: () => Promise<`0x${string}`>) => ({
    account: { address: "0x1234567890123456789012345678901234567890" },
    sendTransaction: mock(sendTransaction),
});

const createMockPublicClient = (status: 'success' | 'reverted') => ({
    waitForTransactionReceipt: mock(() => Promise.resolve({ status })),
});

const createIntent = (actions: EvmAction[]): Intent => ({
    id: "intent-1",
    requestId: "request-1",
    description: "Test intent",
    type: "evm",
    input: null,
    actions,
});

const createEvmAction = (overrides?: Partial<EvmAction>): EvmAction => ({
    chainId: "8453",
    description: "Test action",
    to: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    data: "0x1234",
    ...overrides,
});