// Pastilles de défilement des vignettes produit.
//
// Le slider des vignettes vit dans le bundle compilé : son instance n'est exposée nulle part,
// et il n'accepte de pagination que sous la forme d'un couple de flèches prev/next. Impossible
// donc de lui demander l'index courant.
//
// En revanche il écrit toujours l'état visible en style inline : onSlideChange() pose
// `opacity: 1` sur la vue affichée et `opacity: 0` sur les autres. C'est cet écrit qu'on
// observe, ce qui suit le défilement quelle qu'en soit l'origine (glissement du doigt,
// survol à la souris) sans rien dupliquer de la logique du slider.
(function () {
  // On lit d'abord le style inline, pas la valeur calculée : pendant la transition d'opacité
  // la valeur calculée est intermédiaire et désignerait la mauvaise vue.
  function slideOpacity(slide) {
    var inline = parseFloat(slide.style.opacity);
    if (!isNaN(inline)) return inline;

    return parseFloat(window.getComputedStyle(slide).opacity) || 0;
  }

  function sync(card) {
    var slides = card.querySelectorAll('.slide');
    var dots = card.querySelectorAll('.card__dot');
    if (!slides.length || dots.length !== slides.length) return;

    var current = 0;
    var highest = -1;

    slides.forEach(function (slide, index) {
      var opacity = slideOpacity(slide);
      if (opacity > highest) {
        highest = opacity;
        current = index;
      }
    });

    dots.forEach(function (dot, index) {
      dot.classList.toggle('is-current', index === current);
    });
  }

  function watch(card) {
    if (card.dataset.cardDotsBound) return;

    var slider = card.querySelector('.slider');
    if (!slider) return;

    card.dataset.cardDotsBound = '1';

    new MutationObserver(function () {
      sync(card);
    }).observe(slider, { attributes: true, attributeFilter: ['style'], subtree: true });

    sync(card);
  }

  function scan() {
    document.querySelectorAll('.product-card').forEach(function (card) {
      if (card.querySelector('.card__dot')) watch(card);
    });
  }

  // Les cartes apparaissent dans une demi-douzaine de sections, les filtres de collection
  // remplacent la grille entière et le thème navigue en AJAX : on ne peut pas se contenter
  // d'un balayage au chargement. Le balayage est groupé sur une frame pour ne pas repasser
  // sur le DOM à chaque mutation d'une page qui s'anime.
  var pending = false;

  function scheduleScan() {
    if (pending) return;

    pending = true;
    window.requestAnimationFrame(function () {
      pending = false;
      scan();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
