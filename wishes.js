const grid = document.getElementById("wish-grid");
let reservations = {};
let wishesByPerson = {};

// remember whose list is currently shown
let currentOwner = null;

const reserveSound = new Audio("media/reserved.mp3");
reserveSound.preload = "auto";

// Modal elements
const modal = document.getElementById("name-modal");
const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("reserver-name");

// Description modal elements
const descriptionModal = document.getElementById("description-modal");
const descriptionContent = document.getElementById("description-content");

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

function showDescriptionModal(wish) {
  if (!descriptionModal || !descriptionContent) return;

  const reservedBy = reservations[wish.id] || "";
  const isReserved = Boolean(reservedBy);

  descriptionContent.innerHTML = `
    ${wish.image ? `<img src="${wish.image}" alt="${wish.title}" class="modal-wish-image">` : ''}
    <h2>${wish.title}</h2>
    ${wish.price ? `<p class="modal-price">${wish.price}</p>` : ''}
    ${isReserved ? `<p class="modal-reserved">Reserviert von ${reservedBy} ✔</p>` : ''}
    ${wish.description ? `<div class="modal-description">${wish.description}</div>` : '<p class="modal-no-description">Keine Beschreibung vorhanden.</p>'}
    <div class="modal-actions">
      <a class="btn btn-primary" href="${wish.url}" target="_blank" rel="noopener noreferrer">Zum Webshop</a>
      <button type="button" class="btn btn-outline" data-role="close-description">Schließen</button>
    </div>
  `;

  descriptionModal.hidden = false;
  requestAnimationFrame(() => {
    descriptionModal.classList.add("is-visible");
  });
}

function closeDescriptionModal() {
  if (!descriptionModal) return;
  descriptionModal.classList.remove("is-visible");
  setTimeout(() => {
    descriptionModal.hidden = true;
  }, 200);
}

// Set up description modal close handlers
if (descriptionModal) {
  descriptionModal.addEventListener('click', (event) => {
    if (event.target.closest('[data-role="close-description"]')) {
      closeDescriptionModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !descriptionModal.hidden) {
      closeDescriptionModal();
    }
  });
}

function createWishCard(wish) {
  const reservedBy = reservations[wish.id] || "";
  const isReserved = Boolean(reservedBy);
  const imageMarkup = wish.image
    ? `<img src="${wish.image}" alt="${wish.title}">`
    : "";
  const card = document.createElement("article");
  card.className = `wish-card${isReserved ? " reserved" : ""}`;
  card.dataset.wishId = wish.id;
  card.innerHTML = `
    <div class="wish-card-clickable" data-role="show-description">
      ${imageMarkup}
      <div class="wish-body">
        <p class="wish-title">${wish.title}</p>
        ${wish.price ? `<span class="wish-price">${wish.price}</span>` : ""}
        ${wish.description ? '<span class="wish-has-description">ℹ️ Klicken für Details</span>' : ''}
      </div>
    </div>
    <div class="wish-actions">
      <a class="btn btn-primary" href="${wish.url}" target="_blank" rel="noopener noreferrer">Webshop</a>
      <button class="btn btn-outline" type="button" aria-pressed="${isReserved}" data-role="reserve">
        ${isReserved ? "Unreserve" : "Reserve"}
      </button>
    </div>
    <span class="reserve-status" aria-live="polite">${isReserved ? `Reserviert von ${reservedBy} ✔` : ""}</span>
  `;

  const reserveBtn = card.querySelector('[data-role="reserve"]');
  reserveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleReservation(wish, card);
  });

  const clickableArea = card.querySelector('[data-role="show-description"]');
  clickableArea.addEventListener("click", () => {
    showDescriptionModal(wish);
  });

  return card;
}


function showNameModal() {
  return new Promise((resolve, reject) => {
    if (!modal || !nameForm || !nameInput) {
      reject(new Error("Modal elements not found"));
      return;
    }

    // Clear previous input
    nameInput.value = "";
    modal.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("is-visible");
      nameInput.focus();
    });

    const handleSubmit = (event) => {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (name.length >= 2) {
        closeModal();
        resolve(name);
      }
    };

    const handleCancel = () => {
      closeModal();
      reject(new Error("User cancelled"));
    };

    const closeModal = () => {
      modal.classList.remove("is-visible");
      setTimeout(() => {
        modal.hidden = true;
      }, 200);
      nameForm.removeEventListener("submit", handleSubmit);
      modal.querySelector('[data-role="cancel"]')?.removeEventListener("click", handleCancel);
    };

    nameForm.addEventListener("submit", handleSubmit, { once: true });
    modal.querySelector('[data-role="cancel"]')?.addEventListener("click", handleCancel, { once: true });
  });
}

async function toggleReservation(wish, card) {
  const currentReserver = reservations[wish.id] || "";
  const isCurrentlyReserved = Boolean(currentReserver);

  if (!isCurrentlyReserved) {
    // Reserving - ask for name
    try {
      const name = await showNameModal();
      reservations[wish.id] = name;

      const reserveBtn = card.querySelector('[data-role="reserve"]');
      const status = card.querySelector(".reserve-status");
      card.classList.add("reserved");
      reserveBtn.textContent = "Unreserve";
      reserveBtn.setAttribute("aria-pressed", "true");
      status.textContent = `Reserviert von ${name} ✔`;

      // Play sound
      try {
        reserveSound.currentTime = 0;
        reserveSound.play();
      } catch (e) {
        console.warn("Could not play reserve sound", e);
      }

      await persistReservations();
    } catch (error) {
      // User cancelled - do nothing
      console.log("Reservation cancelled");
    }
  } else {
    // Unreserving
    delete reservations[wish.id];

    const reserveBtn = card.querySelector('[data-role="reserve"]');
    const status = card.querySelector(".reserve-status");
    card.classList.remove("reserved");
    reserveBtn.textContent = "Reserve";
    reserveBtn.setAttribute("aria-pressed", "false");
    status.textContent = "";

    await persistReservations();
  }
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