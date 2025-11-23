const grid = document.getElementById("wish-grid");
let reservations = {};
let wishesByPerson = {};

// remember whose list is currently shown
let currentOwner = null;

const reserveSound = new Audio("media/reserved.mp3");
reserveSound.preload = "auto";

async function initializeWishlist(wishes = []) {
  reservations = await loadReservations();
  wishesByPerson = wishes.reduce((acc, wish) => {
    if (!wish.owner) return acc;
    (acc[wish.owner] ||= []).push(wish);
    return acc;
  }, {});
}

async function loadWishData() {
  try {
    const resp = await fetch("/api/wishes");
    if (!resp.ok) {
      console.error("Failed to load wishes.json", resp.status);
      return [];
    }
    const wishes = await resp.json();
    return Array.isArray(wishes) ? wishes : [];
  } catch (error) {
    console.error("Failed to load wish data", error);
  }
  return [];
}

await (async () => {
  const wishes = await loadWishData();
  if (wishes.length) {
    await initializeWishlist(wishes);
  }
})();

async function loadReservations() {
  try {
    const resp = await fetch('/api/reservation');
    if (resp.ok) {
      return await resp.json();
    }
  } catch (error) {
    console.warn("Could not read reservation state", error);
  }
  return {};
}

async function persistReservations() {
  try {
    await fetch('/api/reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservations),
    });
  } catch (error) {
    console.error("Failed to save reservations", error);
  }
}

function createWishCard(wish) {
  const reserved = Boolean(reservations[wish.id]);
  const imageMarkup = wish.image
    ? `<img src="${wish.image}" alt="${wish.title}">`
    : "";
  const card = document.createElement("article");
  card.className = `wish-card${reserved ? " reserved" : ""}`;
  card.dataset.wishId = wish.id;
  card.innerHTML = `
    ${imageMarkup}
    <div class="wish-body">
      <p class="wish-title">${wish.title}</p>
      ${wish.price ? `<span class="wish-price">${wish.price}</span>` : ""}
      <div class="wish-actions">
        <a class="btn btn-primary" href="${wish.url}" target="_blank" rel="noopener noreferrer">Webshop</a>
        <button class="btn btn-outline" type="button" aria-pressed="${reserved}" data-role="reserve">
          ${reserved ? "Unreserve" : "Reserve"}
        </button>
        <span class="reserve-status" aria-live="polite">${reserved ? "Reserved ✔" : ""}</span>
      </div>
    </div>
  `;

  const reserveBtn = card.querySelector('[data-role="reserve"]');
  reserveBtn.addEventListener("click", () => toggleReservation(wish, card));
  return card;
}

async function toggleReservation(wish, card) {
  const isReserved = !reservations[wish.id];
  if (isReserved) {
    reservations[wish.id] = true;
  } else {
    delete reservations[wish.id];
  }

  const reserveBtn = card.querySelector('[data-role="reserve"]');
  const status = card.querySelector(".reserve-status");
  card.classList.toggle("reserved", isReserved);
  reserveBtn.textContent = isReserved ? "Unreserve" : "Reserve";
  reserveBtn.setAttribute("aria-pressed", String(isReserved));
  status.textContent = isReserved ? "Reserved ✔" : "";

  // play sound only when reserving
  if (isReserved) {
    try {
      // restart from beginning if clicked quickly
      reserveSound.currentTime = 0;
      reserveSound.play();
    } catch (e) {
      console.warn("Could not play reserve sound", e);
    }
  }

  await persistReservations();
}

const gallery = document.querySelector(".portrait-gallery");

if (gallery && grid) {
  gallery.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-member]");
    if (!btn) return;

    const owner = btn.dataset.member;

    // toggle: if same owner clicked again, hide the grid
    if (currentOwner === owner) {
      grid.hidden = true;
      grid.replaceChildren();
      currentOwner = null;
      return;
    }

    currentOwner = owner;

    const wishes = wishesByPerson[owner] ?? [];
    grid.replaceChildren();
    wishes.forEach((wish) => {
      grid.appendChild(createWishCard(wish));
    });
    grid.hidden = wishes.length === 0;
  });
}