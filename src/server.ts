import express from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { query, validationResult } from "express-validator";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, "../frontend");

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://mcp-intercom-help-center-piloto-v2.onrender.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(rateLimit({windowMs: 60 * 60 * 1000, max: 100}));

// MCP TOOLS
const mcpTools = {
  "get-integration-guide": {
    description: "Guia passo a passo para integrar com Clover",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "Nível de experiência" }
      }
    }
  },
  "search-articles": {
    description: "Busca artigos no Help Center Intercom sobre integração Clover",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca" },
        limit: { type: "number", description: "Máximo de resultados" }
      },
      required: ["query"]
    }
  },
  "get-api-examples": {
    description: "Exemplos de código para integração com Clover API",
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["javascript", "python", "java", "php", "golang"], description: "Linguagem de programação" },
        endpoint: { type: "string", description: "Endpoint específico (ex: payments, orders)" }
      },
      required: ["language"]
    }
  },
  "get-faq": {
    description: "Perguntas frequentes sobre integração Clover",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Tópico da FAQ (ex: authentication, payments, webhooks)" }
      }
    }
  }
};

// Tool Handlers
async function handleTool(toolName: string, input: any): Promise<string> {
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;

  switch(toolName) {
    case "get-integration-guide": {
      const guides = {
        beginner: "# Guia Iniciante - Integração Clover\n1. Crie conta Clover\n2. Gere API Keys\n3. Use webhooks\n4. Teste com sandbox",
        intermediate: "# Guia Intermediário\n1. OAuth2 setup\n2. Webhooks avançados\n3. Sincronização dados\n4. Tratamento erros",
        advanced: "# Guia Avançado\n1. Multi-tenant\n2. Custom flows\n3. Performance tuning\n4. Security hardening"
      };
      return guides[input.level as keyof typeof guides] || guides.beginner;
    }

    case "search-articles": {
      try {
        const response = await axios.get('https://api.intercom.io/articles', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
          params: {
            query: input.query,
            per_page: input.limit || 5
          }
        });
        
        const articles = (response.data.data || []).slice(0, input.limit || 5);
        return articles.map((a: any) => `- **${a.title}**\n  ${a.body?.substring(0, 100)}...\n  Link: https://help.intercom.com/${a.slug}`).join('\n\n');
      } catch (error) {
        return `Erro ao buscar artigos: ${error}`;
      }
    }

    case "get-api-examples": {
      const examples: {[key: string]: {[key: string]: string}} = {
        javascript: {
          payments: "const clover = require('clover-sdk');\nconst payment = await clover.payments.create({ amount: 1000 });",
          orders: "const order = await clover.orders.create({ items: [...], total: 5000 });"
        },
        python: {
          payments: "from clover_sdk import Client\npayment = client.payments.create(amount=1000)",
          orders: "order = client.orders.create(items=[...], total=5000)"
        },
        java: {
          payments: "CloverClient client = new CloverClient();\nPayment payment = client.createPayment(1000);",
          orders: "Order order = client.createOrder(items, 5000);"
        },
        php: {
          payments: "$clover = new CloverClient();\n$payment = $clover->createPayment(1000);",
          orders: "$order = $clover->createOrder($items, 5000);"
        },
        golang: {
          payments: "payment := client.CreatePayment(1000)",
          orders: "order := client.CreateOrder(items, 5000)"
        }
      };
      
      const lang = input.language || "javascript";
      const endpoint = input.endpoint || "payments";
      return examples[lang]?.[endpoint] || "Exemplo não disponível";
    }

    case "get-faq": {
      const faqs: {[key: string]: string} = {
        authentication: "**Como autenticar?**\n1. Gere API key no dashboard\n2. Use Bearer token\n3. Inclua em headers",
        payments: "**Como processar pagamentos?**\n1. Use endpoint /payments\n2. Envie amount, currency, card\n3. Receba payment_id",
        webhooks: "**Como usar webhooks?**\n1. Configure endpoint em dashboard\n2. Receba eventos em tempo real\n3. Processe em seu backend",
        errors: "**Tratamento de erros**\n- 401: Autenticação falhou\n- 400: Dados inválidos\n- 429: Rate limit excedido"
      };
      
      const topic = input.topic || "authentication";
      return faqs[topic] || "FAQ não encontrada";
    }

    default:
      return "Tool não encontrada";
  }
}

// MCP Endpoints
app.post("/api/login", (req: any, res: any) => {
  const { token: clientToken } = req.body;
  const validTokens = process.env.VALID_TOKENS?.split(",") || ["demo-token"];
  if (!validTokens.includes(clientToken)) return res.status(401).json({ error: "Token inválido" });
  const token = jwt.sign({ token: clientToken }, process.env.JWT_SECRET || "dev-secret-key", { expiresIn: "24h" });
  res.json({ jwt: token });
});

// MCP Tools endpoint
app.get("/mcp/tools", (req: any, res: any) => {
  res.json({
    tools: Object.entries(mcpTools).map(([name, tool]) => ({
      name,
      ...tool
    }))
  });
});

// MCP Call Tool endpoint
app.post("/mcp/call-tool", async (req: any, res: any) => {
  const { tool, input } = req.body;
  
  if (!mcpTools[tool as keyof typeof mcpTools]) {
    return res.status(400).json({ error: "Tool não encontrada" });
  }
  
  try {
    const result = await handleTool(tool, input);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Chat endpoint (usa tools do MCP)
app.post("/api/chat", [query("message").notEmpty()], async (req: any, res: any) => {
  const { message } = req.body;
  
  // Detectar qual tool usar baseado na mensagem
  let toolName = "search-articles";
  let input: any = { query: message };
  
  if (message.toLowerCase().includes("exemplo") || message.toLowerCase().includes("código")) {
    toolName = "get-api-examples";
    input = { language: "javascript" };
  } else if (message.toLowerCase().includes("guia") || message.toLowerCase().includes("como começar")) {
    toolName = "get-integration-guide";
    input = { level: "beginner" };
  } else if (message.toLowerCase().includes("faq") || message.toLowerCase().includes("pergunta")) {
    toolName = "get-faq";
    input = { topic: "authentication" };
  }
  
  try {
    const result = await handleTool(toolName, input);
    res.json({ message: result, tool_used: toolName });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar" });
  }
});

app.use(express.static(frontendPath));
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

app.listen(PORT, () => console.log(`MCP Server rodando em ${PORT}`));
