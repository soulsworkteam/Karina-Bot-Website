// DOM Elements
const rollBtn = document.getElementById("rollBtn");
const inventoryBtn = document.getElementById("inventoryBtn");
const cardDisplay = document.getElementById("cardDisplay");
const cardCountSpan = document.getElementById("cardCount");
const inventorySection = document.getElementById("inventory");
const inventoryList = document.getElementById("inventoryList");
const prevPageBtn = document.getElementById("prevPage");
const nextPageBtn = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const showInventoryTriggers = document.querySelectorAll(".show-inventory");
const cardPoolGrid = document.getElementById("cardPoolGrid");
const cardPoolCount = document.getElementById("cardPoolCount");
const authApi = window.karinaAuth || {};
const currentUser = authApi.getCurrentUser ? authApi.getCurrentUser() : null;
if (currentUser && authApi.ensureCardVault) {
  authApi.ensureCardVault(currentUser.username);
}

// Config
const CARDS_PER_PAGE = 10;
const FALLBACK_CARD_IMAGE = "https://via.placeholder.com/300x420?text=Card";

// Inventory data
const isAuthenticated = Boolean(currentUser);
let cards =
  isAuthenticated && authApi.loadUserCards
    ? authApi.loadUserCards(currentUser.username)
    : [];
let currentPage = 1;
let cardPool = [];

// Load cards.json
async function loadCardPool() {
  try {
    const res = await fetch("cards.json");
    const data = await res.json();
    cardPool = Array.isArray(data) ? data : data.cards || [];
    if (cardPool.length === 0) cardPool = [{name: "Default Card", rarity: "C", image: ""}];
  } catch (err) {
    console.error("Failed to load cards.json:", err);
    cardPool = [{name: "Default Card", rarity: "C", image: ""}];
  }
}

// Update card count display
function updateCardCount() {
  if (!cardCountSpan) return;
  cardCountSpan.textContent = isAuthenticated ? cards.length : 0;
}

// Render inventory
function renderInventory() {
  if (!inventoryList) return;
  if (!isAuthenticated) {
    inventoryList.innerHTML =
      '<p class="auth-locked-message">Log in to track your inventory.</p>';
    if (pageInfo) pageInfo.textContent = "Locked";
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    return;
  }

  const start = (currentPage - 1) * CARDS_PER_PAGE;
  const end = start + CARDS_PER_PAGE;
  const pageCards = cards.slice(start, end);

  inventoryList.innerHTML = pageCards.length
    ? pageCards
        .map(
          c =>
            `<div style="display:flex; align-items:center; gap:10px; margin:5px 0;">
              <img src="${getCardImage(c)}" alt="${c.name}" style="width:40px; height:auto; border-radius:5px;">
              <span class="rarity-${c.rarity}">${c.name} (${c.rarity})</span>
            </div>`
        )
        .join("")
    : "No cards yet.";

  const totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;

  if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
}

function renderCardPool() {
  if (!cardPoolGrid) return;
  if (!cardPool.length) {
    cardPoolGrid.textContent = "No cards found in cards.json.";
    if (cardPoolCount) cardPoolCount.textContent = "";
    return;
  }

  cardPoolGrid.innerHTML = cardPool
    .map(
      card => `
        <article class="card-pool-card">
          <img src="${getCardImage(card)}" alt="${card.name}">
          <strong>${card.name}</strong>
          <span>${card.rarity}</span>
        </article>
      `
    )
    .join("");

  if (cardPoolCount) {
    cardPoolCount.textContent = `${cardPool.length} cards`;
  }
}

// Roll a new card
function rollCard() {
  if (!isAuthenticated) {
    alert("Log in to roll cards and save them to your vault.");
    return;
  }
  if (cardPool.length === 0) return;

  const newCard = cardPool[Math.floor(Math.random() * cardPool.length)];
  cards.push(newCard);
  persistCards();

  if (cardDisplay) {
    cardDisplay.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center;">
        <img src="${getCardImage(newCard)}" alt="${newCard.name}" style="width:150px; height:auto; border-radius:10px; margin-bottom:10px;">
        <strong class="rarity-${newCard.rarity}">${newCard.name}</strong> (${newCard.rarity})
      </div>
    `;
  }

  updateCardCount();
  renderInventory();
}

function persistCards() {
  if (isAuthenticated && authApi.saveUserCards) {
    authApi.saveUserCards(currentUser.username, cards);
  }
}

function setInventoryVisibility(visible) {
  if (!inventorySection) return;
  if (!isAuthenticated) {
    inventorySection.style.display = "none";
    return;
  }
  inventorySection.style.display = visible ? "block" : "none";
  if (visible) {
    renderInventory();
  }
}

function getCardImage(card) {
  if (!card) return FALLBACK_CARD_IMAGE;
  return card.image && card.image !== "undefined" ? card.image : FALLBACK_CARD_IMAGE;
}

function applyAuthLocks() {
  if (!cardDisplay) return;
  if (!isAuthenticated) {
    cardDisplay.innerHTML =
      '<p class="auth-locked-message">Log in to roll cards and view your inventory.</p>';
    if (rollBtn) {
      rollBtn.disabled = true;
      rollBtn.title = "Log in first";
    }
    if (inventoryBtn) {
      inventoryBtn.disabled = true;
      inventoryBtn.title = "Log in first";
    }
  } else {
    if (rollBtn) {
      rollBtn.disabled = false;
      rollBtn.removeAttribute("title");
    }
    if (inventoryBtn) {
      inventoryBtn.disabled = false;
      inventoryBtn.removeAttribute("title");
    }
  }
}

// Toggle inventory visibility
if (inventoryBtn && inventorySection) {
  inventoryBtn.addEventListener("click", () => {
    if (!isAuthenticated) {
      alert("Log in to view your inventory.");
      return;
    }
    const shouldShow = inventorySection.style.display === "none";
    setInventoryVisibility(shouldShow);
  });
}

showInventoryTriggers.forEach(trigger => {
  trigger.addEventListener("click", evt => {
    evt.preventDefault();
    if (!isAuthenticated) {
      window.location.href = "login.html?redirect=roll.html";
      return;
    }
    setInventoryVisibility(true);
    if (inventorySection) {
      inventorySection.scrollIntoView({behavior: "smooth"});
    }
  });
});

// Pagination buttons
if (prevPageBtn) {
  prevPageBtn.addEventListener("click", () => {
    if (!isAuthenticated) return;
    if (currentPage > 1) {
      currentPage--;
      renderInventory();
    }
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener("click", () => {
    if (!isAuthenticated) return;
    const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      renderInventory();
    }
  });
}

// Event listeners
if (rollBtn) {
  rollBtn.addEventListener("click", rollCard);
}

// Init
(async function init() {
  await loadCardPool();
  updateCardCount();
  setInventoryVisibility(false);
  renderCardPool();
  renderInventory();
  applyAuthLocks();
})();
