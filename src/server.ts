import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import {
  Server,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "meu_secret_super_seguro_12345";
const VALID_TOKENS = (process.env.VALID_TOKENS || "demo-token,dev-client-1").split(",");
const INTERCOM_ACCESS_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";

const frontendPath = path.join(import.meta.dirname, "../frontend");

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ============ TOOLS COMPARTILHADAS ============

const mockArticles = [
  { title: "Guia de Integração", body: "Como integrar sua app com Clover" },
  { title: "Certificação Clover", body: "Processo de certificação" }
];

async function searchArticles(query: string) {
  try {
    const response = await fetch(
      `https://api.intercom.io/articles/search?query=${encodeURIComponent(query)}`,
      {
        headers: {
          Authorization: `Bearer ${INTERCOM_ACCESS_TOKEN}`,
          Accept: "application/json"
        }
      }
    );
    if (!response.ok) return mockArticles;
    const data = await response.json() as any;
    return data.data?.slice(0, 5) || mockArticles;
  } catch (error) {
    return mockArticles;
  }
}

async function getIntegrationGuide(level: string) {
  const guides: Record<string, string> = {
    beginner: "1. Crie conta\n2. Configure API keys\n3. Implemente OAuth",
    intermediate: "1. Webhooks\n2. Retry logic\n3. Error handling",
    advanced: "1. Load balancing\n2. Caching\n3. Monitoring"
  };
  return guides[level] || guides.beginner;
}

async function getApiExamples(language: string) {
  const examples: Record<string, string> = {
    javascript: "const clover = require('clover-sdk');",
    python: "import clover",
    java: "import com.clover.sdk.*;",
    php: "$api = new Clover\\Api();"
  };
  return examples[language] || examples.javascript;
}

async function getFaq(topic: string) {
  const faqs: Record<string, string> = {
    authentication: "Use OAuth 2.0 ou Personal Access Tokens",
    payments: "Clover Payments API com PCI compliance",
    webhooks: "Configure em Dashboard → Settings → Webhooks",
    errors: "401=Token inválido, 429=Rate limit, 500=Erro servidor"
  };
  return faqs[topic] || "Tópico não encontrado";
}

// ============ WEB API ============

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

    if (message.toLowerCase().includes("artigo") || message.toLowerCase().includes("buscar")) {
      tool_used = "search-articles";
      const articles = await searchArticles(message);
      response_text = articles.map((a: any) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("");
    } else if (message.toLowerCase().includes("guia")) {
      tool_used = "get-integration-guide";
      response_text = await getIntegrationGuide("beginner");
    } else if (message.toLowerCase().includes("exemplo")) {
      tool_used = "get-api-examples";
      response_text = await getApiExamples("javascript");
    } else if (message.toLowerCase().includes("dúvida")) {
      tool_used = "get-faq";
      response_text = await getFaq("authentication");
    } else {
      tool_used = "search-articles";
      const articles = await searchArticles(message);
      response_text = articles.map((a: any) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("");
    }

    res.json({ message: response_text, tool_used });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar" });
  }
});

app.use(express.static(frontendPath));

// ============ MCP SERVER (só roda se Claude Desktop conectar) ============

async function startMCPServer() {
  const mcpServer = new Server({
    name: "intercom-help-center",
    version: "1.0.0",
  });

  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search-articles",
        description: "Busca artigos no Help Center",
        inputSchema: {
          type: "object" as const,
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        name: "get-integration-guide",
        description: "Retorna guia de integração",
        inputSchema: {
          type: "object" as const,
          properties: { level: { type: "string" } },
        },
      },
      {
        name: "get-api-examples",
        description: "Exemplos de código",
        inputSchema: {
          type: "object" as const,
          properties: { language: { type: "string" } },
        },
      },
      {
        name: "get-faq",
        description: "Perguntas frequentes",
        inputSchema: {
          type: "object" as const,
          properties: { topic: { type: "string" } },
        },
      },
    ],
  }));

  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    let result = "";

    switch (name) {
      case "search-articles":
        const articles = await searchArticles(args.query);
        result = articles.map((a: any) => `${a.title}: ${a.body}`).join("\n");
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

    return { type: "text", text: result };
  });

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

// ============ STARTUP ============

app.listen(PORT, () => {
  console.log(`🌐 Web Server em http://localhost:${PORT}`);
  console.log(`📝 Página: https://mcp-intercom-help-center-piloto-v2.onrender.com`);
});

// MCP ativa só se Claude Desktop conectar (stdin é pipe, não TTY)
if (!process.stdin.isTTY) {
  startMCPServer().catch(console.error);
  console.log("🔌 MCP Server pronto para Claude Desktop");
}

export default app;
