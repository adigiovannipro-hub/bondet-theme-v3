// Vignettes produit : la carte suit le sélecteur de coloris.
//
// Le choix lui-même vit dans <variant-swatches>, partagé avec la relance « deuxième paire » du
// panier. Ce fichier ne fait que réagir à ses annonces : `variant:peek` au survol ou sous le
// doigt, `variant:selected` au clic. Il met à jour ce que la carte montre — la photo, le prix,
// et la destination du lien, pour que cliquer la vignette ouvre bien le coloris affiché.
//
// Deux mécanismes du thème sont dans le chemin, et il faut compter avec :
//
// 1. Le composant de carte pose un `click` sur `.product-card` qui fait
//    `window.location.href = card__link.href` quoi qu'on ait cliqué à l'intérieur. C'est
//    <variant-swatches> qui coupe la remontée du clic sur une pastille ; ici on se contente de
//    tenir le `href` à jour, pour que ce handler mène au bon endroit quand il s'applique.
//
// 2. `.card__inner` écoute `mouseenter` et fait avancer le carrousel de la vignette à la vue 2.
//    Changer la `src` de la vue 1 s'appliquerait donc à une vue qui n'est plus affichée : le
//    changement aurait lieu, invisible. La photo du coloris est peinte par-dessus le carrousel,
//    quel que soit son état.
(function () {
  var PREVIEW_CLASS = 'card__swatch-preview';

  // L'image de prévisualisation est créée à la demande, une seule fois par carte, et insérée
  // avant les pastilles de défilement pour rester sous elles.
  function previewOf(card) {
    var media = card.querySelector('.card__media');
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

  function paint(card, src) {
    if (!src) return;

    var preview = previewOf(card);
    if (!preview) return;

    if (preview.dataset.swatchSrc !== src) {
      preview.dataset.swatchSrc = src;
      preview.classList.remove('is-visible');
      // On n'affiche qu'une fois l'image chargée : révéler une image vide fait clignoter la
      // vignette en blanc entre deux coloris.
      preview.onload = function () {
        if (preview.dataset.swatchSrc === src) preview.classList.add('is-visible');
      };
      preview.src = src;
      if (preview.complete && preview.naturalWidth > 0) preview.classList.add('is-visible');
    } else {
      preview.classList.add('is-visible');
    }
  }

  // Le snippet 'price' rend TOUJOURS deux blocs — `.price__regular` et `.price__sale` — et
  // c'est la classe `price--on-sale` qui décide lequel s'affiche. Mettre à jour le seul premier
  // `.price-item--regular` laisserait donc l'ancien montant visible sur un produit en promo.
  function setPrice(card, variant) {
    var block = card.querySelector('.card__link .price') || card.querySelector('.price');
    if (!block) return;

    var short = card.dataset.cardPriceShort === 'true';
    var amount = (short ? variant.priceShort : variant.price) || variant.price;
    var compare = short ? variant.compareShort : variant.compare;

    var sale = block.querySelector('.price__sale');

    block.querySelectorAll('.price-item--regular').forEach(function (item) {
      // Dans le bloc promo, le `--regular` porte le prix barré ; ailleurs, le prix courant.
      var isStruck = sale && sale.contains(item);
      item.textContent = isStruck ? compare || amount : amount;
    });

    block.querySelectorAll('.price-item--sale').forEach(function (item) {
      item.textContent = amount;
    });

    block.classList.toggle('price--on-sale', !!compare);
    block.classList.toggle('price--sold-out', variant.available === false);
  }

  // Toutes les vues du carrousel suivent le coloris retenu. La prévisualisation peinte
  // par-dessus donne le fondu et couvre tous les états du carrousel, mais elle doit pouvoir
  // s'effacer dès que le visiteur fait défiler les vues — sinon le carrousel coulisse dessous,
  // points compris, image immobile : la vignette semble morte. Pour que ce retrait ne fasse
  // pas resurgir l'ancien coloris, la vue 1 est alignée sur le choix au moment où il est fait.
  // Vues supplémentaires réellement propres au coloris de monture.
  //
  // Les galeries de variantes melent deux natures de photos : des vues 3/4 propres a une
  // monture (« solaire-joy-ivoire-quart.jpg ») et des photos d'ambiance generiques, partagees
  // par toutes les montures — sur lesquelles le mannequin porte forcement UNE couleur. Prendre
  // la galerie de la variante telle quelle affichait donc une monture noire alors qu'on venait
  // de choisir l'ivoire. Et le vendeur n'attache la vue 3/4 qu'a UNE combinaison par monture :
  // les autres verres de la meme monture n'ont que l'ambiance.
  //
  // Une photo utilisee par plusieurs montures ne peut pas representer une monture en
  // particulier. On ne garde donc que celles qu'aucune autre monture n'emploie, et on les
  // applique a toutes les variantes de cette monture. Quand il n'en reste aucune, la photo du
  // coloris comble : mieux vaut deux fois la bonne monture qu'une fois la mauvaise.
  function ownViews(picker, variant) {
    if (!picker || !picker.variants || !picker.variants.length) return [];

    if (!picker.ownViews) picker.ownViews = {};
    if (picker.ownViews[variant.o1]) return picker.ownViews[variant.o1];

    var montures = {};
    picker.variants.forEach(function (row) {
      (row.images || []).forEach(function (url) {
        if (!montures[url]) montures[url] = {};
        montures[url][row.o1] = true;
      });
    });

    var views = [];
    picker.variants.forEach(function (row) {
      if (row.o1 !== variant.o1) return;
      (row.images || []).forEach(function (url) {
        if (Object.keys(montures[url]).length > 1) return;
        if (views.indexOf(url) === -1) views.push(url);
      });
    });

    picker.ownViews[variant.o1] = views;
    return views;
  }

  function setSlides(card, variant, picker) {
    var slides = card.querySelectorAll('.card__media .slide');
    var views = ownViews(picker, variant);

    slides.forEach(function (slide, index) {
      var image = slide.querySelector('img');
      if (!image) return;

      var src = index === 0 ? variant.image : views[index - 1];
      if (!src) src = variant.image;
      if (!src || image.getAttribute('src') === src) return;

      // srcset garderait la main sur src : ses déclinaisons sont celles de l'ancienne photo.
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
      image.src = src;
    });
  }

  // Même mécanisme d'observation que card-dots.js : le slider du bundle écrit l'état visible
  // en style inline (opacity 1/0), quelle que soit l'origine du défilement — glissement du
  // doigt ou survol. Dès qu'une autre vue que la première est affichée, la prévisualisation
  // s'efface ; la vue 1 porte déjà le coloris retenu, rien ne ressurgit en revenant.
  function watchSlides(card) {
    if (card.dataset.swatchSlidesBound) return;

    var slider = card.querySelector('.slider');
    if (!slider) return;

    card.dataset.swatchSlidesBound = '1';

    new MutationObserver(function () {
      var slides = card.querySelectorAll('.slide');
      var current = 0;
      var highest = -1;

      slides.forEach(function (slide, index) {
        var inline = parseFloat(slide.style.opacity);
        var opacity = isNaN(inline) ? parseFloat(window.getComputedStyle(slide).opacity) || 0 : inline;
        if (opacity > highest) {
          highest = opacity;
          current = index;
        }
      });

      if (current !== 0) {
        var preview = card.querySelector('.' + PREVIEW_CLASS);
        if (preview) preview.classList.remove('is-visible');
      }
    }).observe(slider, { attributes: true, attributeFilter: ['style'], subtree: true });
  }

  function apply(card, variant, commit, picker) {
    if (!card || !variant) return;

    paint(card, variant.image);

    if (!commit) return;

    setSlides(card, variant, picker);
    watchSlides(card);

    setPrice(card, variant);

    // Le lien de la vignette commande à la fois le titre et le clic sur toute la carte : le
    // faire pointer sur le coloris choisi garde toutes les entrées cohérentes avec ce qu'on voit.
    var link = card.querySelector('.card__link');
    if (link && variant.url) link.setAttribute('href', variant.url);
  }

  function restore(card) {
    if (!card) return;

    var media = card.querySelector('.card__media');
    var preview = media && media.querySelector('.' + PREVIEW_CLASS);
    if (!preview) return;

    // On ne retire la prévisualisation que si elle ne montre pas déjà le coloris retenu : sinon,
    // sortir du nuancier après un clic ferait revenir la photo d'origine, en contradiction avec
    // le prix et le lien qui, eux, ont changé.
    var picker = card.querySelector('variant-swatches');
    var chosen = picker && picker.current;
    if (chosen && chosen.image === preview.dataset.swatchSrc) return;

    preview.classList.remove('is-visible');
  }

  // Délégué depuis `document` : les vignettes apparaissent dans une demi-douzaine de sections,
  // les filtres de collection remplacent la grille entière et le thème navigue en AJAX.
  // Signale au point d'entrée inline (layout/theme.liquid) qu'il peut laisser la mise à jour
  // de la vignette à ce fichier, qui la fait plus finement.
  window.CardSwatchesReady = true;

  document.addEventListener('variant:peek', function (event) {
    var card = event.target.closest('.product-card');
    if (card) apply(card, event.detail.variant, false);
  });

  document.addEventListener('variant:peekend', function (event) {
    var card = event.target.closest('.product-card');
    if (card) restore(card);
  });

  document.addEventListener('variant:selected', function (event) {
    // Le sélecteur annonce aussi son état de départ au chargement. Rien à faire alors : la
    // vignette montre déjà cette variante, et peindre la prévisualisation par-dessus la
    // laisserait posée en permanence.
    if (!event.detail.userInitiated) return;

    var card = event.target.closest('.product-card');
    if (card) apply(card, event.detail.variant, true, event.detail.picker);
  });
})();
