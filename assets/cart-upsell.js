// « Deuxième paire » : sélecteur de variante et ajout au panier, sans quitter le panier.
//
// Chaque diapositive porte sa table de variantes en JSON. Le choix d'une pastille recompose la
// variante à partir des deux options, met à jour photo / prix / lien, et le bouton poste sur
// /cart/add.js en réclamant les sections du tiroir — le même échange que atc-button dans
// cart-drawer.js, donc le même rendu serveur derrière : le bloc disparaît de lui-même dès que la
// deuxième paire est dedans, sans que rien ici n'ait à le savoir.
class CartUpsell extends HTMLElement {
  connectedCallback() {
    this.slides = Array.from(this.querySelectorAll('[data-upsell-slide]'));
    if (!this.slides.length) return;

    this.track = this.querySelector('[data-upsell-track]');
    this.error = this.querySelector('[data-upsell-error]');
    this.prev = this.querySelector('[data-upsell-prev]');
    this.next = this.querySelector('[data-upsell-next]');

    this.slides.forEach((slide) => this.setupSlide(slide));

    this.addEventListener('click', this.onClick.bind(this));

    if (this.track) {
      this.syncNav = this.syncNav.bind(this);
      this.track.addEventListener('scroll', this.syncNav, { passive: true });
      window.addEventListener('resize', this.syncNav);
      this.syncNav();
    }
  }

  disconnectedCallback() {
    if (this.track) {
      this.track.removeEventListener('scroll', this.syncNav);
      window.removeEventListener('resize', this.syncNav);
    }
  }

  setupSlide(slide) {
    const source = slide.querySelector('[data-upsell-variants]');

    try {
      slide.variants = JSON.parse(source.textContent);
    } catch (e) {
      slide.variants = [];
      return;
    }

    // L'état de départ est celui rendu par Liquid : on le relit dans le DOM plutôt que de le
    // redécider ici, pour que le premier affichage et les suivants ne puissent pas diverger.
    slide.selected = [null, null];
    slide.querySelectorAll('.cart-upsell__swatch.is-selected').forEach((button) => {
      const index = parseInt(button.dataset.upsellOptionIndex, 10);
      slide.selected[index - 1] = button.dataset.upsellValue;
    });

    this.refresh(slide);
  }

  onClick(event) {
    const swatch = event.target.closest('.cart-upsell__swatch');
    if (swatch) {
      event.preventDefault();
      this.select(swatch);
      return;
    }

    const add = event.target.closest('[data-upsell-add]');
    if (add) {
      event.preventDefault();
      this.addToCart(add.closest('[data-upsell-slide]'), add);
      return;
    }

    if (this.prev && event.target.closest('[data-upsell-prev]')) this.scrollBy(-1);
    if (this.next && event.target.closest('[data-upsell-next]')) this.scrollBy(1);
  }

  select(button) {
    const slide = button.closest('[data-upsell-slide]');
    if (!slide || !slide.variants) return;

    const index = parseInt(button.dataset.upsellOptionIndex, 10) - 1;
    slide.selected[index] = button.dataset.upsellValue;

    // Le choix qu'on vient de faire est prioritaire : c'est l'autre option qui glisse, jamais
    // celle que le doigt vient de désigner. Le glissement se déclenche aussi bien quand la
    // combinaison n'existe pas que quand elle existe mais est en rupture — sinon désigner une
    // couleur de verre épuisée sur cette monture-là bloquait l'ajout au lieu de proposer la
    // monture voisine qui l'a en stock.
    const exact = this.match(slide, slide.selected);
    if (!exact || !exact.available) {
      const other = index === 0 ? 1 : 0;
      const available = slide.variants.find(
        (variant) => this.valueOf(variant, index) === slide.selected[index] && variant.available
      );
      // Rien de disponible avec cette valeur : on garde la combinaison telle quelle, le bouton
      // affichera « épuisé » plutôt que de renvoyer sur une couleur qu'on n'a pas demandée.
      if (available) slide.selected[other] = this.valueOf(available, other);
    }

    this.refresh(slide);
  }

  valueOf(variant, index) {
    return index === 0 ? variant.o1 : variant.o2;
  }

