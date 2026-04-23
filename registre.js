const ORIGIN_ORDER = ["humain", "eveille", "sorcier", "familier", "reliquaire"];

const ORIGIN_LABELS = {
  humain: "Humain",
  eveille: "Eveillé",
  sorcier: "Sorcier",
  familier: "Familier",
  reliquaire: "Reliquaire"
};

const TAB_LABELS = {
  all: "Tout voir",
  avatars: "Avatars",
  jobs: "Métiers",
  powers: "Pouvoirs"
};

const state = {
  activeTab: "all",
  search: "",
  origin: "all",
  sortMode: "alpha",
  pnjOnly: false
};

const characters = [
  /*
    FICHE PERSONNAGE VIERGE : À DUPLIQUER UNE SEULE FOIS PAR PERSONNAGE
    {
      id: "pseudo-slug",
      pseudo: "Pseudo",
      isPnj: false,
      origin: "humain", // humain | eveille | sorcier | familier | reliquaire
      jobTitle: "Intitulé du métier",
      workplace: "Lieu de travail",
      presentationLink: "#",
      profileLink: "#",
      avatar: "{AVATAR_FORUMACTIF_OU_URL}",
      faceclaimName: "Pseudo du faceclaim",
      faceclaimSource: "Source du faceclaim",
      faceclaimSourceType: "Jeu vidéo",
      powerName: "Aucun pouvoir",
      powerDescription: "",
      magicDomain: "",
      animalForm: "",
      relicForm: ""
    }
  */
  {
    id: "alice-morane",
    pseudo: "Alice Morane",
    isPnj: false,
    origin: "humain",
    jobTitle: "Libraire",
    workplace: "Librairie des Brumes",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=AM",
    faceclaimName: "Rosa",
    faceclaimSource: "Tears of Themis",
    faceclaimSourceType: "Jeu vidéo",
    powerName: "Aucun pouvoir",
    powerDescription: "Aucune capacité magique connue.",
    magicDomain: "Aucun",
    animalForm: "",
    relicForm: ""
  },
  {
    id: "bastien-roche",
    pseudo: "Bastien Roche",
    isPnj: true,
    origin: "humain",
    jobTitle: "Inspecteur de police",
    workplace: "Commissariat du Centre-ville",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=BR",
    faceclaimName: "Loid Forger",
    faceclaimSource: "Spy x Family",
    faceclaimSourceType: "Manga",
    powerName: "Aucun pouvoir",
    powerDescription: "Se fie uniquement à son instinct et à ses dossiers.",
    magicDomain: "Aucun",
    animalForm: "",
    relicForm: ""
  },
  {
    id: "celeste-arden",
    pseudo: "Céleste Arden",
    isPnj: false,
    origin: "eveille",
    jobTitle: "Chanteuse de cabaret",
    workplace: "Le Minuit Pourpre",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=CA",
    faceclaimName: "Kafka",
    faceclaimSource: "Honkai: Star Rail",
    faceclaimSourceType: "Jeu vidéo",
    powerName: "Voix du voile",
    powerDescription: "Influence brièvement les émotions par le chant.",
    magicDomain: "Enchantement",
    animalForm: "",
    relicForm: ""
  },
  {
    id: "damien-virel",
    pseudo: "Damien Virel",
    isPnj: true,
    origin: "eveille",
    jobTitle: "Archiviste",
    workplace: "Archives municipales",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=DV",
    faceclaimName: "Victor Grantz",
    faceclaimSource: "Identity V",
    faceclaimSourceType: "Jeu vidéo",
    powerName: "Mémoire du papier",
    powerDescription: "Perçoit les traces émotionnelles laissées sur les documents.",
    magicDomain: "Psychométrie",
    animalForm: "",
    relicForm: ""
  },
  {
    id: "esme-valombre",
    pseudo: "Esmé Valombre",
    isPnj: false,
    origin: "sorcier",
    jobTitle: "Herboriste",
    workplace: "Serre de l'Aube",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=EV",
    faceclaimName: "Yae Miko",
    faceclaimSource: "Genshin Impact",
    faceclaimSourceType: "Jeu vidéo",
    powerName: "Floraison d'encre",
    powerDescription: "Fait pousser des plantes rituelles servant de catalyseurs.",
    magicDomain: "Botanomancie",
    animalForm: "",
    relicForm: ""
  },
  {
    id: "felix-noctis",
    pseudo: "Félix Noctis",
    isPnj: true,
    origin: "sorcier",
    jobTitle: "Professeur particulier",
    workplace: "Hauts-Bois",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=FN",
    faceclaimName: "Sebastian Michaelis",
    faceclaimSource: "Black Butler",
    faceclaimSourceType: "Manga",
    powerName: "Fil de lune",
    powerDescription: "Tisse des fils magiques capables de retenir ou marquer une cible.",
    magicDomain: "Tissage occulte",
    animalForm: "",
    relicForm: ""
  },
  {
    id: "goupil",
    pseudo: "Goupil",
    isPnj: false,
    origin: "familier",
    jobTitle: "Coursier",
    workplace: "Vesperune",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=GO",
    faceclaimName: "Puss in Boots",
    faceclaimSource: "Shrek",
    faceclaimSourceType: "Film d'animation",
    powerName: "Saut de suie",
    powerDescription: "Traverse brièvement les ombres pour parcourir de courtes distances.",
    magicDomain: "Déplacement",
    animalForm: "Renard",
    relicForm: ""
  },
  {
    id: "miette",
    pseudo: "Miette",
    isPnj: true,
    origin: "familier",
    jobTitle: "Serveuse",
    workplace: "Maple & Pine",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=MI",
    faceclaimName: "Jiji",
    faceclaimSource: "Kiki la petite sorcière",
    faceclaimSourceType: "Film d'animation",
    powerName: "Aucun pouvoir",
    powerDescription: "Ne manifeste aucun don notable pour le moment.",
    magicDomain: "Aucun",
    animalForm: "Chat",
    relicForm: ""
  },
  {
    id: "oriane-lux",
    pseudo: "Oriane Lux",
    isPnj: false,
    origin: "reliquaire",
    jobTitle: "Restauratrice d'art",
    workplace: "Atelier Saint-Clair",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=OL",
    faceclaimName: "Violet Evergarden",
    faceclaimSource: "Violet Evergarden",
    faceclaimSourceType: "Anime",
    powerName: "Reflet scellé",
    powerDescription: "Emprisonne un souvenir ou un serment dans une surface polie.",
    magicDomain: "Scellement",
    animalForm: "",
    relicForm: "Miroir"
  },
  {
    id: "peregrine-ashdown",
    pseudo: "Peregrine Ashdown",
    isPnj: true,
    origin: "reliquaire",
    jobTitle: "Croque-mort",
    workplace: "Maison funéraire des Cendres",
    presentationLink: "#",
    profileLink: "#",
    avatar: "https://placehold.co/160x160?text=PA",
    faceclaimName: "Undertaker",
    faceclaimSource: "Black Butler",
    faceclaimSourceType: "Manga",
    powerName: "Lueur de veille",
    powerDescription: "Guide les esprits proches d'un objet-relique chargé.",
    magicDomain: "Thanatomancie",
    animalForm: "",
    relicForm: "Lanterne"
  }
];

