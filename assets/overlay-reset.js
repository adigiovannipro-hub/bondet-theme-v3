// Remet à zéro les calques plein écran qui peuvent survivre à une navigation.
//
// Deux cas observés :
//
// 1. Retour arrière. Safari restaure la page depuis son cache (bfcache) telle qu'elle était,
//    tiroir panier compris. Un tiroir restauré avec `.active` réaffiche son fond
//    `rgba(brun, .5)` sur toute la fenêtre et capte tous les clics, alors que son panneau peut
//    rester hors écran parce que la transition `transform` est figée dans un état intermédiaire.
//    Résultat : la page paraît ternie et le header ne répond plus.
//
// 2. Panneaux « disclosure » (couleurs sur la page produit, filtres sur les collections). Le
//    thème sort le panneau de l'écran en retirant `menu-opening`, mais c'est l'attribut `open`
//    du <details> qui commande le voile. Si `open` n'est pas retiré, le voile survit.
//
// Le CSS neutralise déjà l'apparence de ces voiles ; ici on remet l'état DOM d'aplomb, pour que
// plus rien ne reste interactif.
(function () {
  function closeCartDrawer() {
    document.querySelectorAll('cart-drawer').forEach(function (drawer) {
      drawer.classList.remove('active', 'animate');
    });
    document.body.classList.remove('overflow-hidden');
  }

  function closeStaleDisclosures() {
    document.querySelectorAll('details.disclosure-has-popup[open]').forEach(function (details) {
      // `menu-opening` marque un panneau réellement ouvert : on ne ferme que les résidus.
      if (details.classList.contains('menu-opening')) return;

      details.removeAttribute('open');
    });
  }

  // Le fond des méga-menus est animé par GSAP, qui écrit `opacity` en style inline. Si la
  // séquence de fermeture ne va pas au bout, ou si la page est restaurée depuis le cache avec le
  // style encore posé, ce fond brun reste à 0.8 — en `z-index: -1`, donc DERRIÈRE le contenu :
  // le texte reste parfaitement lisible et seuls les fonds de section sont ternis, ce qui rend
  // le voile difficile à rattacher à sa cause.
  function resetMegaMenuBackdrops() {
    document.querySelectorAll('.mega-menu__bg').forEach(function (backdrop) {
      var open = backdrop.closest('details');
      if (open && open.open) return;

      backdrop.style.opacity = '0';
    });
  }

  function reset() {
    closeCartDrawer();
    closeStaleDisclosures();
    resetMegaMenuBackdrops();
  }

  // `persisted` est vrai uniquement pour une restauration depuis le cache ; on remet à zéro dans
  // les deux cas, un chargement normal partant de toute façon d'un état propre.
  window.addEventListener('pageshow', reset);

  // Fermer le tiroir doit aussi emporter les panneaux restés ouverts derrière lui.
  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    if (event.target.closest('.drawer__close, #CartDrawer-Overlay')) {
      closeStaleDisclosures();
      resetMegaMenuBackdrops();
    }
  });

  // Un <details> qui se referme doit emporter son fond, sans attendre la fin de l'animation.
  document.addEventListener(
    'toggle',
    function (event) {
      if (event.target.tagName !== 'DETAILS' || event.target.open) return;

      var backdrop = event.target.querySelector('.mega-menu__bg');
      if (backdrop) backdrop.style.opacity = '0';
    },
    true
  );
})();