  match(slide, selection) {
    return slide.variants.find(
      (variant) =>
        variant.o1 === selection[0] && (selection[1] === null || selection[1] === undefined || variant.o2 === selection[1])
    );
  }

  refresh(slide) {
    const variant = this.match(slide, slide.selected) || slide.variants[0];
    if (!variant) return;

    slide.dataset.upsellCurrent = variant.id;

    const image = slide.querySelector('[data-upsell-image]');
    if (image && variant.image) {
      // srcset resterait prioritaire sur la nouvelle src ; il n'y en a pas ici, mais on le retire
      // par sûreté si le thème vient à en poser un.
      image.removeAttribute('srcset');
      image.src = variant.image;
    }

    const price = slide.querySelector('[data-upsell-price]');
    if (price) {
      price.textContent = '';
      if (variant.compare) {
        const compare = document.createElement('s');
        compare.className = 'cart-upsell__compare';
        compare.textContent = variant.compare;
        price.appendChild(compare);
        price.appendChild(document.createTextNode(' '));
      }
      price.appendChild(document.createTextNode(variant.price));
    }

    slide.querySelectorAll('[data-upsell-link]').forEach((link) => {
      if (variant.url) link.href = variant.url;
    });

    slide.querySelectorAll('.cart-upsell__swatch').forEach((button) => {
      const index = parseInt(button.dataset.upsellOptionIndex, 10) - 1;
      const value = button.dataset.upsellValue;
      const isSelected = slide.selected[index] === value;

      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      // Barrée quand elle ne mène à rien d'achetable avec l'autre option retenue — sans être
      // désactivée : la cliquer reste le moyen de faire glisser l'autre option.
      const selection = slide.selected.slice();
      selection[index] = value;
      const candidate = this.match(slide, selection);
      button.classList.toggle('is-unavailable', !candidate || !candidate.available);
    });

    const add = slide.querySelector('[data-upsell-add]');
    const label = slide.querySelector('[data-upsell-add-label]');
    if (add) {
      add.disabled = !variant.available;
      if (label && this.dataset.soldOutLabel && this.dataset.addLabel) {
        label.textContent = variant.available ? this.dataset.addLabel : this.dataset.soldOutLabel;
      }
    }
  }

  addToCart(slide, button) {
    if (!slide || button.classList.contains('is-loading')) return;

    const id = slide.dataset.upsellCurrent;
    if (!id) return;

    button.classList.add('is-loading');
    button.disabled = true;
    this.showError('');

    const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        items: [{ id: id, quantity: 1 }],
        sections: ['cart-drawer', 'cart-icon-bubble'],
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        // Shopify répond 422 avec un corps `{status, message, description}` quand la ligne est
        // refusée (rupture, règle de quantité) : sans ce test on rejouerait un rendu vide.
        if (data.status) {
          this.showError(data.description || data.message);
          button.classList.remove('is-loading');
          button.disabled = false;
          return;
        }

        document.documentElement.dispatchEvent(
          new CustomEvent('cart:rerender', { detail: data, bubbles: true })
        );
      })
      .catch(() => {
        this.showError(this.dataset.errorLabel || '');
        button.classList.remove('is-loading');
        button.disabled = false;
      });
  }

  showError(message) {
    if (!this.error) return;

    this.error.textContent = message || '';
    this.error.hidden = !message;
  }

  scrollBy(direction) {
    if (!this.track) return;

    const slide = this.slides[0];
    const step = slide ? slide.getBoundingClientRect().width + 12 : this.track.clientWidth;
    this.track.scrollBy({ left: step * direction, behavior: 'smooth' });
  }

  syncNav() {
    if (!this.track || !this.prev || !this.next) return;

    // 2px de marge : les navigateurs arrondissent scrollLeft, et une extrémité atteinte peut
    // rester à une fraction de pixel de la valeur théorique.
    const max = this.track.scrollWidth - this.track.clientWidth;
    const overflows = max > 2;

    this.prev.hidden = !overflows || this.track.scrollLeft <= 2;
    this.next.hidden = !overflows || this.track.scrollLeft >= max - 2;
  }
}

customElements.define('cart-upsell', CartUpsell);
