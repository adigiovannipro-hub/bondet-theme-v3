// Colour swatches on collection cards.
//
// The theme's card component binds a click handler on the whole card that does
// `window.location.href = card__link.href` for anything outside `.pager`. A swatch click
// therefore bubbled up and navigated to the card's *own* variant — which is why picking a
// colour opened the product on the wrong frame. Propagation is stopped here before it
// reaches that handler.
//
// Delegated from `document` so it survives the collection grid being re-rendered by the
// facets (facets-collection.js replaces .collection-inner wholesale).
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

  document.addEventListener('click', function (event) {
    var swatch = event.target.closest && event.target.closest('[data-card-swatch]');
    if (!swatch) return;

    var card = swatch.closest('.product-card');
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();

    swapImage(card, swatch.dataset.swatchImage);

    // The card link drives both the title link and the theme's whole-card click, so
    // pointing it at the chosen colour keeps every way into the product consistent.
    var cardLink = card.querySelector('.card__link');
    if (cardLink && swatch.getAttribute('href')) cardLink.href = swatch.getAttribute('href');

    card.querySelectorAll('[data-card-swatch]').forEach(function (other) {
      other.classList.toggle('is-current', other === swatch);
    });
  });
})();
