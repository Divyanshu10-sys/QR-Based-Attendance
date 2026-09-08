// Simple client-side route guard. NOTE: this only improves UX (avoids flashing the
// wrong page) — the backend independently enforces role checks on every request,
// which is the real security boundary.
function requireRole(expectedRole) {
  const token = Api.getToken();
  const user = Api.getUser();
  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }
  if (user.role !== expectedRole) {
    window.location.href = `/${user.role}/dashboard.html`;
    return null;
  }
  return user;
}

function logout() {
  Api.clearToken();
  window.location.href = '/index.html';
}
