(() => {
  "use strict";

  const SCRIPT_VERSION = "2026-04-29-admin-token-fix-1";

  const CFG = {
    debug: true,
    dryRun: true,

    sourceForumId: 2,
    sourceForumUrl: "https://pumpkinsrpg.forumactif.com/f2-personnages",

    targetForumId: 21,
    targetForumName: "Fiches validées",
    targetForumUrl: "https://pumpkinsrpg.forumactif.com/f21-fiches-validees",

    validationMarker: "<valid></valid>",

    renderedValidationSelectors: [
      ".valid-card",
    ],

    renderedValidationTexts: [
      "Fiche validée",
      "Félicitations, nous te souhaitons la bienvenue parmi nous",
      "Ta fiche de personnage a été validée",
    ],

    validatorUsername: "Pumpkin",
    validatorUserId: 2,

    /**
     * Pumpkin = /u2.
     *
     * [2] = seul Pumpkin peut déclencher l'automatisation.
     * [] = aucune restriction, utile uniquement pour débug avec un autre compte admin.
     */
    allowedRunnerUserIds: [2],

    groupAdminUrls: {
      sorcier: "/admin/?part=users_groups&sub=groups&g=4&mode=editgroup&extended_admin=1&tid={tid}",
      humain: "/admin/?part=users_groups&sub=groups&g=8&mode=editgroup&extended_admin=1&tid={tid}",
      reliquaire: "/admin/?part=users_groups&sub=groups&g=7&mode=editgroup&extended_admin=1&tid={tid}",
      eveille: "/admin/?part=users_groups&sub=groups&g=5&mode=editgroup&extended_admin=1&tid={tid}",
      familier: "/admin/?part=users_groups&sub=groups&g=6&mode=editgroup&extended_admin=1&tid={tid}",
    },

    leaveShadowTopic: false,

    storagePrefix: "pumpkins:auto-validation:",

    /**
     * Token PA : différent du tid de modération du sujet.
     * Le script tente de le récupérer automatiquement depuis le PA.
     */
    adminIndexUrl: "/admin/index.forum?part=users_groups&sub=groups&mode=groups&extended_admin=1",
    adminTidStorageKey: "pumpkins:admin-tid",
  };

  let runInProgress = false;
  let completedThisPage = false;

  const log = (...args) => CFG.debug && console.log("[Pumpkins AutoValidation]", ...args);
  const warn = (...args) => console.warn("[Pumpkins AutoValidation]", ...args);
  const fail = (...args) => console.error("[Pumpkins AutoValidation]", ...args);

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function compact(value) {
    return normalizeText(value).replace(/\s+/g, "");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }

    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function toast(message, type = "info") {
    const el = document.createElement("div");

    el.textContent = message;
    el.style.cssText = [
      "position:fixed",
      "right:18px",
      "bottom:18px",
      "z-index:999999",
      "max-width:420px",
      "padding:12px 14px",
      "border-radius:10px",
      "font:14px/1.45 Arial,sans-serif",
      "box-shadow:0 10px 30px rgba(0,0,0,.25)",
      `background:${type === "error" ? "#7f1d1d" : type === "success" ? "#14532d" : "#1f2937"}`,
      "color:#fff",
    ].join(";");

    document.body.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, type === "error" ? 12000 : 7000);
  }

  function getCurrentUserId() {
    if (window._userdata && window._userdata.user_id) {
      const id = parseInt(window._userdata.user_id, 10);

      if (!Number.isNaN(id) && id > 0) {
        return id;
      }
    }

    return null;
  }

  function runnerIsAllowed() {
    if (!CFG.allowedRunnerUserIds.length) {
      return true;
    }

    const currentUserId = getCurrentUserId();

    return CFG.allowedRunnerUserIds.includes(currentUserId);
  }

  function absoluteUrl(url) {
    return new URL(url, location.origin).toString();
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  async function fetchText(url, options = {}) {
    const response = await fetch(absoluteUrl(url), {
      credentials: "include",
      redirect: "follow",
      ...options,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} sur ${url}`);
    }

    return text;
  }

  function getTidToken(doc = document) {
    const input = doc.querySelector('input[name="tid"]');

    if (input && input.value) {
      return input.value;
    }

    const links = Array.from(
      doc.querySelectorAll('a[href*="tid="], form[action*="tid="]')
    );

    for (const el of links) {
      const raw = el.getAttribute("href") || el.getAttribute("action") || "";
      const match = raw.match(/[?&]tid=([a-z0-9]+)/i);

      if (match) {
        return match[1];
      }
    }

    const html = doc.documentElement ? doc.documentElement.innerHTML : "";
    const match = html.match(/[?&]tid=([a-z0-9]+)/i);

    return match ? match[1] : null;
  }

  function getTopicId(doc = document) {
    const input = doc.querySelector('form[action*="/modcp"] input[name="t"]');

    if (input && input.value) {
      return input.value;
    }

    const canonical = doc.querySelector('link[rel="canonical"]');

    if (canonical) {
      const match = (canonical.getAttribute("href") || "").match(/\/t(\d+)/);

      if (match) {
        return match[1];
      }
    }

    const pathMatch = location.pathname.match(/\/t(\d+)/);

    if (pathMatch) {
      return pathMatch[1];
    }

    const params = new URLSearchParams(location.search);

    return params.get("t");
  }

  function getTopicUrlKey() {
    const topicId = getTopicId();

    return topicId
      ? `${CFG.storagePrefix}${topicId}`
      : `${CFG.storagePrefix}${location.pathname}`;
  }

  function isAlreadyProcessed() {
    return localStorage.getItem(getTopicUrlKey()) === "done";
  }

  function markProcessed() {
    localStorage.setItem(getTopicUrlKey(), "done");
  }

  function markFailed(reason) {
    localStorage.setItem(getTopicUrlKey(), `failed:${Date.now()}:${reason}`);
  }

  function hasForumBreadcrumb(forumId) {
    const re = new RegExp(`/f${forumId}(?:-|$)`);

    return Array.from(document.querySelectorAll("a[href]")).some((a) => {
      try {
        const url = new URL(a.href, location.origin);
        return re.test(url.pathname);
      } catch {
        return false;
      }
    });
  }

  function isSourceTopicPage() {
    return (
      Boolean(getTopicId()) &&
      hasForumBreadcrumb(CFG.sourceForumId) &&
      !hasForumBreadcrumb(CFG.targetForumId)
    );
  }

  function getPostContainers(doc = document) {
    const ppkPosts = Array.from(doc.querySelectorAll(".ppk-post")).filter((el) => {
      const text = normalizeText(el.textContent);
      return text.length > 0 && el.querySelector('a[href*="/u"]');
    });

    if (ppkPosts.length) {
      return ppkPosts;
    }

    const selectors = [
      ".post",
      ".post-wrap",
      ".post_wrapper",
      ".post-container",
      ".postrow",
      "article[class*='post']",
    ].join(",");

    const candidates = Array.from(doc.querySelectorAll(selectors)).filter((el) => {
      const text = normalizeText(el.textContent);
      return text.length > 0 && el.querySelector('a[href*="/u"]');
    });

    const posts = candidates.filter((candidate) => {
      return !candidates.some((other) => other !== candidate && candidate.contains(other));
    });

    if (posts.length) {
      return posts;
    }

    return Array.from(doc.querySelectorAll("table.forumline tr, .row1, .row2")).filter((el) => {
      return el.textContent && el.querySelector('a[href*="/u"]');
    });
  }

  function getAuthorLinkFromPost(post) {
    if (!post) {
      return null;
    }

    const selectors = [
      ".ppk-user-profil .nameprofil a[href*='/u']",
      ".nameprofil a[href*='/u']",
      ".ppk-user-profil a[href*='/u']",
      ".postprofile a[href*='/u']",
      ".postprofile a[href^='/u']",
      ".author a[href*='/u']",
      ".name a[href*='/u']",
      ".username a[href*='/u']",
      ".poster a[href*='/u']",
      "a[href*='/u']",
    ].join(",");

    return post.querySelector(selectors);
  }

  function userIdFromProfileLink(link) {
    if (!link) {
      return null;
    }

    const href = link.getAttribute("href") || "";
    const match = href.match(/\/u(\d+)/);

    return match ? parseInt(match[1], 10) : null;
  }

  function usernameFromProfileLink(link) {
    if (!link) {
      return null;
    }

    return link.textContent.replace(/\s+/g, " ").trim();
  }

  function isAuthorizedValidationAuthor(authorId, authorUsername) {
    /**
     * Sur ton forum, les pseudos sont stylisés dans le DOM.
     * Pumpkin peut apparaître comme "UMIN".
     * Donc si validatorUserId est renseigné, on valide uniquement par ID.
     */
    if (CFG.validatorUserId != null) {
      return authorId === CFG.validatorUserId;
    }

    return normalizeText(authorUsername) === normalizeText(CFG.validatorUsername);
  }

  function postContainsValidationMarker(post) {
    if (!post) {
      return false;
    }

    const wanted = compact(CFG.validationMarker);
    const text = compact(post.textContent);
    const html = compact(post.innerHTML)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    const hasRawMarker =
      text.includes(wanted) ||
      html.includes(wanted) ||
      Boolean(post.querySelector("valid"));

    if (hasRawMarker) {
      return true;
    }

    const hasRenderedValidationBlock = CFG.renderedValidationSelectors.some((selector) => {
      return Boolean(post.querySelector(selector));
    });

    if (hasRenderedValidationBlock) {
      return true;
    }

    const normalizedPostText = normalizeText(post.textContent);

    return CFG.renderedValidationTexts.some((expectedText) => {
      return normalizedPostText.includes(normalizeText(expectedText));
    });
  }

  function getValidationPost() {
    const posts = getPostContainers();

    const renderedCard = document.querySelector(".valid-card");

    if (renderedCard) {
      const post =
        renderedCard.closest(".ppk-post") ||
        renderedCard.closest(".post") ||
        renderedCard.closest("article") ||
        renderedCard.parentElement;

      const authorLink = getAuthorLinkFromPost(post);
      const authorUsername = usernameFromProfileLink(authorLink);
      const authorId = userIdFromProfileLink(authorLink);

      if (!isAuthorizedValidationAuthor(authorId, authorUsername)) {
        warn("Bloc .valid-card trouvé, mais pas posté par le compte autorisé.", {
          authorUsername,
          authorId,
          expectedUsername: CFG.validatorUsername,
          expectedId: CFG.validatorUserId,
        });

        return null;
      }

      return {
        post,
        authorLink,
        authorUsername,
        authorId,
      };
    }

    for (const post of posts) {
      if (!postContainsValidationMarker(post)) {
        continue;
      }

      const authorLink = getAuthorLinkFromPost(post);
      const authorUsername = usernameFromProfileLink(authorLink);
      const authorId = userIdFromProfileLink(authorLink);

      if (!isAuthorizedValidationAuthor(authorId, authorUsername)) {
        warn("Marqueur trouvé, mais pas posté par le compte autorisé.", {
          authorUsername,
          authorId,
          expectedUsername: CFG.validatorUsername,
          expectedId: CFG.validatorUserId,
        });

        return null;
      }

      return {
        post,
        authorLink,
        authorUsername,
        authorId,
      };
    }

    return null;
  }

  function getTopicAuthor() {
    const firstPost = getPostContainers()[0];

    if (!firstPost) {
      return null;
    }

    const authorLink = getAuthorLinkFromPost(firstPost);

    if (!authorLink) {
      return null;
    }

    const avatarImg =
      firstPost.querySelector(".ppk-profile-avatar img[alt]") ||
      firstPost.querySelector(".profil-avatar img[alt]");

    const avatarAltUsername = avatarImg && avatarImg.getAttribute("alt")
      ? avatarImg.getAttribute("alt").trim()
      : "";

    return {
      id: userIdFromProfileLink(authorLink),
      username: avatarAltUsername || usernameFromProfileLink(authorLink),
      link: authorLink,
    };
  }

  function cleanUsernameCandidate(value) {
    let s = String(value || "")
      .replace(/\s+/g, " ")
      .trim();

    if (!s) {
      return "";
    }

    s = s.replace(/^voir un profil\s*[-—|:]\s*/i, "");
    s = s.replace(/^voir le profil de\s+/i, "");
    s = s.replace(/^profil de\s+/i, "");
    s = s.replace(/^profil\s*[-—|:]\s*/i, "");
    s = s.replace(/^profil\s*:\s*/i, "");
    s = s.replace(/^utilisateur\s*:\s*/i, "");

    if (s.includes(" - ") && normalizeText(s).startsWith("voir un profil")) {
      s = s.split(" - ").pop().trim();
    }

    if (normalizeText(s).includes("pumpkinsrpg")) {
      return "";
    }

    if (s.length > 60) {
      return "";
    }

    return s;
  }

  async function resolveUsernameForGroup(author) {
    /**
     * Si on a déjà un pseudo propre via l'alt de l'avatar, on le garde.
     */
    if (author && author.username && !/[-]/.test(author.username)) {
      return author.username;
    }

    if (!author || !author.link) {
      return author ? author.username : "";
    }

    const href = author.link.getAttribute("href");

    if (!href) {
      return author.username;
    }

    try {
      const html = await fetchText(href);
      const doc = parseHtml(html);

      const candidates = [
        doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
        doc.querySelector("title")?.textContent,
        doc.querySelector("h1")?.textContent,
        doc.querySelector(".page-title")?.textContent,
        doc.querySelector(".nameprofil")?.textContent,
        doc.querySelector(".username")?.textContent,
      ];

      for (const candidate of candidates) {
        const cleaned = cleanUsernameCandidate(candidate);

        if (cleaned) {
          log("Pseudo résolu depuis le profil", {
            visibleUsername: author.username,
            resolvedUsername: cleaned,
            profileHref: href,
          });

          return cleaned;
        }
      }
    } catch (err) {
      warn("Impossible de résoudre le pseudo depuis le profil. Utilisation du pseudo visible.", {
        visibleUsername: author.username,
        error: err.message || String(err),
      });
    }

    return author.username;
  }

  function getPostContentRoot(post) {
    if (!post) {
      return null;
    }

    return (
      post.querySelector(".contenu-post") ||
      post.querySelector(".ppk-fiche") ||
      post.querySelector(".postbody") ||
      post.querySelector(".content") ||
      post.querySelector(".post-content") ||
      post.querySelector(".post-entry") ||
      post
    );
  }

  function detectGroupFromFirstPost() {
    const firstPost = getPostContainers()[0];
    const root = getPostContentRoot(firstPost);
    const groups = Object.keys(CFG.groupAdminUrls);

    if (!root) {
      return null;
    }

    for (const group of groups) {
      const escaped = cssEscape(group);

      if (root.classList && root.classList.contains(group)) {
        return group;
      }

      if (root.querySelector(`.${escaped}`)) {
        return group;
      }

      const html = root.innerHTML || "";
      const re = new RegExp(`class=["'][^"']*\\b${group}\\b[^"']*["']`, "i");

      if (re.test(html)) {
        return group;
      }
    }

    return null;
  }

  function formToFormData(form) {
    const data = new FormData();

    Array.from(form.elements).forEach((el) => {
      if (!el.name || el.disabled) {
        return;
      }

      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") || "").toLowerCase();

      if ((type === "checkbox" || type === "radio") && !el.checked) {
        return;
      }

      if (tag === "select") {
        data.set(el.name, el.value);
        return;
      }

      data.set(el.name, el.value || "");
    });

    return data;
  }

  async function submitFormLikeBrowser(action, method, data) {
    const upperMethod = (method || "post").toUpperCase();

    if (upperMethod === "GET") {
      const url = new URL(action, location.origin);

      for (const [key, value] of data.entries()) {
        url.searchParams.set(key, value);
      }

      return fetchText(url.toString(), {
        method: "GET",
      });
    }

    return fetchText(action, {
      method: upperMethod,
      body: data,
    });
  }

  function findTargetForumSelect(form) {
    const selects = Array.from(form.querySelectorAll("select"));

    for (const select of selects) {
      const options = Array.from(select.options);

      const byValue = options.find((option) => {
        return String(option.value) === String(CFG.targetForumId);
      });

      const byText = options.find((option) => {
        return normalizeText(option.textContent).includes(normalizeText(CFG.targetForumName));
      });

      const selected = byValue || byText;

      if (selected) {
        return {
          select,
          name: select.name,
          value: selected.value,
          label: selected.textContent.trim(),
        };
      }
    }

    return null;
  }

  async function moveTopicToValidatedForum() {
    const topicId = getTopicId();
    const tid = getTidToken();

    if (!topicId) {
      throw new Error("ID du sujet introuvable.");
    }

    if (!tid) {
      throw new Error("Token tid introuvable pour la modération.");
    }

    const movePageUrl = `/modcp?mode=move&t=${encodeURIComponent(topicId)}&tid=${encodeURIComponent(tid)}`;
    const movePageHtml = await fetchText(movePageUrl);
    const moveDoc = parseHtml(movePageHtml);

    const form =
      moveDoc.querySelector('form[action*="/modcp"]') ||
      moveDoc.querySelector('form[action*="modcp"]') ||
      moveDoc.querySelector("form");

    if (!form) {
      throw new Error("Formulaire de déplacement introuvable.");
    }

    const targetForum = findTargetForumSelect(form);

    if (!targetForum) {
      throw new Error(`Sous-forum cible introuvable dans le formulaire : ${CFG.targetForumName}.`);
    }

    targetForum.select.value = targetForum.value;

    const data = formToFormData(form);

    data.set("mode", "move");
    data.set("t", topicId);
    data.set("tid", tid);

    if (targetForum.name) {
      data.set(targetForum.name, targetForum.value);
    }

    data.set("confirm", "Oui");
    data.set("submit", "Oui");

    if (CFG.leaveShadowTopic) {
      data.set("move_leave_shadow", "1");
    } else {
      data.delete("move_leave_shadow");
      data.delete("shadow");
    }

    const action = absoluteUrl(form.getAttribute("action") || movePageUrl);
    const method = (form.getAttribute("method") || "post").toUpperCase();

    log("Déplacement du sujet", {
      topicId,
      targetForum,
      action,
      method,
    });

    if (CFG.dryRun) {
      toast(`[DRY RUN] Sujet prêt à être déplacé vers ${CFG.targetForumName}`);
      return true;
    }

    await submitFormLikeBrowser(action, method, data);

    return true;
  }

  function extractTidFromString(value) {
    const match = String(value || "").match(/[?&]tid=([a-z0-9]+)/i);
    return match ? match[1] : null;
  }

  function getAdminTidFromCurrentPage() {
    const adminLinks = Array.from(
      document.querySelectorAll('a[href*="/admin/"][href*="tid="], form[action*="/admin/"][action*="tid="]')
    );

    for (const el of adminLinks) {
      const raw = el.getAttribute("href") || el.getAttribute("action") || "";
      const tid = extractTidFromString(raw);

      if (tid) {
        return tid;
      }
    }

    return null;
  }

  function getAdminTidFromHtml(html, finalUrl = "") {
    const fromUrl = extractTidFromString(finalUrl);

    if (fromUrl) {
      return fromUrl;
    }

    const doc = parseHtml(html);

    const adminLinks = Array.from(
      doc.querySelectorAll('a[href*="/admin/"][href*="tid="], form[action*="/admin/"][action*="tid="]')
    );

    for (const el of adminLinks) {
      const raw = el.getAttribute("href") || el.getAttribute("action") || "";
      const tid = extractTidFromString(raw);

      if (tid) {
        return tid;
      }
    }

    const fromHtml = extractTidFromString(html);

    if (fromHtml) {
      return fromHtml;
    }

    return null;
  }

  async function fetchAdminTid() {
    const currentPageTid = getAdminTidFromCurrentPage();

    if (currentPageTid) {
      localStorage.setItem(CFG.adminTidStorageKey, currentPageTid);
      return currentPageTid;
    }

    const cachedTid = localStorage.getItem(CFG.adminTidStorageKey);

    const candidateUrls = [
      CFG.adminIndexUrl,
      cachedTid ? `${CFG.adminIndexUrl}&tid=${encodeURIComponent(cachedTid)}` : null,
      "/admin/",
    ].filter(Boolean);

    for (const url of candidateUrls) {
      const response = await fetch(absoluteUrl(url), {
        credentials: "include",
        redirect: "follow",
      });

      const html = await response.text();

      if (!response.ok) {
        continue;
      }

      const tid = getAdminTidFromHtml(html, response.url);

      if (tid) {
        localStorage.setItem(CFG.adminTidStorageKey, tid);

        log("Token PA récupéré", {
          adminTid: tid,
          from: url,
          finalUrl: response.url,
        });

        return tid;
      }

      log("Token PA non trouvé dans la page admin testée", {
        url,
        finalUrl: response.url,
        title: parseHtml(html).querySelector("title")?.textContent?.trim() || null,
        snippet: normalizeText(html).slice(0, 240),
      });
    }

    throw new Error(
      "Token PA introuvable. Ouvre le PA dans un onglet, va sur Administration des groupes, puis recharge cette fiche."
    );
  }

  async function getGroupAdminUrl(group) {
    const adminTid = await fetchAdminTid();
    const template = CFG.groupAdminUrls[group];

    if (!template) {
      throw new Error(`URL du groupe non configurée pour : ${group}`);
    }

    return template
      .replace("{adminTid}", encodeURIComponent(adminTid))
      .replace("{tid}", encodeURIComponent(adminTid));
  }

  function looksLikeAdminLoginPage(html) {
    const doc = parseHtml(html);
    const title = normalizeText(doc.querySelector("title")?.textContent || "");
    const bodyText = normalizeText(doc.body?.textContent || html);

    const passwordField = doc.querySelector('input[type="password"]');
    const loginForm = doc.querySelector(
      'form[action*="login"], form[action*="connexion"], form[action*="admin"] input[type="password"]'
    );

    const explicitDenied =
      bodyText.includes("vous n'avez pas les droits") ||
      bodyText.includes("vous n avez pas les droits") ||
      bodyText.includes("not authorised") ||
      bodyText.includes("not authorized") ||
      bodyText.includes("permission refusee") ||
      bodyText.includes("permission refusée");

    const looksLikeLoginTitle =
      title.includes("connexion") ||
      title.includes("login") ||
      title.includes("identification");

    const hasAdminContent =
      bodyText.includes("administration des groupes") ||
      bodyText.includes("membres du groupe") ||
      bodyText.includes("ajouter le membre") ||
      bodyText.includes("modifier un groupe");

    // Le PA contient parfois le mot "Connexion" dans le menu ou le footer.
    // Ce mot seul ne signifie donc PAS que la session est expirée.
    if (hasAdminContent) {
      return false;
    }

    return Boolean(explicitDenied || passwordField || loginForm || looksLikeLoginTitle);
  }

  function findAddMemberForm(doc) {
    const forms = Array.from(doc.querySelectorAll("form"));

    return (
      forms.find((form) => {
        const text = normalizeText(form.textContent);
        const html = normalizeText(form.innerHTML);

        return (
          text.includes("ajouter le membre") ||
          text.includes("ajouter") ||
          html.includes("add_member") ||
          html.includes("username") ||
          html.includes("membre")
        );
      }) || null
    );
  }

  function findUsernameInput(form) {
    const fields = Array.from(
      form.querySelectorAll('input[type="text"], input:not([type]), textarea')
    );

    return (
      fields.find((field) => /username|user|membre|member|pseudo|login/i.test(field.name)) ||
      fields.find((field) => /username|user|membre|member|pseudo|login/i.test(field.id)) ||
      fields[0] ||
      null
    );
  }

  async function addUserToGroup(username, group) {
    const groupUrl = await getGroupAdminUrl(group);
    const html = await fetchText(groupUrl);

    if (looksLikeAdminLoginPage(html)) {
      localStorage.removeItem(CFG.adminTidStorageKey);

      throw new Error(
        "Accès PA refusé, session PA expirée, ou token PA invalide. Ouvre le PA > Administration des groupes, puis recharge la fiche."
      );
    }

    const doc = parseHtml(html);
    const form = findAddMemberForm(doc);

    if (!form) {
      throw new Error(`Formulaire d'ajout membre introuvable pour le groupe : ${group}`);
    }

    const usernameInput = findUsernameInput(form);

    if (!usernameInput || !usernameInput.name) {
      throw new Error(`Champ pseudo introuvable dans le formulaire du groupe : ${group}`);
    }

    const data = formToFormData(form);

    data.set(usernameInput.name, username);

    data.set("add", "1");
    data.set("add_member", "1");
    data.set("submit", "Ajouter le membre");

    const submit = form.querySelector('input[type="submit"][name], button[type="submit"][name]');

    if (submit && submit.name) {
      data.set(submit.name, submit.value || submit.textContent || "1");
    }

    const action = absoluteUrl(form.getAttribute("action") || groupUrl);
    const method = (form.getAttribute("method") || "post").toUpperCase();

    log("Ajout au groupe", {
      username,
      group,
      groupUrl,
      action,
      method,
      usernameField: usernameInput.name,
    });

    if (CFG.dryRun) {
      toast(`[DRY RUN] ${username} serait ajouté au groupe ${group}`);
      return true;
    }

    await submitFormLikeBrowser(action, method, data);

    return true;
  }

  async function run() {
    if (runInProgress || completedThisPage) {
      return;
    }

    runInProgress = true;

    log("Script chargé", {
      version: SCRIPT_VERSION,
      url: location.href,
      sourceForumUrl: CFG.sourceForumUrl,
      targetForumUrl: CFG.targetForumUrl,
      topicId: getTopicId(),
      tid: getTidToken(),
      currentUserId: getCurrentUserId(),
      allowedRunnerUserIds: CFG.allowedRunnerUserIds,
      dryRun: CFG.dryRun,
      validCardsFound: document.querySelectorAll(".valid-card").length,
      rawValidTagsFound: document.querySelectorAll("valid").length,
    });

    try {
      if (!isSourceTopicPage()) {
        log("Arrêt : cette page n'est pas reconnue comme une fiche dans le forum source.", {
          topicId: getTopicId(),
          hasSourceForumBreadcrumb: hasForumBreadcrumb(CFG.sourceForumId),
          hasTargetForumBreadcrumb: hasForumBreadcrumb(CFG.targetForumId),
          sourceForumId: CFG.sourceForumId,
          targetForumId: CFG.targetForumId,
        });

        return;
      }

      if (!runnerIsAllowed()) {
        log("Arrêt : utilisateur courant non autorisé à exécuter l'automatisation.", {
          currentUserId: getCurrentUserId(),
          allowedRunnerUserIds: CFG.allowedRunnerUserIds,
        });

        return;
      }

      if (isAlreadyProcessed()) {
        log("Arrêt : sujet déjà traité dans le localStorage.", {
          key: getTopicUrlKey(),
          value: localStorage.getItem(getTopicUrlKey()),
        });

        return;
      }

      const posts = getPostContainers();

      log("Posts détectés", {
        count: posts.length,
        previews: posts.map((post, index) => ({
          index,
          id: post.id,
          author: usernameFromProfileLink(getAuthorLinkFromPost(post)),
          authorId: userIdFromProfileLink(getAuthorLinkFromPost(post)),
          hasValidCard: Boolean(post.querySelector(".valid-card")),
          hasRawValidTag: Boolean(post.querySelector("valid")),
          hasValidationMarker: postContainsValidationMarker(post),
          text: post.textContent.slice(0, 220),
        })),
      });

      const validationPost = getValidationPost();

      if (!validationPost) {
        log("Arrêt : aucun message de validation valide trouvé.", {
          expectedMarker: CFG.validationMarker,
          expectedRenderedSelector: CFG.renderedValidationSelectors,
          expectedValidatorUsername: CFG.validatorUsername,
          expectedValidatorUserId: CFG.validatorUserId,
          validCardsFound: document.querySelectorAll(".valid-card").length,
          rawValidTagsFound: document.querySelectorAll("valid").length,
        });

        return;
      }

      const author = getTopicAuthor();

      if (!author || !author.username) {
        throw new Error("Auteur de la fiche introuvable.");
      }

      const group = detectGroupFromFirstPost();

      if (!group) {
        throw new Error("Groupe introuvable dans la classe de la fiche. Classes attendues : sorcier, humain, reliquaire, eveille, familier.");
      }

      const usernameForGroup = await resolveUsernameForGroup(author);

      log("Validation détectée", {
        validator: validationPost.authorUsername,
        validatorId: validationPost.authorId,
        authorVisibleUsername: author.username,
        usernameForGroup,
        authorId: author.id,
        group,
      });

      toast(`Validation détectée : ${usernameForGroup} → ${group}. Automatisation en cours…`);

      await addUserToGroup(usernameForGroup, group);
      await moveTopicToValidatedForum();

      completedThisPage = true;

      if (!CFG.dryRun) {
        markProcessed();
      }

      toast(
        CFG.dryRun
          ? `[DRY RUN] Fiche détectée correctement : ${usernameForGroup} → ${group}.`
          : `Fiche validée automatiquement : ${usernameForGroup} → ${group}.`,
        "success"
      );
    } catch (err) {
      fail(err);
      markFailed(err.message || String(err));
      toast(`Auto-validation échouée : ${err.message || err}`, "error");
    } finally {
      runInProgress = false;
    }
  }

  function startWithRetries() {
    const delays = [0, 300, 800, 1500, 2500, 4000];

    delays.forEach((delay) => {
      setTimeout(() => {
        if (completedThisPage) return;
        if (isAlreadyProcessed()) return;
        run();
      }, delay);
    });
  }

  document.addEventListener("pumpkins:valid-cards-ready", () => {
    log("Événement pumpkins:valid-cards-ready reçu.");
    run();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWithRetries);
  } else {
    startWithRetries();
  }
})();
