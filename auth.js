(function () {
  const AUTH_KEY = "kb_current_user";
  const USERS_KEY = "kb_users";

  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    } catch (err) {
      console.error("Failed to parse users", err);
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function listUsers() {
    const users = getUsers();
    return Object.values(users);
  }

  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch (err) {
      console.error("Failed to parse current user", err);
      return null;
    }
  }

function setCurrentUser(user) {
  if (!user) return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  ensureCardVault(user.username);
  syncAuthUI();
}

  function clearCurrentUser() {
    localStorage.removeItem(AUTH_KEY);
    syncAuthUI();
  }

function cardsKey(username) {
  return `kb_cards_${username}`;
}

function ensureCardVault(username) {
  if (!username) return;
  const key = cardsKey(username);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, "[]");
  }
}

function loadUserCards(username) {
  if (!username) return [];
  try {
    return JSON.parse(localStorage.getItem(cardsKey(username))) || [];
  } catch (err) {
    console.error("Failed to load cards for", username, err);
    return [];
  }
}

function saveUserCards(username, cards) {
  if (!username) return;
  localStorage.setItem(cardsKey(username), JSON.stringify(cards));
}

  function requireAuth(redirectTarget) {
    const user = getCurrentUser();
    if (!user) {
      const destination =
        redirectTarget ||
        window.location.pathname.replace(/^\//, "") ||
        "private.html";
      window.location.href = `login.html?redirect=${encodeURIComponent(
        destination
      )}`;
    }
    return user;
  }

  function syncAuthUI() {
    if (typeof document === "undefined") return;
    const body = document.body;
    if (!body) return;

    const user = getCurrentUser();
    body.classList.toggle("authenticated", Boolean(user));

    const sessionIndicator = document.getElementById("sessionIndicator");
    if (sessionIndicator) {
      sessionIndicator.textContent = user
        ? `Logged in as ${user.username}`
        : "Not logged in";
    }

    const loginLink = document.querySelector('[data-auth-link="login"]');
    const signupLink = document.querySelector('[data-auth-link="signup"]');
    const logoutBtn = document.getElementById("logoutBtn");

    if (loginLink) loginLink.style.display = user ? "none" : "";
    if (signupLink) signupLink.style.display = user ? "none" : "";
    if (logoutBtn) logoutBtn.style.display = user ? "inline-flex" : "none";

    document.querySelectorAll(".requires-auth").forEach(el => {
      el.style.display = user ? "" : "none";
    });
  }

  function attachLogout() {
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        clearCurrentUser();
        window.location.href = "login.html";
      });
    }
  }

  function handleAuthForms() {
    const form = document.querySelector(".auth-form");
    if (!form) return;
    const type = form.dataset.authType;
    if (type === "login") {
      wireLoginForm(form);
    } else if (type === "signup") {
      wireSignupForm(form);
    }
  }

  function wireLoginForm(form) {
    const feedback = form.querySelector(".auth-feedback");
    form.addEventListener("submit", evt => {
      evt.preventDefault();
      const data = new FormData(form);
      const username = normalize(data.get("username"));
      const password = data.get("password") || "";
      const users = getUsers();
      const user = users[username];
      if (!user || user.password !== password) {
        setFeedback(feedback, "Invalid username or password.", "error");
        return;
      }
      setCurrentUser(user);
      ensureCardVault(user.username);
      setFeedback(
        feedback,
        "Logged in! Setting up your private card vault…",
        "success"
      );
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get("redirect") || "roll.html";
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 900);
    });
  }

  function wireSignupForm(form) {
    const feedback = form.querySelector(".auth-feedback");
    form.addEventListener("submit", evt => {
      evt.preventDefault();
      const data = new FormData(form);
      const username = normalize(data.get("username"));
      const dob = data.get("dob") || "";
      const password = data.get("password") || "";
      if (!username || !password || !dob) {
        setFeedback(feedback, "All fields are required.", "error");
        return;
      }
      const users = getUsers();
      if (users[username]) {
        setFeedback(feedback, "That username is already taken.", "error");
        return;
      }
      const newUser = { username, password, dob };
      users[username] = newUser;
      saveUsers(users);
      setCurrentUser(newUser);
      setFeedback(
        feedback,
        "Account created! Redirecting to your private space…",
        "success"
      );
      ensureCardVault(username);
      setTimeout(() => {
        window.location.href = "private.html";
      }, 900);
    });
  }

  function setFeedback(node, message, variant) {
    if (!node) return;
    node.textContent = message;
    node.dataset.variant = variant;
  }

  document.addEventListener("DOMContentLoaded", () => {
    syncAuthUI();
    attachLogout();
    handleAuthForms();
  });

  function normalize(val) {
    return (val || "").toString().trim().toLowerCase();
  }

  window.karinaAuth = {
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    loadUserCards,
    saveUserCards,
    ensureCardVault,
    requireAuth,
    syncAuthUI,
    listUsers,
  };
})();
