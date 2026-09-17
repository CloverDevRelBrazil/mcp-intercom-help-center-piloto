import express from "express";
import cors from "cors";
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

app.use(cors({origin: ["https://mcp-devrel-clover.onrender.com", "https://mcp-intercom-help-center-piloto-v2.onrender.com", "http://localhost:3000", "http://localhost:5173"], credentials: true, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization']}));
app.use(express.json());
app.use(express.static(frontendPath));

const limiter = rateLimit({windowMs: 60 * 60 * 1000, max: 100, message: "Muitas requisições"});
app.use("/api/", limiter);

const validateJWT = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token obrigatório" });
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-key");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido" });
  }
};

app.post("/api/login", (req: any, res: any) => {
  const { token: clientToken } = req.body;
  const validTokens = process.env.VALID_TOKENS?.split(",") || ["demo-token"];
  if (!validTokens.includes(clientToken)) {
    return res.status(401).json({ error: "Token inválido" });
  }
  const token = jwt.sign({ token: clientToken }, process.env.JWT_SECRET || "dev-secret-key", { expiresIn: "24h" });
  res.json({ jwt: token });
});

app.get("/api/search", [query("query").notEmpty().withMessage("Query obrigatória")], async (req: any, res: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { q } = req.query;
  const mockArticles = [
    { id: "1", title: "Como Integrar com Clover", content: "Guia...", url: "https://docs.clover.com" },
    { id: "2", title: "API REST Clover", content: "Documentação...", url: "https://docs.clover.com/api" },
    { id: "3", title: "Autenticação OAuth 2.0", content: "Como...", url: "https://docs.clover.com/auth" }
  ];
  const filtered = mockArticles.filter(a => a.title.toLowerCase().includes(q.toLowerCase()));
  res.json({ query: q, total: filtered.length, articles: filtered });
});

app.get("/", (req, res) => {res.sendFile(path.join(frontendPath, "index.html"));});
app.listen(PORT, () => {console.log(`MCP Help Center rodando em http://localhost:${PORT}`);});
export default app;
