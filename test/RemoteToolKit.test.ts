import { describe, expect, it, mock } from "bun:test";
import { RemoteToolKit } from "../src/remote.js";


describe("RemoteToolKit", () => {
    it("should list tools", async () => {
        // Given
        const client = createMockClient({
            listTools: () => Promise.resolve({
                tools: [{ name: "remote_tool", description: "A remote tool", inputSchema: { type: "object" } }],
            }),
        });

        // And
        const toolkit = new RemoteToolKit(client as any);

        // When
        const tools = await toolkit.listTools();

        // Then
        expect(tools).toHaveLength(1);
        expect(tools[0]).toMatchObject({
            name: "remote_tool",
            description: "A remote tool",
            inputSchema: { type: "object" }
        });
    });

    it("should sanitize tool schemas", async () => {
        // Given
        const client = createMockClient({
            listTools: () => Promise.resolve({
                tools: [{
                    name: "tool",
                    inputSchema: {
                        type: "object",
                        $schema: "http://json-schema.org/draft-07/schema#",
                        $ref: "#/definitions/Foo",
                        definitions: { Foo: { type: "string" } },
                        $defs: { Bar: { type: "number" } },
                        properties: { name: { type: "string" } },
                    },
                }],
            }),
        });

        // And
        const toolkit = new RemoteToolKit(client as any);

        // When
        const tools = await toolkit.listTools();

        // Then
        const schema = tools[0]?.inputSchema as Record<string, unknown>;
        expect(schema).toEqual({
            type: "object",
            properties: { name: { type: "string" } },
        });
    });

    it("should call remote tool", async () => {
        // Given
        const client = createMockClient({
            callTool: () => Promise.resolve({
                content: [{ type: "text", text: "success" }],
            }),
        });

        // And
        const toolkit = new RemoteToolKit(client as any);

        // When
        const result = await toolkit.call("remote_tool", { foo: "bar" });

        // Then
        expect(result.content[0]).toEqual({ type: "text", text: "success" });
        expect(client.callTool).toHaveBeenCalledWith({ name: "remote_tool", arguments: { foo: "bar" } });
    });

    it("should handle structured content", async () => {
        // Given
        const client = createMockClient({
            callTool: () => Promise.resolve({
                content: [],
                structuredContent: { data: "structured" },
            }),
        });

        // And
        const toolkit = new RemoteToolKit(client as any);

        // When
        const result = await toolkit.call("tool", {});

        // Then
        const text = (result.content[0] as { text: string }).text;
        expect(JSON.parse(text)).toEqual({ data: "structured" });
    });
});


const createMockClient = (overrides?: {
    listTools?: () => Promise<{ tools: any[] }>;
    callTool?: (args: any) => Promise<any>;
}) => ({
    listTools: mock(overrides?.listTools ?? (() => Promise.resolve({ tools: [] }))),
    callTool: mock(overrides?.callTool ?? (() => Promise.resolve({ content: [] }))),
});