import express from "express";
import rateLimit from "express-rate-limit";
import { query, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
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
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
app.use(express.json());
app.use(express.static(frontendPath));
app.use(rateLimit({ windowMs: 60 * 60 * 1000, max: 100 }));
app.post("/api/login", (req, res) => {
    const { token: clientToken } = req.body;
    const validTokens = process.env.VALID_TOKENS?.split(",") || ["demo-token"];
    if (!validTokens.includes(clientToken))
        return res.status(401).json({ error: "Token inválido" });
    const token = jwt.sign({ token: clientToken }, process.env.JWT_SECRET || "dev-secret-key", { expiresIn: "24h" });
    res.json({ jwt: token });
});
app.get("/api/search", [query("query").notEmpty()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { q } = req.query;
    const mockArticles = [
        { id: "1", title: "Como Integrar com Clover", content: "Guia...", url: "https://docs.clover.com" },
        { id: "2", title: "API REST Clover", content: "Documentação...", url: "https://docs.clover.com/api" },
        { id: "3", title: "Autenticação OAuth 2.0", content: "Como...", url: "https://docs.clover.com/auth" }
    ];
    const filtered = mockArticles.filter(a => a.title.toLowerCase().includes(q.toLowerCase()));
    res.json({ query: q, total: filtered.length, articles: filtered });
});
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));
app.listen(PORT, () => console.log(`MCP rodando em ${PORT}`));
export default app;
