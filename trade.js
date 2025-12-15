(function () {
  const FALLBACK_CARD_IMAGE = "https://via.placeholder.com/300x420?text=Card";
  const TRADE_KEY = "kb_trade_requests";
  const RESULTS_LIMIT = 8;

  let auth = null;
  let currentUser = null;
  let cardPool = [];
  let selectedOfferCard = null;
  let selectedWantedCard = null;
  let feedbackNode = null;

  document.addEventListener("DOMContentLoaded", async () => {
    auth = window.karinaAuth;
    if (!auth) return;
    currentUser = auth.requireAuth("trade.html");
    if (!currentUser) return;
    auth.syncAuthUI();

    feedbackNode = document.getElementById("tradeRequestFeedback");

    await loadCardPool();
    wireCardSearches();
    wireTradeForm();
    wireRequestActions();
    renderRequests();
  });

  async function loadCardPool() {
    try {
      const res = await fetch("cards.json");
      const data = await res.json();
      cardPool = Array.isArray(data) ? data : data.cards || [];
    } catch (err) {
      console.error("Failed to load cards.json", err);
      cardPool = [];
    }
  }

  function wireCardSearches() {
    createCardSearch({
      inputId: "offerSearch",
      resultsId: "offerResults",
      onSelect(card) {
        selectedOfferCard = card;
      },
    });

    createCardSearch({
      inputId: "wantSearch",
      resultsId: "wantResults",
      onSelect(card) {
        selectedWantedCard = card;
      },
    });
  }

  function createCardSearch({inputId, resultsId, onSelect}) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    const render = query => {
      const matches = query
        ? filterCards(query)
        : cardPool.slice(0, RESULTS_LIMIT).map((card, index) => ({card, index}));
      if (!matches.length) {
        results.innerHTML = `<p class="card-search-placeholder">No matching cards.</p>`;
        return;
      }
      results.innerHTML = matches
        .map(
          match => `
            <button type="button" class="card-result" data-card-index="${match.index}">
              <img src="${getCardImage(match.card)}" alt="${match.card.name}">
              <div>
                <strong>${match.card.name}</strong>
                <span>${match.card.rarity || "?"}</span>
              </div>
            </button>
          `
        )
        .join("");
    };

    input.addEventListener("input", () => {
      onSelect(null);
      render(input.value.trim().toLowerCase());
    });

    input.addEventListener("focus", () => {
      const query = input.value.trim().toLowerCase();
      render(query);
    });

    results.addEventListener("click", evt => {
      const target = evt.target.closest(".card-result");
      if (!target) return;
      const index = Number(target.dataset.cardIndex);
      if (Number.isNaN(index) || !cardPool[index]) return;
      const card = cardPool[index];
      input.value = card.name;
      onSelect(card);
      results.innerHTML = `
        <p class="card-search-selection">
          Selected <strong>${card.name}</strong> (${card.rarity || "?"})
        </p>
      `;
    });
  }

  function filterCards(query) {
    const normalized = (query || "").toLowerCase();
    return cardPool
      .map((card, index) => ({card, index}))
      .filter(entry => entry.card.name && entry.card.name.toLowerCase().includes(normalized))
      .slice(0, RESULTS_LIMIT);
  }

  function wireTradeForm() {
    const form = document.getElementById("tradeRequestForm");
    const partnerInput = document.getElementById("partnerInput");
    if (!form || !partnerInput) return;

    form.addEventListener("submit", evt => {
      evt.preventDefault();
      const partner = normalize(partnerInput.value);
      clearFeedback();

      if (!partner) {
        return setFeedback("Enter the username of the collector you want to trade with.");
      }
      if (partner === currentUser.username) {
        return setFeedback("You cannot send a trade request to yourself.");
      }
      if (!partnerExists(partner)) {
        return setFeedback("That collector does not exist yet.");
      }
      if (!selectedOfferCard) {
        return setFeedback("Pick the card you want to offer.");
      }
      if (!selectedWantedCard) {
        return setFeedback("Pick the card you want to receive.");
      }

      const yourCards = auth.loadUserCards(currentUser.username);
      const offerIndex = findCardIndex(yourCards, selectedOfferCard);
      if (offerIndex === -1) {
        return setFeedback("You do not own the card you are trying to offer.");
      }

      const newRequest = {
        id: `trade_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        from: currentUser.username,
        to: partner,
        offerCard: yourCards[offerIndex],
        requestCard: selectedWantedCard,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const requests = loadTradeRequests();
      requests.unshift(newRequest);
      saveTradeRequests(requests);
      form.reset();
      selectedOfferCard = null;
      selectedWantedCard = null;
      resetSearchHints();
      setFeedback("Trade request sent!", "success");
      renderRequests();
    });
  }

  function wireRequestActions() {
    const incoming = document.getElementById("incomingRequests");
    if (incoming) {
      incoming.addEventListener("click", evt => {
        const actionBtn = evt.target.closest("[data-action]");
        if (!actionBtn) return;
        const requestId = actionBtn.dataset.requestId;
        if (!requestId) return;
        if (actionBtn.dataset.action === "accept") {
          handleAcceptRequest(requestId);
        } else if (actionBtn.dataset.action === "decline") {
          handleDeclineRequest(requestId);
        }
      });
    }
  }

  function handleAcceptRequest(requestId) {
    const requests = loadTradeRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request || request.status !== "pending" || request.to !== currentUser.username) {
      return;
    }

    const senderCards = auth.loadUserCards(request.from);
    const receiverCards = auth.loadUserCards(request.to);
    const senderIndex = findCardIndex(senderCards, request.offerCard);
    const receiverIndex = findCardIndex(receiverCards, request.requestCard);

    if (senderIndex === -1 || receiverIndex === -1) {
      request.status = "failed";
      request.updatedAt = Date.now();
      saveTradeRequests(requests);
      renderRequests();
      return setFeedback(
        "One of the cards involved is missing. The trade was marked as failed."
      );
    }

    const senderCard = senderCards.splice(senderIndex, 1)[0];
    const receiverCard = receiverCards.splice(receiverIndex, 1)[0];
    senderCards.push(receiverCard);
    receiverCards.push(senderCard);
    auth.saveUserCards(request.from, senderCards);
    auth.saveUserCards(request.to, receiverCards);

    request.status = "completed";
    request.updatedAt = Date.now();
    saveTradeRequests(requests);
    renderRequests();
    setFeedback(
      `Trade completed! You received ${senderCard.name} and sent ${receiverCard.name}.`,
      "success"
    );
  }

  function handleDeclineRequest(requestId) {
    const requests = loadTradeRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request || request.status !== "pending" || request.to !== currentUser.username) {
      return;
    }
    request.status = "declined";
    request.updatedAt = Date.now();
    saveTradeRequests(requests);
    renderRequests();
    setFeedback("Trade request declined.");
  }

  function renderRequests() {
    const requests = loadTradeRequests();
    const incoming = requests.filter(r => r.to === currentUser.username);
    const outgoing = requests.filter(r => r.from === currentUser.username);
    renderRequestList(
      document.getElementById("incomingRequests"),
      incoming,
      "incoming"
    );
    renderRequestList(
      document.getElementById("outgoingRequests"),
      outgoing,
      "outgoing"
    );
  }

  function renderRequestList(node, list, type) {
    if (!node) return;
    if (!list.length) {
      node.innerHTML = `<p class="auth-locked-message">No ${type} requests.</p>`;
      return;
    }
    const sorted = list.slice().sort((a, b) => b.createdAt - a.createdAt);
    node.innerHTML = sorted
      .map(
        request => `
          <article class="trade-request-card">
            <header>
              <div>
                <strong>${type === "incoming" ? request.from : request.to}</strong>
                <p class="trade-request-meta">Created ${formatDate(request.createdAt)}</p>
              </div>
              ${renderStatusBadge(request.status)}
            </header>
            <div class="trade-request-body">
              <div>
                <span class="trade-label">They offer</span>
                ${renderCardRow(request.offerCard)}
              </div>
              <div>
                <span class="trade-label">They want</span>
                ${renderCardRow(request.requestCard)}
              </div>
            </div>
            ${
              type === "incoming" && request.status === "pending"
                ? `
                  <div class="trade-request-actions">
                    <button type="button" class="btn primary slim" data-action="accept" data-request-id="${request.id}">Accept</button>
                    <button type="button" class="btn secondary slim" data-action="decline" data-request-id="${request.id}">Decline</button>
                  </div>
                `
                : ""
            }
          </article>
        `
      )
      .join("");
  }

  function renderCardRow(card) {
    return `
      <div class="trade-card-row">
        <img src="${getCardImage(card)}" alt="${card?.name || "card"}">
        <div>
          <strong>${card?.name || "Card"}</strong>
          <span>${card?.rarity || "?"}</span>
        </div>
      </div>
    `;
  }

  function renderStatusBadge(status) {
    const readable = statusLabel(status);
    return `<span class="status-badge status-${status}">${readable}</span>`;
  }

  function loadTradeRequests() {
    try {
      return JSON.parse(localStorage.getItem(TRADE_KEY)) || [];
    } catch (err) {
      console.error("Failed to load trade requests", err);
      return [];
    }
  }

  function saveTradeRequests(requests) {
    localStorage.setItem(TRADE_KEY, JSON.stringify(requests));
  }

  function getCardImage(card) {
    if (!card) return FALLBACK_CARD_IMAGE;
    return card.image && card.image !== "undefined" ? card.image : FALLBACK_CARD_IMAGE;
  }

  function findCardIndex(cards, target) {
    if (!target) return -1;
    return cards.findIndex(
      card =>
        card.name === target.name &&
        (card.rarity || "") === (target.rarity || "") &&
        (card.image || "") === (target.image || "")
    );
  }

  function partnerExists(username) {
    if (!auth || typeof auth.listUsers !== "function") return false;
    return auth.listUsers().some(user => user.username === username);
  }

  function normalize(value) {
    return (value || "").toString().trim().toLowerCase();
  }

  function clearFeedback() {
    if (!feedbackNode) return;
    feedbackNode.textContent = "";
    delete feedbackNode.dataset.variant;
  }

  function setFeedback(message, variant) {
    if (!feedbackNode) return;
    feedbackNode.textContent = message;
    feedbackNode.dataset.variant = variant || "error";
  }

  function resetSearchHints() {
    document.querySelectorAll(".card-search-results").forEach(node => {
      node.innerHTML = `<p class="card-search-placeholder">Type to show cards from cards.json.</p>`;
    });
  }

  function formatDate(timestamp) {
    if (!timestamp) return "recently";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return "recently";
    }
  }

  function statusLabel(status) {
    switch (status) {
      case "completed":
        return "Completed";
      case "declined":
        return "Declined";
      case "failed":
        return "Failed";
      default:
        return "Pending";
    }
  }
})();
