import express from "express";
import path from "path";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "meu_secret_super_seguro_12345";
const VALID_TOKENS = (process.env.VALID_TOKENS || "demo-token,dev-client-1").split(",");
const INTERCOM_ACCESS_TOKEN = process.env.INTERCOM_ACCESS_TOKEN || "";

const frontendPath = path.join(import.meta.dirname, "../frontend");

// Middleware
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

// ============ TOOLS ============

async function searchArticles(query: string) {
  const response = await fetch(
    `https://api.intercom.io/articles/search?query=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${INTERCOM_ACCESS_TOKEN}`,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) throw new Error(`Erro Intercom: ${response.status}`);
  const data = await response.json() as any;
  return data.data ? data.data.slice(0, 5) : [];
}

async function getIntegrationGuide(level: string) {
  const guides: Record<string, string> = {
    beginner: "**Guia para Iniciantes**\n\n1. Crie uma conta no Clover\n2. Acesse o dashboard\n3. Gere suas credenciais API\n4. Implemente o OAuth",
    intermediate: "**Guia Intermediário**\n\n1. Configure webhooks\n2. Implemente retry logic\n3. Adicione logging\n4. Teste com sandbox",
    advanced: "**Guia Avançado**\n\n1. Arquitetura escalável\n2. Load balancing\n3. Caching distribuído\n4. Monitoramento em produção"
  };
  return guides[level] || guides.beginner;
}

async function getApiExamples(language: string) {
  const examples: Record<string, string> = {
    javascript: `const response = await fetch('https://api.intercom.io/...')`,
    python: `import requests\nresponse = requests.get('https://api.intercom.io/...')`,
    java: `HttpClient client = HttpClient.newHttpClient();`,
    php: `$ch = curl_init();`
  };
  return examples[language] || examples.javascript;
}

async function getFaq(topic: string) {
  const faqs: Record<string, string> = {
    authentication: "**Como autenticar?**\n\nUse OAuth 2.0 ou tokens de acesso pessoal.",
    payments: "**Como integrar pagamentos?**\n\nUse Clover Payments API com PCI compliance.",
    webhooks: "**Como configurar webhooks?**\n\nAcesse Settings → Webhooks",
    errors: "**Erros comuns?**\n\n- 401: Token inválido\n- 429: Rate limit\n- 500: Erro servidor"
  };
  return faqs[topic] || "Tópico não encontrado";
}

// ============ API ============

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
      response_text = articles.length > 0 
        ? articles.map((a: any) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("")
        : "Nenhum artigo encontrado";
    } else if (message.toLowerCase().includes("guia")) {
      tool_used = "get-integration-guide";
      response_text = await getIntegrationGuide("beginner");
    } else if (message.toLowerCase().includes("exemplo") || message.toLowerCase().includes("código")) {
      tool_used = "get-api-examples";
      response_text = await getApiExamples("javascript");
    } else if (message.toLowerCase().includes("dúvida") || message.toLowerCase().includes("faq")) {
      tool_used = "get-faq";
      response_text = await getFaq("authentication");
    } else {
      tool_used = "search-articles";
      const articles = await searchArticles(message);
      response_text = articles.length > 0 
        ? articles.map((a: any) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("")
        : "Nenhum artigo encontrado";
    }

    res.json({ message: response_text, tool_used });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar" });
  }
});

// Frontend
app.use(express.static(frontendPath));

// ============ STARTUP ============

app.listen(PORT, () => {
  console.log(`🌐 Web Server rodando em http://localhost:${PORT}`);
  console.log(`MCP: Configure ~/.claude_desktop_config.json para usar como MCP Server`);
});

export default app;
