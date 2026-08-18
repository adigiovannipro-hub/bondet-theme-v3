// Sélecteur de coloris partagé : résout la variante, l'annonce, et ne touche à rien d'autre.
//
// Le même moteur sert la relance « deuxième paire » du panier et les vignettes produit. Il ne
// connaît pas son hôte : il tient l'état de la sélection et émet `variant:selected` (au clic),
// `variant:peek` / `variant:peekend` (au survol ou au doigt). C'est l'hôte qui décide quoi en
// faire — changer sa photo, son prix, son lien, activer son bouton d'ajout.
class VariantSwatches extends HTMLElement {
  connectedCallback() {
    var source = this.querySelector('[data-swatch-variants]');
    if (!source) return;

    try {
      this.variants = JSON.parse(source.textContent);
    } catch (e) {
      this.variants = [];
    }
    if (!this.variants.length) return;

    // L'état de départ est celui rendu par Liquid : on le relit dans le DOM plutôt que de le
    // redécider ici, pour que le premier affichage et les suivants ne puissent pas diverger.
    this.selected = [null, null];
    this.querySelectorAll('.swatch-picker__swatch.is-selected').forEach(function (button) {
      var index = parseInt(button.dataset.swatchOptionIndex, 10);
      this.selected[index - 1] = button.dataset.swatchValue;
    }, this);

    this.addEventListener('click', this.onClick.bind(this));
    this.addEventListener('pointerover', this.onPointerOver.bind(this));
    this.addEventListener('pointerout', this.onPointerOut.bind(this));

    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.addEventListener('touchmove', this.onTouchMove, { passive: true });
    this.addEventListener('touchend', this.onTouchEnd, { passive: true });
    this.addEventListener('touchcancel', this.onTouchEnd, { passive: true });

    this.refresh(false);
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

  onClick(event) {
    var swatch = event.target.closest && event.target.closest('.swatch-picker__swatch');
    if (!swatch) return;

    event.preventDefault();
    // La vignette produit pose un `click` sur toute la carte qui redirige vers son propre lien :
    // sans cette coupure, choisir un coloris quitterait la page au lieu de la mettre à jour.
    event.stopPropagation();

    var index = parseInt(swatch.dataset.swatchOptionIndex, 10) - 1;
    this.selected = this.resolve(index, swatch.dataset.swatchValue).selection;
    this.refresh(true);
  }

  onPointerOver(event) {
    var swatch = event.target.closest && event.target.closest('.swatch-picker__swatch');
    if (!swatch) return;

    this.peek(swatch);
  }

  onPointerOut(event) {
    var swatch = event.target.closest && event.target.closest('.swatch-picker__swatch');
    if (!swatch) return;

    // `relatedTarget` est l'élément vers lequel on part : passer d'une pastille à sa voisine ne
    // doit pas rétablir la photo entre les deux, ce qui ferait clignoter l'hôte.
    var going = event.relatedTarget;
    if (going && going.closest && going.closest('.swatch-picker') === this) return;

    this.emit('variant:peekend', this.current);
  }

  // Au doigt il n'y a pas de survol : on suit le point de contact, de sorte que glisser le long
  // de la rangée fasse défiler les coloris.
  onTouchMove(event) {
    var touch = event.touches[0];
    if (!touch) return;

    var under = document.elementFromPoint(touch.clientX, touch.clientY);
    var swatch = under && under.closest && under.closest('.swatch-picker__swatch');
    if (swatch && this.contains(swatch)) this.peek(swatch);
  }

  onTouchEnd(event) {
    var touch = event.changedTouches && event.changedTouches[0];
    var under = touch && document.elementFromPoint(touch.clientX, touch.clientY);
    var swatch = under && under.closest && under.closest('.swatch-picker__swatch');

    // Doigt relevé hors des pastilles : c'était un défilement de page, pas un choix.
    if (!swatch || !this.contains(swatch)) this.emit('variant:peekend', this.current);
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
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

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
