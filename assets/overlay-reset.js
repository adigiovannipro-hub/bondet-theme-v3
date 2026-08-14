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

  function reset() {
    closeCartDrawer();
    closeStaleDisclosures();
  }

  // `persisted` est vrai uniquement pour une restauration depuis le cache ; on remet à zéro dans
  // les deux cas, un chargement normal partant de toute façon d'un état propre.
  window.addEventListener('pageshow', reset);

  // Fermer le tiroir doit aussi emporter les panneaux restés ouverts derrière lui.
  document.addEventListener('click', function (event) {
    if (!event.target.closest) return;
    if (event.target.closest('.drawer__close, #CartDrawer-Overlay')) closeStaleDisclosures();
  });
})();