const elements = {
  content: document.getElementById("register-content"),
  tabs: Array.from(document.querySelectorAll(".register-tab")),
  search: document.getElementById("register-search-input"),
  origin: document.getElementById("register-origin-filter"),
  sortMode: document.getElementById("register-sort-mode"),
  pnjToggle: document.getElementById("register-pnj-toggle"),
  count: document.getElementById("register-results-count")
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSearchableText(character) {
  return normalizeText([
    character.pseudo,
    character.jobTitle,
    character.workplace,
    ORIGIN_LABELS[character.origin],
    character.faceclaimName,
    character.faceclaimSource,
    character.faceclaimSourceType,
    character.powerName,
    character.powerDescription,
    character.magicDomain,
    character.animalForm,
    character.relicForm,
    character.isPnj ? "pnj" : "joueur"
  ].join(" "));
}

function matchesSearch(character, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  return getSearchableText(character).includes(searchTerm);
}

function compareAlpha(a, b) {
  return normalizeText(a.pseudo).localeCompare(normalizeText(b.pseudo), "fr");
}

function compareOrigin(a, b) {
  const originA = ORIGIN_ORDER.indexOf(a.origin);
  const originB = ORIGIN_ORDER.indexOf(b.origin);

  if (originA !== originB) {
    return originA - originB;
  }

  return compareAlpha(a, b);
}

function getFilteredCharacters() {
  const searchTerm = normalizeText(state.search);

  const filtered = characters.filter(function (character) {
    const matchesOrigin = state.origin === "all" || character.origin === state.origin;
    const matchesPnj = !state.pnjOnly || character.isPnj === true;
    const searchIsMatching = matchesSearch(character, searchTerm);

    return matchesOrigin && matchesPnj && searchIsMatching;
  });

  const sorted = filtered.slice().sort(state.sortMode === "origin" ? compareOrigin : compareAlpha);
  return sorted;
}

function updateCount(total) {
  const label = total > 1 ? "personnages" : "personnage";
  elements.count.textContent = total + " " + label + " · vue : " + TAB_LABELS[state.activeTab];
}

function createLink(label, href) {
  const link = document.createElement("a");
  link.textContent = label;
  link.href = href || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function createParagraph(label, value) {
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = label + " : ";
  paragraph.appendChild(strong);
  paragraph.appendChild(document.createTextNode(value && String(value).trim() ? value : "—"));
  return paragraph;
}

function createCardHeader(character) {
  const header = document.createElement("div");
  header.className = "character-card__header";

  const avatarWrap = document.createElement("div");
  avatarWrap.className = "character-card__avatar-wrap";

  const avatar = document.createElement("img");
  avatar.className = "character-card__avatar";
  avatar.src = character.avatar || "https://dummyimage.com/80x80/ffffff/000000&text=?";
  avatar.alt = "Avatar de " + character.pseudo;

  avatarWrap.appendChild(avatar);

  const identity = document.createElement("div");
  identity.className = "character-card__identity";

  const name = document.createElement("h2");
  name.className = "character-card__name";
  name.textContent = character.pseudo || "Sans pseudo";

  const origin = document.createElement("p");
  origin.className = "character-card__origin";
  origin.textContent = ORIGIN_LABELS[character.origin] || "Origine inconnue";

  const pnj = document.createElement("p");
  pnj.className = "character-card__pnj";
  pnj.textContent = character.isPnj ? "PNJ" : "Joueur";

  identity.appendChild(name);
  identity.appendChild(origin);
  identity.appendChild(pnj);

  header.appendChild(avatarWrap);
  header.appendChild(identity);

  return header;
}

function createAllCardBody(character) {
  const body = document.createElement("div");
  body.className = "character-card__body";

  body.appendChild(createParagraph("Métier", character.jobTitle));
  body.appendChild(createParagraph("Lieu de travail", character.workplace));
  body.appendChild(createParagraph("Faceclaim", [character.faceclaimName, character.faceclaimSource].filter(Boolean).join(" ✦ ")));
  body.appendChild(createParagraph("Type de source", character.faceclaimSourceType));
  body.appendChild(createParagraph("Pouvoir", character.powerName || "Aucun pouvoir"));
  body.appendChild(createParagraph("Description", character.powerDescription));
  body.appendChild(createParagraph("Domaine magique", character.magicDomain));

  if (character.origin === "familier") {
    body.appendChild(createParagraph("Forme animale", character.animalForm));
  }

  if (character.origin === "reliquaire") {
    body.appendChild(createParagraph("Forme relique", character.relicForm));
  }

  return body;
}

function createAvatarsCardBody(character) {
  const body = document.createElement("div");
  body.className = "character-card__body";

  body.appendChild(createParagraph("Faceclaim", [character.faceclaimName, character.faceclaimSource].filter(Boolean).join(" ✦ ")));
  body.appendChild(createParagraph("Type de source", character.faceclaimSourceType));
  body.appendChild(createParagraph("Métier", character.jobTitle));

  return body;
}

function createJobsCardBody(character) {
  const body = document.createElement("div");
  body.className = "character-card__body";

  body.appendChild(createParagraph("Métier", character.jobTitle));
  body.appendChild(createParagraph("Lieu de travail", character.workplace));
  body.appendChild(createParagraph("Origine", ORIGIN_LABELS[character.origin] || "—"));

  return body;
}

function createPowersCardBody(character) {
  const body = document.createElement("div");
  body.className = "character-card__body";

  body.appendChild(createParagraph("Pouvoir", character.powerName || "Aucun pouvoir"));
  body.appendChild(createParagraph("Description", character.powerDescription));
  body.appendChild(createParagraph("Domaine magique", character.magicDomain));

  if (character.origin === "familier") {
    body.appendChild(createParagraph("Forme animale", character.animalForm));
  }

  if (character.origin === "reliquaire") {
    body.appendChild(createParagraph("Forme relique", character.relicForm));
  }

  return body;
}

function createLinks(character) {
  const links = document.createElement("div");
  links.className = "character-card__links";
  links.appendChild(createLink("Fiche", character.presentationLink));
  links.appendChild(createLink("Profil", character.profileLink));
  return links;
}

function createCharacterCard(character) {
  const card = document.createElement("article");
  card.className = "character-card " + (character.origin || "unknown");
  card.dataset.origin = character.origin || "";
  card.dataset.id = character.id || "";

  card.appendChild(createCardHeader(character));

  if (state.activeTab === "avatars") {
    card.appendChild(createAvatarsCardBody(character));
  } else if (state.activeTab === "jobs") {
    card.appendChild(createJobsCardBody(character));
  } else if (state.activeTab === "powers") {
    card.appendChild(createPowersCardBody(character));
  } else {
    card.appendChild(createAllCardBody(character));
  }

  card.appendChild(createLinks(character));

  return card;
}

function createEmptyState() {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const inner = document.createElement("div");
  inner.className = "empty-state__inner";

  const title = document.createElement("strong");
  title.textContent = "Aucun personnage à afficher.";

  const text = document.createElement("p");
  text.textContent = "Ajoute des personnages dans le tableau \"characters\" du fichier registre.js.";

  inner.appendChild(title);
  inner.appendChild(text);
  empty.appendChild(inner);

  return empty;
}

function renderGroupedByOrigin(charactersToRender) {
  ORIGIN_ORDER.forEach(function (originKey) {
    const items = charactersToRender.filter(function (character) {
      return character.origin === originKey;
    });

    if (!items.length) {
      return;
    }

    const group = document.createElement("section");
    group.className = "origin-group";

    const title = document.createElement("h2");
    title.className = "origin-group__title";
    title.textContent = ORIGIN_LABELS[originKey] + "s";

    const cards = document.createElement("div");
    cards.className = "origin-group__cards";

    items.forEach(function (character) {
      cards.appendChild(createCharacterCard(character));
    });

    group.appendChild(title);
    group.appendChild(cards);
    elements.content.appendChild(group);
  });
}

function renderFlat(charactersToRender) {
  const wrapper = document.createElement("div");
  wrapper.className = "origin-group__cards";

  charactersToRender.forEach(function (character) {
    wrapper.appendChild(createCharacterCard(character));
  });

  elements.content.appendChild(wrapper);
}

function render() {
  const filteredCharacters = getFilteredCharacters();
  elements.content.innerHTML = "";
  updateCount(filteredCharacters.length);

  if (!filteredCharacters.length) {
    elements.content.appendChild(createEmptyState());
    return;
  }

  if (state.sortMode === "origin") {
    renderGroupedByOrigin(filteredCharacters);
    return;
  }

  renderFlat(filteredCharacters);
}

function syncTabButtons() {
  elements.tabs.forEach(function (tabButton) {
    const isActive = tabButton.dataset.tab === state.activeTab;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  });
}

function bindEvents() {
  elements.tabs.forEach(function (tabButton) {
    tabButton.addEventListener("click", function () {
      state.activeTab = tabButton.dataset.tab;
      syncTabButtons();
      render();
    });
  });

  elements.search.addEventListener("input", function (event) {
    state.search = event.target.value;
    render();
  });

  elements.origin.addEventListener("change", function (event) {
    state.origin = event.target.value;
    render();
  });

  elements.sortMode.addEventListener("change", function (event) {
    state.sortMode = event.target.value;
    render();
  });

  elements.pnjToggle.addEventListener("click", function () {
    state.pnjOnly = !state.pnjOnly;
    elements.pnjToggle.classList.toggle("is-active", state.pnjOnly);
    elements.pnjToggle.setAttribute("aria-pressed", String(state.pnjOnly));
    render();
  });
}

bindEvents();
syncTabButtons();
render();
