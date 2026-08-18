// Sélecteur de coloris partagé : résout la variante, l'annonce, et ne touche à rien d'autre.
//
// Le même moteur sert la relance « deuxième paire » du panier et les vignettes produit. Il ne
// connaît pas son hôte : il tient l'état de la sélection et émet `variant:selected` (au clic),
// `variant:peek` / `variant:peekend` (au survol ou au doigt). C'est l'hôte qui décide quoi en
// faire — changer sa photo, son prix, son lien, activer son bouton d'ajout.
//
// Tout est délégué depuis `document` en phase de CAPTURE, et non posé sur l'élément lui-même :
//
// - Le composant de carte du thème pose un `click` sur `.product-card` qui redirige vers le lien
//   de la vignette quoi qu'on ait cliqué dedans. En capture depuis `document`, on passe avant
//   lui quel que soit l'ordre de chargement.
// - Surtout, cela ne dépend plus du moment où l'élément personnalisé est « promu ». Une grille
//   re-rendue par les filtres, un `connectedCallback` qui tomberait avant que ses enfants soient
//   analysés : dans tous ces cas l'initialisation se rattrape au premier geste.
//
// Et si le script ne tournait pas du tout, les pastilles des vignettes restent des liens vers
// leur variante (swatch_links) : le clic ouvre la fiche sur le bon coloris. C'est le repli.
class VariantSwatches extends HTMLElement {
  connectedCallback() {
    this.setup();
  }

  // Idempotent, et rejouable : renvoie true quand la table des variantes est exploitable.
  setup() {
    if (this.variants && this.variants.length) return true;

    var source = this.querySelector('[data-swatch-variants]');
    if (!source) return false;

    try {
      this.variants = JSON.parse(source.textContent);
    } catch (e) {
      this.variants = [];
    }
    if (!this.variants.length) return false;

    // L'état de départ est celui rendu par Liquid : on le relit dans le DOM plutôt que de le
    // redécider ici, pour que le premier affichage et les suivants ne puissent pas diverger.
    this.selected = [null, null];
    this.querySelectorAll('.swatch-picker__swatch.is-selected').forEach(function (button) {
      var index = parseInt(button.dataset.swatchOptionIndex, 10);
      this.selected[index - 1] = button.dataset.swatchValue;
    }, this);

    this.refresh(false);
    return true;
  }

  get current() {
    return this.match(this.selected) || this.variants[0];
  }

  valueOf(variant, index) {
    return index === 0 ? variant.o1 : variant.o2;
  }

  match(selection) {
    return this.variants.find(function (variant) {
      var secondMatches = selection[1] === null || selection[1] === undefined || variant.o2 === selection[1];
      return variant.o1 === selection[0] && secondMatches;
    });
  }

  // Variante qu'on obtiendrait en imposant `value` à l'option `index`, l'autre option glissant
  // si besoin. Sert au clic comme au survol, pour que la prévisualisation montre exactement ce
  // que le clic donnerait.
  resolve(index, value) {
    var selection = this.selected.slice();
    selection[index] = value;

    var exact = this.match(selection);
    if (exact && exact.available) return { selection: selection, variant: exact };

    // Le choix qu'on vient de faire est prioritaire : c'est l'autre option qui glisse, jamais
    // celle que le doigt vient de désigner. Le glissement se déclenche aussi bien quand la
    // combinaison n'existe pas que quand elle existe mais est en rupture.
    var other = index === 0 ? 1 : 0;
    var available = this.variants.find(function (variant) {
      return this.valueOf(variant, index) === value && variant.available;
    }, this);

    if (available) {
      selection[other] = this.valueOf(available, other);
      return { selection: selection, variant: available };
    }

    // Rien de disponible avec cette valeur : on garde la combinaison telle quelle, l'hôte
    // affichera « épuisé » plutôt que de basculer sur un coloris qu'on n'a pas demandé.
    return { selection: selection, variant: exact || this.variants[0] };
  }

  select(swatch) {
    var index = parseInt(swatch.dataset.swatchOptionIndex, 10) - 1;
    this.selected = this.resolve(index, swatch.dataset.swatchValue).selection;
    this.refresh(true);
  }

  peek(swatch) {
    var index = parseInt(swatch.dataset.swatchOptionIndex, 10) - 1;
    var variant = this.resolve(index, swatch.dataset.swatchValue).variant;
    if (variant) this.emit('variant:peek', variant);
  }

