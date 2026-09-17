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
    max: 100
});
app.use(limiter);
// MOCK DATA (fallback)
const mockArticles = [
    { title: "Guia de Integração", body: "Como integrar sua app com Clover" },
    { title: "Certificação Clover", body: "Processo de certificação" }
];
async function searchArticles(query) {
    try {
        const response = await fetch(`https://api.intercom.io/articles/search?query=${encodeURIComponent(query)}`, {
            headers: {
                Authorization: `Bearer ${INTERCOM_ACCESS_TOKEN}`,
                Accept: "application/json"
            }
        });
        if (!response.ok) {
            console.error(`Intercom error: ${response.status}`);
            return mockArticles;
        }
        const data = await response.json();
        return data.data?.slice(0, 5) || mockArticles;
    }
    catch (error) {
        console.error("Fetch error:", error);
        return mockArticles;
    }
}
async function getIntegrationGuide(level) {
    const guides = {
        beginner: "**Guia para Iniciantes**\n\n1. Crie uma conta\n2. Configure a API\n3. Implemente OAuth",
        intermediate: "**Intermediário**\n\n1. Configure webhooks\n2. Implemente retry",
        advanced: "**Avançado**\n\n1. Load balancing\n2. Caching"
    };
    return guides[level] || guides.beginner;
}
async function getApiExamples(language) {
    const examples = {
        javascript: `const response = await fetch('https://api.intercom.io/...')`,
        python: `import requests\nresponse = requests.get('https://api.intercom.io/...')`,
        java: `HttpClient client = HttpClient.newHttpClient();`,
        php: `$ch = curl_init();`
    };
    return examples[language] || examples.javascript;
}
async function getFaq(topic) {
    const faqs = {
        authentication: "**Autenticação**: Use OAuth 2.0",
        payments: "**Pagamentos**: Use Clover Payments API",
        webhooks: "**Webhooks**: Configure em Settings",
        errors: "**Erros**: 401=Token, 429=Rate limit"
    };
    return faqs[topic] || "Tópico não encontrado";
}
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
                ? articles.map((a) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("")
                : "Nenhum artigo encontrado";
        }
        else if (message.toLowerCase().includes("guia")) {
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
            tool_used = "search-articles";
            const articles = await searchArticles(message);
            response_text = articles.length > 0
                ? articles.map((a) => `<strong>${a.title}</strong><p>${a.body}</p>`).join("")
                : "Nenhum artigo encontrado";
        }
        res.json({ message: response_text, tool_used });
    }
    catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Erro ao processar" });
    }
});
app.use(express.static(frontendPath));
app.listen(PORT, () => {
    console.log(`🌐 Web Server rodando em http://localhost:${PORT}`);
});
export default app;
