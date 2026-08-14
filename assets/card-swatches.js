// Colour swatches on collection cards.
//
// The theme's card component binds a click handler on the whole card that does
// `window.location.href = card__link.href` for anything outside `.pager`. A swatch click
// therefore bubbled up and navigated to the card's *own* variant — which is why picking a
// colour opened the product on the wrong frame. Propagation is stopped here before it
// reaches that handler.
//
// Delegated from `document` in the CAPTURE phase, and c'est le point crucial : le handler du
// thème est posé sur la carte elle-même, donc plus bas dans l'arbre. En phase de propagation
// (bubble) il s'exécute AVANT un écouteur sur `document` — `stopPropagation()` arrivait trop
// tard, la navigation avait déjà eu lieu. En capture, l'ordre est inversé : document d'abord.
//
// La délégation permet aussi de survivre au re-rendu complet de la grille par les filtres
// (facets-collection.js remplace .collection-inner).
(function () {
  function swapImage(card, src) {
    if (!src) return;

    var image = card.querySelector('.main-media img') || card.querySelector('.card__media img');
    if (!image) return;

    // srcset would keep winning over the new src, so it is dropped for the swapped image.
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
    image.src = src;
  }

  document.addEventListener(
    'click',
    function (event) {
      var swatch = event.target.closest && event.target.closest('[data-card-swatch]');
      if (!swatch) return;

      var card = swatch.closest('.product-card');
      if (!card) return;

      // preventDefault ne suffit pas : le thème ne se sert pas de l'action par défaut du lien,
      // il affecte window.location.href directement. Il faut l'empêcher d'être notifié.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      swapImage(card, swatch.dataset.swatchImage);

      // Le lien de la carte commande à la fois le titre et le clic sur toute la carte : le faire
      // pointer sur la couleur choisie garde toutes les entrées vers le produit cohérentes.
      var cardLink = card.querySelector('.card__link');
      if (cardLink && swatch.getAttribute('href')) cardLink.href = swatch.getAttribute('href');

      card.querySelectorAll('[data-card-swatch]').forEach(function (other) {
        other.classList.toggle('is-current', other === swatch);
      });
    },
    true
  );
})();
