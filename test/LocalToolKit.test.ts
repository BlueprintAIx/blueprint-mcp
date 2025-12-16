import { describe, expect, it } from "bun:test";
import { LocalToolKit } from "../src/tools/index.js";
import type { Context } from "../src/types.js";

describe("LocalToolKit", () => {
    it("should identify registered tools", () => {
        // Given
        const toolkit = new LocalToolKit(createMockContext());

        // When & Then
        expect(toolkit.has("get_wallet_address")).toBe(true);
        expect(toolkit.has("execute_intent")).toBe(true);
    });

    it("should list registered tools", async () => {
        // Given
        const toolkit = new LocalToolKit(createMockContext());

        // When
        const tools = await toolkit.listTools();

        // Then
        const names = tools.map(t => t.name);
        expect(names).toContain("get_wallet_address");
        expect(names).toContain("execute_intent");
    });

    it("should call a registered tool", async () => {
        // Given
        const context = createMockContext({
            wallet: { evmAddress: "0xABC", solanaAddress: "solABC", suiAddress: "suiABC" },
        });

        // And
        const toolkit = new LocalToolKit(context);

        // When
        const result = await toolkit.call("get_wallet_address", {});

        // Then
        const text = (result.content[0] as { text: string }).text;
        const parsed = JSON.parse(text);
        expect(parsed).toMatchObject({
            evmWalletAddress: "0xABC",
            solanaWalletAddress: "solABC",
            suiWalletAddress: "suiABC",
        });
    });

    it("should handle unknown tool calls", async () => {
        // Given
        const toolkit = new LocalToolKit(createMockContext());

        // When
        const result = await toolkit.call("nonexistent_tool", {});

        // Then
        expect(result.isError).toBe(true);
        const text = (result.content[0] as { text: string }).text;
        expect(text).toContain("unknown local tool");
    });
});


const createMockContext = (overrides?: Partial<Context>): Context => ({
    wallet: { evmAddress: "0x123", solanaAddress: "sol123", suiAddress: "sui123" },
    executeIntent: () => Promise.resolve([]),
    ...overrides,
});