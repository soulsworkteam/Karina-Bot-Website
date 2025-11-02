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

// Config
const CARDS_PER_PAGE = 10;

// Inventory data
let cards = JSON.parse(localStorage.getItem("cards")) || [];
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
  cardCountSpan.textContent = cards.length;
}

// Render inventory
function renderInventory() {
  const start = (currentPage - 1) * CARDS_PER_PAGE;
  const end = start + CARDS_PER_PAGE;
  const pageCards = cards.slice(start, end);

  inventoryList.innerHTML = pageCards.length
    ? pageCards
        .map(
          c =>
            `<div style="display:flex; align-items:center; gap:10px; margin:5px 0;">
              <img src="${c.image}" alt="${c.name}" style="width:40px; height:auto; border-radius:5px;">
              <span class="rarity-${c.rarity}">${c.name} (${c.rarity})</span>
            </div>`
        )
        .join("")
    : "No cards yet.";

  const totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PER_PAGE));
  pageInfo.textContent = `Page ${currentPage} / ${totalPages}`;

  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// Roll a new card
function rollCard() {
  if (cardPool.length === 0) return;

  const newCard = cardPool[Math.floor(Math.random() * cardPool.length)];
  cards.push(newCard);
  localStorage.setItem("cards", JSON.stringify(cards));

  cardDisplay.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center;">
      <img src="${newCard.image}" alt="${newCard.name}" style="width:150px; height:auto; border-radius:10px; margin-bottom:10px;">
      <strong class="rarity-${newCard.rarity}">${newCard.name}</strong> (${newCard.rarity})
    </div>
  `;

  updateCardCount();
  renderInventory();
}

// Toggle inventory visibility
inventoryBtn.addEventListener("click", () => {
  inventorySection.style.display =
    inventorySection.style.display === "none" ? "block" : "none";
  renderInventory();
});

// Pagination buttons
prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderInventory();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(cards.length / CARDS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderInventory();
  }
});

// Event listeners
rollBtn.addEventListener("click", rollCard);

// Init
(async function init() {
  await loadCardPool();
  updateCardCount();
  renderInventory();
})();
