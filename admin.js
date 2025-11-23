const PREDEFINED_OWNERS = [
  { value: 'lena', label: 'Lena' },
  { value: 'lea', label: 'Lea' },
  { value: 'zoe', label: 'Zoe' },
  { value: 'holger', label: 'Holger' },
];

const WISH_ENDPOINT = '/api/admin/wishes/';

const state = { wishes: [] };

const populateOwners = (selectEl) => {
  if (!selectEl || selectEl.dataset.populated === 'true') return;
  const fragment = document.createDocumentFragment();
  PREDEFINED_OWNERS.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    fragment.appendChild(option);
  });
  selectEl.appendChild(fragment);
  selectEl.dataset.populated = 'true';
};

const setStatus = (statusEl, message, isError = false) => {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.dataset.status = isError ? 'error' : 'success';
};

const revealSection = (section) => {
  if (!section) return;
  requestAnimationFrame(() => {
    section.hidden = false;
    requestAnimationFrame(() => section.classList.add('is-visible'));
  });
};

const hideSection = (section) => {
  if (!section) return;
  section.classList.remove('is-visible');
  setTimeout(() => {
    section.hidden = true;
  }, 200);
};

const refreshWishCache = async (force = false) => {
  if (!force && state.wishes.length) return state.wishes;
  const resp = await fetch(WISH_ENDPOINT);
  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(message || 'Wünsche konnten nicht geladen werden.');
  }
  const wishes = await resp.json();
  state.wishes = Array.isArray(wishes) ? wishes : [];
  return state.wishes;
};

const formatOwnerLabel = (ownerValue) =>
  PREDEFINED_OWNERS.find(({ value }) => value === ownerValue?.toLowerCase())?.label ||
  ownerValue ||
  'Unbekannt';

const populateWishSelect = (selectEl, wishes, preferredId) => {
  if (!selectEl) return;
  const current = preferredId ?? selectEl.value;
  selectEl.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.disabled = true;
  placeholder.value = '';
  placeholder.textContent = wishes.length ? 'Wunsch auswählen' : 'Keine Wünsche vorhanden';
  if (!current) placeholder.selected = true;
  selectEl.appendChild(placeholder);

  const sorted = [...wishes].sort(
    (a, b) =>
      (a.owner || '').localeCompare(b.owner || '') ||
      (a.title || '').localeCompare(b.title || '')
  );

  sorted.forEach((wish) => {
    const option = document.createElement('option');
    option.value = wish.id;
    option.textContent = `${formatOwnerLabel(wish.owner)} · ${wish.title}`;
    selectEl.appendChild(option);
  });

  if (current && sorted.some((wish) => wish.id === current)) {
    selectEl.value = current;
  } else {
    selectEl.value = '';
  }
};

const fillEditFormFromWish = (form, wish) => {
  if (!form) return;
  const setValue = (selector, value = '') => {
    const field = form.querySelector(selector);
    if (field) field.value = value;
  };

  setValue('#edit-wish-id', wish?.id ?? '');
  setValue('#edit-wish-title', wish?.title ?? '');
  setValue('#edit-wish-url', wish?.url ?? '');
  setValue('#edit-wish-price', wish?.price ?? '');
  setValue('#edit-wish-image', wish?.image ?? '');
  setValue('#edit-wish-description', wish?.description ?? '');

  const ownerSelect = form.querySelector('#edit-wish-owner');
  if (ownerSelect) ownerSelect.value = wish?.owner?.toLowerCase() ?? '';
};

const handleSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form) return;

  const statusEl = form.querySelector('.form-status');
  const submitButton = form.querySelector('button[type="submit"]');

  const formData = new FormData(form);
  const payload = {
    owner: formData.get('owner')?.toString().trim(),
    title: formData.get('title')?.toString().trim(),
    url: formData.get('url')?.toString().trim(),
    price: formData.get('price')?.toString().trim(),
    image: formData.get('image')?.toString().trim(),
    description: formData.get('description')?.toString().trim(),
  };

  if (!payload.owner || !payload.title || !payload.url) {
    setStatus(statusEl, 'Bitte Besitzer*in, Titel und Link ausfüllen.', true);
    return;
  }

  submitButton?.setAttribute('disabled', 'true');
  setStatus(statusEl, 'Speichere …');

  try {
    const resp = await fetch(WISH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const message = await resp.text();
      throw new Error(message || 'Speichern fehlgeschlagen.');
    }

    form.reset();
    setStatus(statusEl, 'Gespeichert!');
    state.wishes = [];
  } catch (error) {
    setStatus(statusEl, error.message ?? 'Unerwarteter Fehler.', true);
  } finally {
    submitButton?.removeAttribute('disabled');
  }
};

const handleWishSelection = (event, editForm) => {
  if (!editForm) return;
  const selectedId = event.target.value;
  const statusEl = editForm.querySelector('.form-status');

  if (!selectedId) {
    fillEditFormFromWish(editForm, null);
    setStatus(statusEl, 'Bitte einen Wunsch auswählen.', true);
    return;
  }
  const wish = state.wishes.find((entry) => entry.id === selectedId);
  fillEditFormFromWish(editForm, wish ?? null);
  setStatus(
    statusEl,
    wish ? 'Wunsch geladen. Änderungen speichern mit „Aktualisieren“.' : 'Wunsch nicht gefunden.',
    !wish
  );
};

const updateLocalWishCache = (updatedWish) => {
  const index = state.wishes.findIndex((wish) => wish.id === updatedWish.id);
  if (index >= 0) {
    state.wishes[index] = updatedWish;
  } else {
    state.wishes.push(updatedWish);
  }
};

const handleEditSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form) return;

  const statusEl = form.querySelector('.form-status');
  const submitButton = form.querySelector('button[type="submit"]');

  const formData = new FormData(form);
  const id = formData.get('id')?.toString().trim();
  if (!id) {
    setStatus(statusEl, 'Bitte zuerst einen Wunsch auswählen.', true);
    return;
  }

  const payload = {
    owner: formData.get('owner')?.toString().trim(),
    title: formData.get('title')?.toString().trim(),
    url: formData.get('url')?.toString().trim(),
    price: formData.get('price')?.toString().trim(),
    image: formData.get('image')?.toString().trim(),
    description: formData.get('description')?.toString().trim(),
  };

  if (!payload.owner || !payload.title || !payload.url) {
    setStatus(statusEl, 'Bitte Besitzer*in, Titel und Link ausfüllen.', true);
    return;
  }

  submitButton?.setAttribute('disabled', 'true');
  setStatus(statusEl, 'Aktualisiere …');

  try {
    const resp = await fetch(`${WISH_ENDPOINT}${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const message = await resp.text();
      throw new Error(message || 'Aktualisierung fehlgeschlagen.');
    }

    const updatedWish = await resp.json();
    updateLocalWishCache(updatedWish);

    const selectEl = form.querySelector('#wish-select');
    populateWishSelect(selectEl, state.wishes, updatedWish.id);
    fillEditFormFromWish(form, updatedWish);
    setStatus(statusEl, 'Aktualisiert!');
  } catch (error) {
    setStatus(statusEl, error.message ?? 'Unerwarteter Fehler.', true);
  } finally {
    submitButton?.removeAttribute('disabled');
  }
};

const loadEditorData = async (editForm, force = true) => {
  if (!editForm) return;
  const statusEl = editForm.querySelector('.form-status');
  const selectEl = editForm.querySelector('#wish-select');
  setStatus(statusEl, 'Lade Wünsche …');

  try {
    const wishes = await refreshWishCache(force);
    populateWishSelect(selectEl, wishes);
    setStatus(
      statusEl,
      wishes.length ? 'Wunsch auswählen und bearbeiten.' : 'Noch keine Wünsche vorhanden.'
    );
  } catch (error) {
    setStatus(statusEl, error.message ?? 'Wünsche konnten nicht geladen werden.', true);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  const formSection = document.getElementById('wish-form-section');
  const newWishForm = document.getElementById('new-wish-form');
  const editorSection = document.getElementById('wish-editor-section');
  const editWishForm = document.getElementById('edit-wish-form');
  const deleteSection = document.getElementById('wish-delete-section');
  const deleteWishForm = document.getElementById('delete-wish-form');

  const closableSections = [formSection, editorSection, deleteSection];
  const handleEscapeKey = (event) => {
    if (event.key !== 'Escape') return;
    let closedAny = false;
    closableSections.forEach((section) => {
      if (section && !section.hidden) {
        hideSection(section);
        closedAny = true;
      }
    });
    if (closedAny) closeMenu();
  };
  document.addEventListener('keydown', handleEscapeKey);

  populateOwners(document.getElementById('wish-owner'));
  populateOwners(document.getElementById('edit-wish-owner'));

  if (newWishForm) {
    newWishForm.addEventListener('submit', handleSubmit);
  }

  if (editWishForm) {
    editWishForm.addEventListener('submit', handleEditSubmit);
    editWishForm
      .querySelector('#wish-select')
      ?.addEventListener('change', (event) => handleWishSelection(event, editWishForm));
  }

  const burgerButton = document.querySelector('[data-role="menu-toggle"]');
  const pageMenu = document.querySelector('.page-menu');

  const closeMenu = () => {
    if (!burgerButton || !pageMenu) return;
    burgerButton.setAttribute('aria-expanded', 'false');
    pageMenu.hidden = true;
  };

  burgerButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!pageMenu) return;
    const expanded = burgerButton.getAttribute('aria-expanded') === 'true';
    burgerButton.setAttribute('aria-expanded', String(!expanded));
    pageMenu.hidden = expanded;
  });

  document.addEventListener('click', (event) => {
    if (!pageMenu || !burgerButton) return;
    if (
      pageMenu.hidden ||
      event.target === pageMenu ||
      pageMenu.contains(event.target) ||
      event.target === burgerButton
    ) {
      return;
    }
    closeMenu();
  });

  const addWishButton = document.querySelector('[data-role="add-wish"]');
  addWishButton?.addEventListener('click', (event) => {
    event.preventDefault();
    closeMenu();
    hideSection(editorSection);
    hideSection(deleteSection);
    revealSection(formSection);
    formSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      newWishForm?.querySelector('[name="owner"]')?.focus();
    }, 220);
    newWishForm?.querySelector('[name="owner"]')?.focus();
  });

  const editWishButton = document.querySelector('[data-role="edit-wish"]');
  editWishButton?.addEventListener('click', async (event) => {
    event.preventDefault();
    closeMenu();
    hideSection(formSection);
    revealSection(editorSection);
    await loadEditorData(editWishForm, true);
    editorSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editWishForm?.querySelector('#wish-select')?.focus();
  });

  document
    .querySelector('[data-role="close-form"]')
    ?.addEventListener('click', () => hideSection(formSection));
  document
    .querySelector('[data-role="close-editor"]')
    ?.addEventListener('click', () => hideSection(editorSection));

  const deleteWishButton = document.querySelector('[data-role="delete-wish"]');
  deleteWishButton?.addEventListener('click', async (event) => {
    event.preventDefault();
    closeMenu();
    hideSection(formSection);
    hideSection(editorSection);
    revealSection(deleteSection);
    await loadDeleteData(deleteWishForm, true);
    deleteSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    deleteWishForm?.querySelector('#delete-wish-select')?.focus();
  });

  if (deleteWishForm) {
    deleteWishForm.addEventListener('submit', handleDeleteSubmit);
    deleteWishForm
      .querySelector('#delete-wish-select')
      ?.addEventListener('change', (event) => handleDeleteSelection(event, deleteWishForm));
  }

  document
    .querySelector('[data-role="close-delete"]')
    ?.addEventListener('click', () => hideSection(deleteSection));
});

const fillDeletePreview = (form, wish) => {
  if (!form) return;
  const preview = form.querySelector('[data-role="wish-preview"]');
  if (!preview) return;

  if (!wish) {
    preview.textContent = 'Noch kein Wunsch ausgewählt.';
    return;
  }

  const price = wish.price ? ` · ${wish.price}` : '';
  preview.textContent = `${formatOwnerLabel(wish.owner)} · ${wish.title}${price}`;
};

const handleDeleteSelection = (event, deleteForm) => {
  if (!deleteForm) return;
  const selectedId = event.target.value;
  const statusEl = deleteForm.querySelector('.form-status');

  if (!selectedId) {
    fillDeletePreview(deleteForm, null);
    setStatus(statusEl, 'Bitte einen Wunsch auswählen.', true);
    return;
  }

  const wish = state.wishes.find((entry) => entry.id === selectedId) || null;
  fillDeletePreview(deleteForm, wish);
  setStatus(
    statusEl,
    wish ? 'Bereit zum Löschen. Vorgang mit „Löschen“ bestätigen.' : 'Wunsch nicht gefunden.',
    !wish
  );
};

const handleDeleteSubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form) return;

  const statusEl = form.querySelector('.form-status');
  const selectEl = form.querySelector('#delete-wish-select');
  const submitButton = form.querySelector('button[type="submit"]');

  const id = selectEl?.value?.trim();
  if (!id) {
    setStatus(statusEl, 'Bitte zuerst einen Wunsch auswählen.', true);
    return;
  }

  const wish = state.wishes.find((entry) => entry.id === id) || null;
  if (!window.confirm(`Soll "${wish?.title ?? id}" dauerhaft gelöscht werden?`)) {
    setStatus(statusEl, 'Löschen abgebrochen.');
    return;
  }

  submitButton?.setAttribute('disabled', 'true');
  setStatus(statusEl, 'Lösche …');

  try {
    const resp = await fetch(`${WISH_ENDPOINT}${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!resp.ok) {
      const message = await resp.text();
      throw new Error(message || 'Löschen fehlgeschlagen.');
    }

    state.wishes = state.wishes.filter((entry) => entry.id !== id);
    populateWishSelect(selectEl, state.wishes);
    selectEl.value = '';
    fillDeletePreview(form, null);
    setStatus(statusEl, 'Wunsch gelöscht.');

    const editForm = document.getElementById('edit-wish-form');
    if (editForm) {
      const editSelect = editForm.querySelector('#wish-select');
      populateWishSelect(editSelect, state.wishes);
      if (editForm.querySelector('#edit-wish-id')?.value === id) {
        fillEditFormFromWish(editForm, null);
        setStatus(editForm.querySelector('.form-status'), 'Wunsch wurde gelöscht.', true);
      }
    }
  } catch (error) {
    setStatus(statusEl, error.message ?? 'Unerwarteter Fehler.', true);
  } finally {
    submitButton?.removeAttribute('disabled');
  }
};

const loadDeleteData = async (deleteForm, force = true) => {
  if (!deleteForm) return;
  const statusEl = deleteForm.querySelector('.form-status');
  const selectEl = deleteForm.querySelector('#delete-wish-select');
  fillDeletePreview(deleteForm, null);
  setStatus(statusEl, 'Lade Wünsche …');

  try {
    const wishes = await refreshWishCache(force);
    populateWishSelect(selectEl, wishes);
    setStatus(
      statusEl,
      wishes.length ? 'Wunsch auswählen und löschen.' : 'Noch keine Wünsche vorhanden.'
    );
  } catch (error) {
    setStatus(statusEl, error.message ?? 'Wünsche konnten nicht geladen werden.', true);
  }
};