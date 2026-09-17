let accessToken = localStorage.getItem('accessToken');
const API_URL = window.location.origin;

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
const submitBtn = document.getElementById('submitBtn');

if (accessToken) {
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
    
    showSearchInterface();
  } catch (error) {
    loginError.textContent = 'Erro ao autenticar';
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

submitBtn.addEventListener('click', sendMessage);

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

    if (!response.ok) {
      addMessageToChat('error', 'Erro ao processar mensagem');
      return;
    }

    const data = await response.json();
    addMessageToChat('assistant', data.message, data.tool_used, true);
  } catch (error) {
    addMessageToChat('error', 'Erro ao processar mensagem');
  }
}

function addMessageToChat(role, content, tool, isHtml = false) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  
  if (isHtml && role === 'assistant') {
    contentDiv.innerHTML = content;
  } else {
    contentDiv.textContent = content;
  }
  
  msgEl.appendChild(contentDiv);
  
  if (tool) {
    const toolDiv = document.createElement('div');
    toolDiv.className = 'message-tool';
    toolDiv.textContent = `Tool: ${tool}`;
    msgEl.appendChild(toolDiv);
  }
  
  messagesList.appendChild(msgEl);
  messagesList.scrollTop = messagesList.scrollHeight;
}

function showLoginModal() {
  loginModal.style.display = 'flex';
  searchInterface.style.display = 'none';
  userInfo.style.display = 'none';
  loginBtn.style.display = 'none';
  logoutBtn.style.display = 'none';
}

function showSearchInterface() {
  loginModal.style.display = 'none';
  searchInterface.style.display = 'flex';
  userInfo.style.display = 'inline-block';
  loginBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'inline-block';
  messageInput.focus();
}
