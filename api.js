// Thin fetch wrapper: attaches JWT, handles JSON, surfaces errors consistently.
const Api = (() => {
  function getToken() {
    return localStorage.getItem('qr_att_token');
  }
  function setToken(token) {
    localStorage.setItem('qr_att_token', token);
  }
  function clearToken() {
    localStorage.removeItem('qr_att_token');
    localStorage.removeItem('qr_att_user');
  }
  function getUser() {
    const raw = localStorage.getItem('qr_att_user');
    return raw ? JSON.parse(raw) : null;
  }
  function setUser(user) {
    localStorage.setItem('qr_att_user', JSON.stringify(user));
  }

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${window.API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }

    if (!res.ok) {
      const message = (data && data.message) || `Request failed (${res.status})`;
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => request(path, { method: 'GET' }),
    post: (path, body) => request(path, { method: 'POST', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    getToken, setToken, clearToken, getUser, setUser
  };
})();
