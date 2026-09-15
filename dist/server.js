import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { query, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(helmet());
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000', 'https://mcp-intercom-help-center-1.onrender.com'],
    credentials: true
}));
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 100,
    message: 'Muitas requisições',
});
app.use('/api/', limiter);
const validateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'Token obrigatório' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Token inválido' });
    }
};
app.post('/api/login', (req, res) => {
    const { token: clientToken } = req.body;
    const validTokens = process.env.VALID_TOKENS?.split(',') || ['demo-token'];
    if (!validTokens.includes(clientToken)) {
        return res.status(401).json({ error: 'Token inválido' });
    }
    const jwtToken = jwt.sign({ client_id: clientToken, workspace_id: process.env.INTERCOM_WORKSPACE_ID }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '24h' });
    res.json({ accessToken: jwtToken, expiresIn: 86400 });
});
app.get('/api/search', validateJWT, [
    query('q').trim().isLength({ min: 1, max: 100 }).escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errors: errors.array() });
    const { q } = req.query;
    try {
        const response = await axios.get('https://api.intercom.io/articles', {
            headers: {
                'Authorization': `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
                'Accept': 'application/json'
            },
            params: { query: q }
        });
        const articles = (response.data.data || []).map((a) => ({
            id: a.id,
            title: a.title,
            content: a.body?.substring(0, 100) || 'Sem descrição',
            url: a.url
        }));
        res.json({ query: q, total: articles.length, articles });
    }
    catch (error) {
        console.error('Erro Intercom:', error.message);
        res.status(500).json({ error: 'Erro ao buscar Help Center' });
    }
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});
app.use(express.static(path.join(__dirname, '../frontend')));
app.listen(PORT, () => {
    console.log(`MCP Help Center rodando em http://localhost:${PORT}`);
    console.log(`Endpoints: GET /api/search, POST /api/login`);
});
export default app;
//# sourceMappingURL=server.js.map