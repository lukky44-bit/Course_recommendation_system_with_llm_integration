// Handles authentication, recommendations, and history for the HTML frontend
const API_BASE = 'http://localhost:5000/api';

const registerForm = document.getElementById('register-form');
const loginForm = document.getElementById('login-form');
const authSection = document.getElementById('auth-section');
const mainSection = document.getElementById('main-section');
const authError = document.getElementById('auth-error');
const recommendError = document.getElementById('recommend-error');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const welcomeUser = document.getElementById('welcome-user');
const logoutBtn = document.getElementById('logout-btn');
const queryForm = document.getElementById('query-form');
const queryInput = document.getElementById('query-input');
const recommendationsDiv = document.getElementById('recommendations');
const historyList = document.getElementById('history-list');

let currentUser = null;

function show(section) {
  authSection.style.display = section === 'auth' ? '' : 'none';
  mainSection.style.display = section === 'main' ? '' : 'none';
}

showRegister.onclick = e => {
  e.preventDefault();
  loginForm.style.display = 'none';
  registerForm.style.display = '';
  authError.textContent = '';
};
showLogin.onclick = e => {
  e.preventDefault();
  registerForm.style.display = 'none';
  loginForm.style.display = '';
  authError.textContent = '';
};

registerForm.onsubmit = async e => {
  e.preventDefault();
  authError.textContent = '';
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    authError.textContent = 'Registration successful! Please log in.';
    registerForm.style.display = 'none';
    loginForm.style.display = '';
  } catch (err) {
    authError.textContent = err.message;
  }
};

loginForm.onsubmit = async e => {
  e.preventDefault();
  authError.textContent = '';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    currentUser = data.user;
    welcomeUser.textContent = `Welcome, ${currentUser.name}!`;
    show('main');
    fetchHistory();
    recommendationsDiv.innerHTML = '';
    recommendError.textContent = '';
    queryInput.value = '';
  } catch (err) {
    authError.textContent = err.message;
  }
};

logoutBtn.onclick = () => {
  currentUser = null;
  show('auth');
  loginForm.style.display = '';
  registerForm.style.display = 'none';
  authError.textContent = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
};

queryForm.onsubmit = async e => {
  e.preventDefault();
  recommendError.textContent = '';
  recommendationsDiv.innerHTML = '';
  const query = queryInput.value.trim();
  if (!query) return;
  try {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_query: query, num_recommendations: 5 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch recommendations');
    renderRecommendations(data.recommendations || []);
    if (currentUser) {
      await fetch(`${API_BASE}/save-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, query, recommendations: data.recommendations })
      });
      fetchHistory();
    }
  } catch (err) {
    recommendError.textContent = err.message;
  }
};

function renderRecommendations(recs) {
  if (!recs.length) {
    recommendationsDiv.innerHTML = '<div>No recommendations found.</div>';
    return;
  }
  recommendationsDiv.innerHTML = recs.map(rec => `
    <div class="recommend-card">
      <a href="${rec.url}" target="_blank" rel="noopener noreferrer" class="title">${rec.course_title}</a>
      <div class="course-details">Subject: <b>${rec.subject}</b> &nbsp;|&nbsp; Level: <b>${rec.level}</b> &nbsp;|&nbsp; Price: <b>${rec.is_paid ? `$${rec.price}` : 'Free'}</b></div>
      <div class="course-details">Duration: <b>${rec.content_duration}</b></div>
      <div class="meta">Similarity: ${rec.similarity_score?.toFixed(3)}</div>
    </div>
  `).join('');
}

async function fetchHistory() {
  if (!currentUser) return;
  try {
    const res = await fetch(`${API_BASE}/history?email=${encodeURIComponent(currentUser.email)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
    renderHistory(data.queries || []);
  } catch {
    renderHistory([]);
  }
}

function renderHistory(history) {
  if (!history.length) {
    historyList.innerHTML = '<li>No history yet.</li>';
    return;
  }
  historyList.innerHTML = history.map(h => `
    <li>
      <div style="font-weight:500;margin-bottom:6px">Query: ${h.query}</div>
      ${(h.recommendations||[]).map(rec => `
        <div class="recommend-card">
          <a href="${rec.url}" target="_blank" rel="noopener noreferrer" class="title">${rec.course_title}</a>
          <div class="course-details">Subject: <b>${rec.subject}</b> &nbsp;|&nbsp; Level: <b>${rec.level}</b> &nbsp;|&nbsp; Price: <b>${rec.is_paid ? `$${rec.price}` : 'Free'}</b></div>
          <div class="course-details">Duration: <b>${rec.content_duration}</b></div>
          <div class="meta">Similarity: ${rec.similarity_score?.toFixed(3)}</div>
        </div>
      `).join('')}
      <div style="color:#aaa;font-size:12px">Asked on: ${new Date(h.createdAt).toLocaleString()}</div>
    </li>
  `).join('');
}

// On load, show login
show('auth');
loginForm.style.display = '';
registerForm.style.display = 'none';
