#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();
const TOKEN = process.env.INTERCOM_ACCESS_TOKEN, WS = process.env.INTERCOM_WORKSPACE_ID;
if (!TOKEN || !WS) {
    console.error("Erro: Configure .env");
    process.exit(1);
}
const client = axios.create({ baseURL: "https://api.intercom.io", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } });
const tools = [{ name: "search_help_center", description: "Busca artigos", inputSchema: { type: "object", properties: { query: { type: "string" }, lang: { type: "string", default: "pt" } }, required: ["query"] } }, { name: "get_article", description: "Obtém artigo", inputSchema: { type: "object", properties: { article_id: { type: "string" } }, required: ["article_id"] } }, { name: "list_categories", description: "Lista categorias", inputSchema: { type: "object", properties: {}, required: [] } }, { name: "get_category_articles", description: "Artigos da categoria", inputSchema: { type: "object", properties: { category_id: { type: "string" } }, required: ["category_id"] } }];
async function search(q, l = "pt") { try {
    const r = await client.get("/articles", { params: { query: q, lang: l, per_page: 10 } });
    return JSON.stringify({ success: true, results: (r.data.articles || []).map(a => ({ id: a.id, title: a.title, url: a.url })) });
}
catch (e) {
    return JSON.stringify({ success: false, error: e.message });
} }
async function getArt(id) { try {
    const r = await client.get(`/articles/${id}`);
    return JSON.stringify({ success: true, article: r.data });
}
catch (e) {
    return JSON.stringify({ success: false, error: e.message });
} }
async function listCat() { try {
    const r = await client.get("/help_center/categories");
    return JSON.stringify({ success: true, categories: r.data.data || [] });
}
catch (e) {
    return JSON.stringify({ success: false, error: e.message });
} }
async function getArtsByCat(cid) { try {
    const r = await client.get(`/help_center/categories/${cid}/articles`);
    return JSON.stringify({ success: true, articles: r.data.data || [] });
}
catch (e) {
    return JSON.stringify({ success: false, error: e.message });
} }
const server = new Server({ name: "mcp-intercom-help-center", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (req) => { const { params: p } = req, { name: n, arguments: a } = p; const args = a; let result = ""; switch (n) {
    case "search_help_center":
        result = await search(args.query, args.lang || "pt");
        break;
    case "get_article":
        result = await getArt(args.article_id);
        break;
    case "list_categories":
        result = await listCat();
        break;
    case "get_category_articles":
        result = await getArtsByCat(args.category_id);
        break;
    default: result = JSON.stringify({ error: "Desconhecido" });
} return { content: [{ type: "text", text: result }] }; });
async function main() { const transport = new StdioServerTransport(); await server.connect(transport); console.error("✅ MCP Help Center iniciado!"); }
main().catch(e => { console.error("Erro:", e); process.exit(1); });
