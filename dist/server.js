import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Express Setup
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "meu_secret_super_seguro_12345";
const VALID_TOKENS = (process.env.VALID_TOKENS || "demo-token,dev-client-1").split(",");
const INTERCOM_ACCESS_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";
const INTERCOM_WORKSPACE_ID = process.env.INTERCOM_WORKSPACE_ID || "";
const frontendPath = path.join(import.meta.dirname, "../frontend");
// Middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS")
        return res.sendStatus(200);
    next();
});
app.use(express.json());
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Muitas requisições, tente mais tarde"
});
app.use(limiter);
// ============ TOOLS COMPARTILHADAS ============
async function searchArticles(query) {
    const response = await fetch(`https://api.intercom.io/articles/search?query=${encodeURIComponent(query)}`, {
        headers: {
            Authorization: `Bearer ${INTERCOM_ACCESS_TOKEN}`,
            Accept: "application/json"
        }
    });
    if (!response.ok)
        throw new Error(`Erro Intercom: ${response.status}`);
    const data = await response.json();
    return data.data ? data.data.slice(0, 5) : [];
}
async function getIntegrationGuide(level) {
    const guides = {
        beginner: "**Guia para Iniciantes**\n\n1. Crie uma conta no Clover\n2. Acesse o dashboard\n3. Gere suas credenciais API\n4. Implemente o OAuth\n\n[Leia mais](https://help.intercom.com)",
        intermediate: "**Guia Intermediário**\n\n1. Configure webhooks\n2. Implemente retry logic\n3. Adicione logging\n4. Teste com sandbox\n\n[Documentação](https://help.intercom.com)",
        advanced: "**Guia Avançado**\n\n1. Arquitetura escalável\n2. Load balancing\n3. Caching distribuído\n4. Monitoramento em produção\n\n[Arquitetura](https://help.intercom.com)"
    };
    return guides[level] || guides.beginner;
}
async function getApiExamples(language) {
    const examples = {
        javascript: `// JavaScript\nconst response = await fetch('https://api.intercom.io/...')\nconst data = await response.json()`,
        python: `# Python\nimport requests\nresponse = requests.get('https://api.intercom.io/...')\ndata = response.json()`,
        java: `// Java\nHttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()...`,
        php: `<?php\n$ch = curl_init();\ncurl_setopt($ch, CURLOPT_URL, 'https://api.intercom.io/...');`
    };
    return examples[language] || examples.javascript;
}
async function getFaq(topic) {
    const faqs = {
        authentication: "**Como autenticar?**\n\nUse OAuth 2.0 ou tokens de acesso pessoal.",
        payments: "**Como integrar pagamentos?**\n\nUse Clover Payments API com PCI compliance.",
        webhooks: "**Como configurar webhooks?**\n\nAcesse Settings → Webhooks → Configure URLs.",
        errors: "**Erros comuns?**\n\n- 401: Token inválido\n- 429: Rate limit\n- 500: Erro servidor"
    };
    return faqs[topic] || "Tópico não encontrado";
}
// ============ WEB API ENDPOINTS ============
app.post("/api/login", (req, res) => {
    const { token } = req.body;
    if (!token || !VALID_TOKENS.includes(token)) {
        return res.status(401).json({ error: "Token inválido" });
    }
    const jwt_token = jwt.sign({ token }, JWT_SECRET, { expiresIn: "24h" });
    res.json({ jwt: jwt_token });
});
app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body;
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Não autorizado" });
        }
        let tool_used = "";
        let response_text = "";
        if (message.toLowerCase().includes("buscar") || message.toLowerCase().includes("artigo") || message.toLowerCase().includes("ajuda")) {
            tool_used = "search-articles";
            const articles = await searchArticles(message);
            response_text = articles.length > 0
                ? articles.map((a) => `- ${a.title}: ${a.body}`).join("\n")
                : "Nenhum artigo encontrado";
        }
        else if (message.toLowerCase().includes("guia") || message.toLowerCase().includes("iniciante")) {
            tool_used = "get-integration-guide";
            response_text = await getIntegrationGuide("beginner");
        }
        else if (message.toLowerCase().includes("exemplo") || message.toLowerCase().includes("código")) {
            tool_used = "get-api-examples";
            response_text = await getApiExamples("javascript");
        }
        else if (message.toLowerCase().includes("dúvida") || message.toLowerCase().includes("faq")) {
            tool_used = "get-faq";
            response_text = await getFaq("authentication");
        }
        else {
            // Default: search
            tool_used = "search-articles";
            const articles = await searchArticles(message);
            response_text = articles.length > 0
                ? articles.map((a) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("")
                : "Nenhum artigo encontrado";
        }
        res.json({ message: response_text, tool_used });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao processar mensagem" });
    }
});
app.get("/mcp/tools", (req, res) => {
    res.json({
        tools: [
            { name: "search-articles", description: "Busca artigos no Help Center do Intercom" },
            { name: "get-integration-guide", description: "Guia de integração (beginner/intermediate/advanced)" },
            { name: "get-api-examples", description: "Exemplos de código em várias linguagens" },
            { name: "get-faq", description: "Perguntas frequentes por tópico" }
        ]
    });
});
app.post("/mcp/call-tool", async (req, res) => {
    try {
        const { tool, input } = req.body;
        let result = "";
        switch (tool) {
            case "search-articles":
                result = JSON.stringify(await searchArticles(input.query));
                break;
            case "get-integration-guide":
                result = await getIntegrationGuide(input.level || "beginner");
                break;
            case "get-api-examples":
                result = await getApiExamples(input.language || "javascript");
                break;
            case "get-faq":
                result = await getFaq(input.topic || "authentication");
                break;
            default:
                return res.status(400).json({ error: "Tool não encontrada" });
        }
        res.json({ result });
    }
    catch (error) {
        res.status(500).json({ error: "Erro ao chamar tool" });
    }
});
// Frontend
app.use(express.static(frontendPath));
// ============ MCP SERVER ============
class IntercomMCPServer {
    constructor() {
        this.server = new Server({
            name: "intercom-help-center-mcp",
            version: "1.0.0"
        });
        this.setupHandlers();
    }
    setupHandlers() {
        // List Tools
        this.server.setRequestHandler({ method: "tools/list" }, async () => ({
            tools: [
                {
                    name: "search-articles",
                    description: "Busca artigos no Help Center do Intercom",
                    inputSchema: {
                        type: "object",
                        properties: {
                            query: { type: "string", description: "Termo de busca" }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "get-integration-guide",
                    description: "Retorna guia de integração",
                    inputSchema: {
                        type: "object",
                        properties: {
                            level: { type: "string", enum: ["beginner", "intermediate", "advanced"] }
                        }
                    }
                },
                {
                    name: "get-api-examples",
                    description: "Retorna exemplos de código",
                    inputSchema: {
                        type: "object",
                        properties: {
                            language: { type: "string", enum: ["javascript", "python", "java", "php"] }
                        }
                    }
                },
                {
                    name: "get-faq",
                    description: "Retorna FAQ por tópico",
                    inputSchema: {
                        type: "object",
                        properties: {
                            topic: { type: "string", enum: ["authentication", "payments", "webhooks", "errors"] }
                        }
                    }
                }
            ]
        }));
        // Call Tool
        this.server.setRequestHandler({ method: "tools/call" }, async (request) => {
            const { name, arguments: args } = request.params;
            let result = "";
            try {
                switch (name) {
                    case "search-articles":
                        const articles = await searchArticles(args.query);
                        result = JSON.stringify(articles, null, 2);
                        break;
                    case "get-integration-guide":
                        result = await getIntegrationGuide(args.level || "beginner");
                        break;
                    case "get-api-examples":
                        result = await getApiExamples(args.language || "javascript");
                        break;
                    case "get-faq":
                        result = await getFaq(args.topic || "authentication");
                        break;
                    default:
                        throw new Error(`Tool desconhecida: ${name}`);
                }
            }
            catch (error) {
                return {
                    type: "text",
                    text: `Erro: ${error instanceof Error ? error.message : "Erro desconhecido"}`
                };
            }
            return { type: "text", text: result };
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log("MCP Server conectado via stdio");
    }
}
// ============ STARTUP ============
// Inicia Web Server
app.listen(PORT, () => {
    console.log(`🌐 Web Server rodando em http://localhost:${PORT}`);
});
// Inicia MCP Server (se stdin for um pipe do Claude Desktop)
const mcpServer = new IntercomMCPServer();
if (!process.stdin.isTTY) {
    mcpServer.run().catch(console.error);
}
export default app;