  refresh(announce) {
    var current = this.current;
    if (!current) return;

    this.dataset.currentVariant = current.id;

    this.querySelectorAll('.swatch-picker__swatch').forEach(function (button) {
      var index = parseInt(button.dataset.swatchOptionIndex, 10) - 1;
      var value = button.dataset.swatchValue;
      var isSelected = this.selected[index] === value;

      button.classList.toggle('is-selected', isSelected);
      if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      // Atténuée quand cette valeur ne donne rien d'achetable AVEC L'AUTRE OPTION RETENUE —
      // donc `match`, sans le glissement de `resolve`, qui trouverait toujours une combinaison
      // disponible ailleurs et n'atténuerait jamais rien. La pastille reste cliquable : c'est
      // ainsi qu'on fait glisser l'autre option vers elle.
      var selection = this.selected.slice();
      selection[index] = value;
      var candidate = this.match(selection);
      button.classList.toggle('is-unavailable', !candidate || !candidate.available);
    }, this);

    this.emit('variant:selected', current, announce);
  }

  emit(name, variant, announce) {
    this.dispatchEvent(
      new CustomEvent(name, {
        bubbles: true,
        detail: { variant: variant, picker: this, userInitiated: announce === true },
      })
    );
  }
}

customElements.define('variant-swatches', VariantSwatches);

(function () {
  function swatchAt(target) {
    return target && target.closest ? target.closest('.swatch-picker__swatch') : null;
  }

  // Hôte prêt à répondre, initialisé à la volée si sa promotion n'a pas eu lieu ou a échoué.
  function pickerFor(swatch) {
    var picker = swatch.closest('variant-swatches');
    if (!picker) return null;

    if (typeof picker.setup !== 'function') {
      // L'élément n'a pas encore été promu (script chargé après ce nœud, grille re-rendue…) :
      // on force la promotion, puis on réessaie.
      if (window.customElements && customElements.upgrade) customElements.upgrade(picker);
      if (typeof picker.setup !== 'function') return null;
    }

    return picker.setup() ? picker : null;
  }

  document.addEventListener(
    'click',
    function (event) {
      var swatch = swatchAt(event.target);
      if (!swatch) return;

      var picker = pickerFor(swatch);
      // Sans table exploitable on ne fait rien : la pastille est un lien sur les vignettes, sa
      // destination reste le bon repli.
      if (!picker) return;

      event.preventDefault();
      // Le composant de carte du thème redirige au moindre clic dans la vignette : il ne doit
      // pas voir celui-ci.
      event.stopPropagation();

      picker.select(swatch);
    },
    true
  );

  document.addEventListener('pointerover', function (event) {
    var swatch = swatchAt(event.target);
    if (!swatch) return;

    var picker = pickerFor(swatch);
    if (picker) picker.peek(swatch);
  });

  document.addEventListener('pointerout', function (event) {
    var swatch = swatchAt(event.target);
    if (!swatch) return;

    // `relatedTarget` est l'élément vers lequel on part : passer d'une pastille à sa voisine ne
    // doit pas rétablir la photo entre les deux, ce qui ferait clignoter l'hôte.
    var picker = swatch.closest('variant-swatches');
    var going = event.relatedTarget;
    if (going && going.closest && going.closest('variant-swatches') === picker) return;
    if (picker && picker.variants) picker.emit('variant:peekend', picker.current);
  });

  // Au doigt il n'y a pas de survol : on suit le point de contact, de sorte que glisser le long
  // de la rangée fasse défiler les coloris.
  document.addEventListener(
    'touchmove',
    function (event) {
      var touch = event.touches[0];
      if (!touch) return;

      var swatch = swatchAt(document.elementFromPoint(touch.clientX, touch.clientY));
      if (!swatch) return;

      var picker = pickerFor(swatch);
      if (picker) picker.peek(swatch);
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    function (event) {
      var touch = event.changedTouches && event.changedTouches[0];
      var swatch = touch ? swatchAt(document.elementFromPoint(touch.clientX, touch.clientY)) : null;
      if (swatch) return;

      // Doigt relevé hors des pastilles : c'était un défilement de page, pas un choix.
      document.querySelectorAll('variant-swatches').forEach(function (picker) {
        if (picker.variants) picker.emit('variant:peekend', picker.current);
      });
    },
    { passive: true }
  );
})();
