/**
 * Important : ton script qui transforme <valid></valid> en .valid-card
 * tourne aussi sur DOMContentLoaded. On laisse donc un court délai et
 * quelques tentatives pour éviter que l'auto-validation démarre trop tôt.
 */
function startWithRetries() {
  const delays = [0, 300, 800, 1500, 2500];

  delays.forEach((delay) => {
    setTimeout(() => {
      if (isAlreadyProcessed()) return;
      run();
    }, delay);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startWithRetries);
} else {
  startWithRetries();
}
})();
