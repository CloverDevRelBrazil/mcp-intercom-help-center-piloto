let accessToken = localStorage.getItem('accessToken');
const API_URL = window.location.origin;
const MCP_TOOLS = {};

const loginModal = document.getElementById('loginModal');
const searchInterface = document.getElementById('searchInterface');
const userInfo = document.getElementById('userInfo');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const submitLoginBtn = document.getElementById('submitLoginBtn');
const tokenInput = document.getElementById('tokenInput');
const loginError = document.getElementById('loginError');
const messageInput = document.getElementById('messageInput');
const messagesList = document.getElementById('messagesList');

if (accessToken) {
  loadMCPTools();
  showSearchInterface();
} else {
  showLoginModal();
}

loginBtn.addEventListener('click', () => {
  showLoginModal();
  tokenInput.focus();
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('accessToken');
  accessToken = null;
  tokenInput.value = '';
  loginError.textContent = '';
  showLoginModal();
});

submitLoginBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    loginError.textContent = 'Insira um token';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      loginError.textContent = 'Token inválido';
      return;
    }

    const data = await response.json();
    accessToken = data.jwt;
    localStorage.setItem('accessToken', accessToken);
    loginError.textContent = '';
    userInfo.textContent = token;
    
    await loadMCPTools();
    showSearchInterface();
  } catch (error) {
    loginError.textContent = 'Erro ao autenticar';
  }
});

async function loadMCPTools() {
  try {
    const response = await fetch(`${API_URL}/mcp/tools`);
    const data = await response.json();
    
    data.tools.forEach((tool: any) => {
      MCP_TOOLS[tool.name] = tool;
    });
  } catch (error) {
    console.error('Erro ao carregar tools MCP:', error);
  }
}

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

document.getElementById('submitBtn').addEventListener('click', sendMessage);

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  addMessageToChat('user', message);
  messageInput.value = '';

  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) throw new Error('Erro ao buscar');

    const data = await response.json();
    addMessageToChat('assistant', data.message, data.tool_used);
  } catch (error) {
    addMessageToChat('error', 'Erro ao processar mensagem');
  }
}

function addMessageToChat(role: string, content: string, tool?: string) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;
  
  let html = `<div class="message-content">${escapeHtml(content)}</div>`;
  if (tool) {
    html += `<div class="message-tool">Tool: ${tool}</div>`;
  }
  
  msgEl.innerHTML = html;
  messagesList.appendChild(msgEl);
  messagesList.scrollTop = messagesList.scrollHeight;
}

function escapeHtml(text: string) {
  const map: {[key: string]: string} = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function showLoginModal() {
  loginModal.style.display = 'flex';
  searchInterface.style.display = 'none';
  userInfo.style.display = 'none';
  loginBtn.style.display = 'inline-block';
}

function showSearchInterface() {
  loginModal.style.display = 'none';
  searchInterface.style.display = 'block';
  userInfo.style.display = 'inline-block';
  loginBtn.style.display = 'none';
  messageInput.focus();
}
