import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const server = new Server({
    name: "intercom-help-center",
    version: "1.0.0",
});
const mockArticles = [
    { title: "Guia de Integração", body: "Como integrar com Clover" },
    { title: "Certificação", body: "Processo de certificação" }
];
async function searchArticles(query) {
    return mockArticles;
}
server.setRequestHandler({ method: "tools/list" }, async () => ({
    tools: [
        {
            name: "search-articles",
            description: "Busca artigos",
            inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        },
        {
            name: "get-integration-guide",
            description: "Guia",
            inputSchema: { type: "object", properties: { level: { type: "string" } } }
        },
        {
            name: "get-api-examples",
            description: "Exemplos",
            inputSchema: { type: "object", properties: { language: { type: "string" } } }
        },
        {
            name: "get-faq",
            description: "FAQ",
            inputSchema: { type: "object", properties: { topic: { type: "string" } } }
        }
    ]
}));
server.setRequestHandler({ method: "tools/call" }, async (request) => {
    const { name, arguments: args } = request.params;
    const articles = await searchArticles(args.query || "");
    return { type: "text", text: articles.map((a) => `${a.title}: ${a.body}`).join("\n") };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
