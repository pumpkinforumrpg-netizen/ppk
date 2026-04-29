(() => {
  "use strict";

  const SCRIPT_VERSION = "2026-04-29-valid-card-1";

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
     * [] = aucune restriction, pratique pour tester avec un autre compte admin.
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
  };

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

    /**
     * Priorité absolue :
     * Sur ton forum, <valid></valid> devient :
     * <div class="valid-card">...</div>
     */
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

      const usernameMatches =
        normalizeText(authorUsername) === normalizeText(CFG.validatorUsername);

      const idMatches =
        CFG.validatorUserId == null || CFG.validatorUserId === authorId;

      if (!usernameMatches || !idMatches) {
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

    /**
     * Fallback :
     * Si un jour le tag brut reste visible.
     */
    for (const post of posts) {
      if (!postContainsValidationMarker(post)) {
        continue;
      }

      const authorLink = getAuthorLinkFromPost(post);
      const authorUsername = usernameFromProfileLink(authorLink);
      const authorId = userIdFromProfileLink(authorLink);

      const usernameMatches =
        normalizeText(authorUsername) === normalizeText(CFG.validatorUsername);

      const idMatches =
        CFG.validatorUserId == null || CFG.validatorUserId === authorId;

      if (!usernameMatches || !idMatches) {
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

    return {
      id: userIdFromProfileLink(authorLink),
      username: usernameFromProfileLink(authorLink),
      link: authorLink,
    };
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

  function getGroupAdminUrl(group) {
    const tid = getTidToken();
    const template = CFG.groupAdminUrls[group];

    if (!template) {
      throw new Error(`URL du groupe non configurée pour : ${group}`);
    }

    if (template.includes("{tid}")) {
      if (!tid) {
        throw new Error("Token tid introuvable pour construire l'URL du PA.");
      }

      return template.replace("{tid}", encodeURIComponent(tid));
    }

    return template;
  }

  function looksLikeAdminLoginPage(html) {
    const text = normalizeText(html);

    return (
      text.includes("connexion") ||
      text.includes("login") ||
      text.includes("mot de passe") ||
      text.includes("vous n'avez pas les droits") ||
      text.includes("not authorised") ||
      text.includes("not authorized")
    );
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
    const groupUrl = getGroupAdminUrl(group);
    const html = await fetchText(groupUrl);

    if (looksLikeAdminLoginPage(html)) {
      throw new Error("Accès PA refusé ou session PA expirée. Connecte-toi au PA puis recharge la fiche.");
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
    });

    if (CFG.dryRun) {
      toast(`[DRY RUN] ${username} serait ajouté au groupe ${group}`);
      return true;
    }

    await submitFormLikeBrowser(action, method, data);

    return true;
  }

  async function run() {
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

      log("Validation détectée", {
        validator: validationPost.authorUsername,
        validatorId: validationPost.authorId,
        author: author.username,
        authorId: author.id,
        group,
      });

      toast(`Validation détectée : ${author.username} → ${group}. Automatisation en cours…`);

      await addUserToGroup(author.username, group);
      await moveTopicToValidatedForum();

      markProcessed();

      toast(`Fiche validée automatiquement : ${author.username} → ${group}.`, "success");
    } catch (err) {
      fail(err);
      markFailed(err.message || String(err));
      toast(`Auto-validation échouée : ${err.message || err}`, "error");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
