// Remet la page d'aplomb après une navigation ou une restauration depuis le cache.
//
// Le thème navigue en AJAX et anime les transitions avec GSAP, qui écrit ses états en styles
// inline (opacity, pointer-events). Trois familles d'états peuvent survivre à une navigation
// interrompue ou à une restauration bfcache (retour arrière sur iOS) :
//
// 1. Le tiroir panier restauré avec `.active` : fond brun plein écran qui capte tous les clics.
// 2. Les panneaux <details> (options produit, filtres, menus) restés `open`/`menu-opening` :
//    leur voile plein écran reste peint.
// 3. Les styles inline des transitions : un conteneur laissé à opacity < 1 ternit toute la page
//    par transparence sur le fond beige (le « voile marron »), et un `pointer-events: none`
//    laissé sur le header ou un conteneur rend toute une zone morte au toucher.
(function () {
  function closeCartDrawer() {
    document.querySelectorAll('cart-drawer').forEach(function (drawer) {
      drawer.classList.remove('active', 'animate');
    });
    document.body.classList.remove('overflow-hidden');
  }

  // Après un chargement ou une restauration, aucun panneau ne doit être ouvert : on ferme tout,
  // y compris ceux marqués `menu-opening` (une version précédente les épargnait — c'est
  // précisément l'état bloqué qui maintenait le voile).
  function closeOverlayPanels() {
    document.querySelectorAll('details[open]').forEach(function (details) {
      var isOverlay = details.classList.contains('mega-menu')
        || details.classList.contains('disclosure-has-popup')
        || details.closest('header-drawer')
        || details.closest('menu-drawer');
      if (!isOverlay) return;

      details.classList.remove('menu-opening');
      details.removeAttribute('open');

      var summary = details.querySelector('summary');
      if (summary) summary.setAttribute('aria-expanded', 'false');
    });

    document.querySelectorAll('.menu-opening').forEach(function (el) {
      el.classList.remove('menu-opening');
    });
  }

  // Fond des méga-menus : animé par GSAP en inline, z-index -1 (il ternit DERRIÈRE le contenu).
  function resetMegaMenuBackdrops() {
    document.querySelectorAll('.mega-menu__bg').forEach(function (backdrop) {
      var details = backdrop.closest('details');
      if (details && details.open) return;

      backdrop.style.opacity = '0';
    });
  }

  // Résidus de transition : on efface les styles inline que GSAP a pu laisser sur les
  // conteneurs de page et le header. On ne touche qu'aux styles INLINE — les feuilles de
  // style reprennent immédiatement la main.
  function clearTransitionLeftovers() {
    var targets = [document.body, document.getElementById('MainContent'), document.querySelector('main')]
      .concat(Array.prototype.slice.call(document.querySelectorAll('.section-header, .header-wrapper')))
      .concat(Array.prototype.slice.call(document.body.children));

    targets.forEach(function (el) {
      if (!el || !el.style) return;

      // Un conteneur volontairement laissé à opacity 0 par une animation d'entrée serait
      // repris en main par GSAP à la frame suivante ; effacer l'inline est donc sans risque.
      if (el.style.opacity !== '') el.style.opacity = '';
      if (el.style.pointerEvents !== '') el.style.pointerEvents = '';
      if (el.style.filter !== '') el.style.filter = '';
    });
  }

  function reset(event) {
    closeCartDrawer();
    closeOverlayPanels();
    resetMegaMenuBackdrops();

    // Le grand nettoyage ne s'impose qu'à la restauration depuis le cache : un chargement
    // normal part d'un DOM propre, et on ne veut pas interférer avec l'animation d'entrée.
    if (event && event.persisted) clearTransitionLeftovers();
  }

  window.addEventListener('pageshow', reset);

  // Fermer le tiroir doit aussi emporter les panneaux restés ouverts derrière lui.
  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    if (event.target.closest('.drawer__close, #CartDrawer-Overlay')) {
      closeOverlayPanels();
      resetMegaMenuBackdrops();
    }
  });

  // Un <details> qui se referme emporte son fond sans attendre la fin de l'animation.
  document.addEventListener(
    'toggle',
    function (event) {
      if (!event.target || event.target.tagName !== 'DETAILS' || event.target.open) return;

      var backdrop = event.target.querySelector('.mega-menu__bg');
      if (backdrop) backdrop.style.opacity = '0';
    },
    true
  );
})();
