// Nuanciers des vignettes produit : survol (ou doigt) pour prévisualiser une couleur de monture,
// clic pour ouvrir cette couleur-là.
//
// Deux mécanismes du thème sont dans le chemin, et c'est ce qui faisait échouer les versions
// précédentes :
//
// 1. La carte pose un `click` sur `.product-card` qui fait `window.location.href = card__link.href`
//    quoi qu'on ait cliqué à l'intérieur. On l'intercepte en phase de CAPTURE depuis `document` :
//    son écouteur est plus bas dans l'arbre, donc en phase de propagation il passerait avant.
//    En revanche on ne fait PLUS `preventDefault()` : le nuancier est un lien vers sa variante,
//    et c'est justement lui qu'on veut suivre. Avant, cliquer une couleur ne faisait que changer
//    l'image — il fallait re-cliquer sur la carte, puis re-choisir la couleur sur la fiche.
//
// 2. `.card__inner` écoute `mouseenter` et fait avancer le carrousel de la vignette à la vue 1.
//    Dès que la souris est sur la carte, la vue affichée n'est donc plus celle dont on changeait
//    la `src` : le changement de couleur était bien appliqué, simplement invisible. Plutôt que de
//    lutter contre le carrousel, la prévisualisation est peinte par-dessus lui.
(function () {
  var PREVIEW_CLASS = 'card__swatch-preview';

  function mediaOf(card) {
    return card.querySelector('.card__media');
  }

  // L'image de prévisualisation est créée à la demande, une seule fois par carte, et insérée
  // avant les pastilles de défilement pour rester sous elles.
  function previewOf(card) {
    var media = mediaOf(card);
    if (!media) return null;

    var preview = media.querySelector('.' + PREVIEW_CLASS);
    if (preview) return preview;

    preview = document.createElement('img');
    preview.className = PREVIEW_CLASS;
    preview.setAttribute('alt', '');
    preview.setAttribute('aria-hidden', 'true');
    preview.setAttribute('decoding', 'async');

    var dots = media.querySelector('.card__dots');
    if (dots) media.insertBefore(preview, dots);
    else media.appendChild(preview);

    return preview;
  }

  function show(swatch) {
    var card = swatch.closest('.product-card');
    if (!card) return;

    var src = swatch.dataset.swatchImage;
    if (!src) return;

    var preview = previewOf(card);
    if (!preview) return;

    // Mémorise la destination d'origine de la carte au premier survol seulement, pour pouvoir la
    // rendre telle quelle en repartant.
    var link = card.querySelector('.card__link');
    if (link && !link.dataset.swatchHomeHref) link.dataset.swatchHomeHref = link.getAttribute('href') || '';

    if (preview.dataset.swatchSrc !== src) {
      preview.dataset.swatchSrc = src;
      preview.classList.remove('is-visible');
      // On n'affiche qu'une fois l'image décodée : révéler une image vide fait clignoter la
      // vignette en blanc entre deux couleurs.
      preview.onload = function () {
        if (preview.dataset.swatchSrc === src) preview.classList.add('is-visible');
      };
      preview.src = src;
      if (preview.complete && preview.naturalWidth > 0) preview.classList.add('is-visible');
    } else {
      preview.classList.add('is-visible');
    }

    // Toute la carte est cliquable : tant qu'une couleur est prévisualisée, elle mène à cette
    // couleur-là. Sinon on montrerait une monture et on en ouvrirait une autre.
    var href = swatch.getAttribute('href');
    if (link && href) link.setAttribute('href', href);

    card.querySelectorAll('[data-card-swatch]').forEach(function (other) {
      other.classList.toggle('is-preview', other === swatch);
    });
  }

  function hide(card) {
    if (!card) return;

    var media = mediaOf(card);
    var preview = media && media.querySelector('.' + PREVIEW_CLASS);
    if (preview) preview.classList.remove('is-visible');

    var link = card.querySelector('.card__link');
    if (link && link.dataset.swatchHomeHref) link.setAttribute('href', link.dataset.swatchHomeHref);

    card.querySelectorAll('[data-card-swatch].is-preview').forEach(function (other) {
      other.classList.remove('is-preview');
    });
  }

  // Les photos des autres coloris ne sont demandées qu'à l'approche du nuancier : les charger
  // pour toute la grille coûterait des dizaines de requêtes qui ne serviront jamais.
  function preload(list) {
    if (list.dataset.swatchPreloaded) return;

    list.dataset.swatchPreloaded = '1';
    list.querySelectorAll('[data-card-swatch]').forEach(function (swatch) {
      if (!swatch.dataset.swatchImage) return;

      var image = new Image();
      image.src = swatch.dataset.swatchImage;
    });
  }

  document.addEventListener(
    'click',
    function (event) {
      var swatch = event.target.closest && event.target.closest('[data-card-swatch]');
      if (!swatch) return;

      // Seule la remontée est coupée : le lien, lui, doit suivre son href — c'est toute la
      // fonction du nuancier.
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    true
  );

  document.addEventListener('pointerover', function (event) {
    var target = event.target.closest && event.target.closest('[data-card-swatch]');
    if (target) {
      show(target);
      return;
    }

    var list = event.target.closest && event.target.closest('.card__swatches');
    if (list) preload(list);
  });

  document.addEventListener('pointerout', function (event) {
    var swatch = event.target.closest && event.target.closest('[data-card-swatch]');
    if (!swatch) return;

    // `relatedTarget` est l'élément vers lequel on part : passer d'une pastille à sa voisine ne
    // doit pas rétablir la photo d'origine entre les deux, ce qui ferait clignoter la vignette.
    var going = event.relatedTarget;
    if (going && going.closest && going.closest('.card__swatches') === swatch.closest('.card__swatches')) return;

    hide(swatch.closest('.product-card'));
  });

  // Au doigt, il n'y a pas de survol : on suit le point de contact. Glisser le long du nuancier
  // fait défiler les coloris, et c'est en relevant le doigt sur l'un d'eux que le lien s'ouvre.
  document.addEventListener(
    'touchstart',
    function (event) {
      var list = event.target.closest && event.target.closest('.card__swatches');
      if (list) preload(list);
    },
    { passive: true }
  );

  var touchedCard = null;

  document.addEventListener(
    'touchmove',
    function (event) {
      var touch = event.touches[0];
      if (!touch) return;

      var under = document.elementFromPoint(touch.clientX, touch.clientY);
      var swatch = under && under.closest && under.closest('[data-card-swatch]');
      if (!swatch) return;

      touchedCard = swatch.closest('.product-card');
      show(swatch);
    },
    { passive: true }
  );

  // Un doigt qui fait défiler la page peut traverser un nuancier au passage. `pointerout` ne
  // vient pas au secours ici — il n'y a pas de sortie de survol au toucher — donc la vignette
  // resterait sur une couleur qu'on n'a jamais choisie. On la rend à sa photo, sauf si le doigt
  // s'est relevé sur une pastille : c'est une vraie sélection, le lien s'ouvre.
  function endTouch(event) {
    if (!touchedCard) return;

    var touch = event.changedTouches && event.changedTouches[0];
    var under = touch && document.elementFromPoint(touch.clientX, touch.clientY);
    var swatch = under && under.closest && under.closest('[data-card-swatch]');

    if (!swatch) hide(touchedCard);
    touchedCard = null;
  }

  document.addEventListener('touchend', endTouch, { passive: true });
  document.addEventListener('touchcancel', endTouch, { passive: true });
})();
