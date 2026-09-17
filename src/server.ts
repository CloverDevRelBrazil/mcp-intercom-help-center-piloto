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

app.post("/api/login", (req: any, res: any) => {
  const { token: clientToken } = req.body;
  const validTokens = process.env.VALID_TOKENS?.split(",") || ["demo-token"];
  if (!validTokens.includes(clientToken)) return res.status(401).json({ error: "Token inválido" });
  const token = jwt.sign({ token: clientToken }, process.env.JWT_SECRET || "dev-secret-key", { expiresIn: "24h" });
  res.json({ jwt: token });
});

app.get("/api/search", [query("query").notEmpty()], async (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { query: searchQuery } = req.query;
  const accessToken = process.env.INTERCOM_ACCESS_TOKEN;

  try {
    const response = await axios.get('https://api.intercom.io/articles', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      },
      params: {
        query: searchQuery,
        per_page: 50
      }
    });

    const articles = response.data.data || [];
    const searchLower = searchQuery.toLowerCase();
    
    const filtered = articles.filter((a: any) => 
      a.title.toLowerCase().includes(searchLower) ||
      (a.body && a.body.toLowerCase().includes(searchLower)) ||
      (a.description && a.description.toLowerCase().includes(searchLower))
    ).sort((a: any, b: any) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aMatch = aTitle.includes(searchLower) ? 1 : 0;
      const bMatch = bTitle.includes(searchLower) ? 1 : 0;
      return bMatch - aMatch;
    });

    res.json({ 
      query: searchQuery, 
      total: filtered.length, 
      articles: filtered.map((a: any) => ({
        id: a.id,
        title: a.title,
        content: (a.body || a.description || "").substring(0, 150) + '...',
        url: a.state === 'published' ? `https://help.intercom.com/${a.slug}` : '#'
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar artigos:', error);
    res.status(500).json({ error: 'Erro ao buscar artigos do Help Center' });
  }
});

app.use(express.static(frontendPath));
app.get("/", (req, res) => res.sendFile(path.join(frontendPath, "index.html")));

app.listen(PORT, () => console.log(`MCP rodando em ${PORT}`));
