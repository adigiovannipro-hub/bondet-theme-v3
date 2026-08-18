// « Deuxième paire » : carrousel et ajout au panier, sans quitter le panier.
//
// Le choix du coloris n'est plus géré ici : il vit dans <variant-swatches>, partagé avec les
// vignettes produit (snippets/variant-swatches.liquid). Ce fichier écoute son annonce
// `variant:selected` et se contente de suivre — photo, prix, lien, bouton — puis poste sur
// /cart/add.js en réclamant les sections du tiroir, le même échange que atc-button dans
// cart-drawer.js. Le tiroir se re-rend donc côté serveur et le bloc se retire de lui-même dès
// que la deuxième paire est dedans, sans que rien ici n'ait à le savoir.
class CartUpsell extends HTMLElement {
  connectedCallback() {
    this.slides = Array.from(this.querySelectorAll('[data-upsell-slide]'));
    if (!this.slides.length) return;

    this.track = this.querySelector('[data-upsell-track]');
    this.error = this.querySelector('[data-upsell-error]');
    this.prev = this.querySelector('[data-upsell-prev]');
    this.next = this.querySelector('[data-upsell-next]');

    this.addEventListener('variant:selected', this.onVariantSelected.bind(this));
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

  onVariantSelected(event) {
    var slide = event.target.closest('[data-upsell-slide]');
    if (slide) this.apply(slide, event.detail.variant);
  }

  apply(slide, variant) {
    if (!variant) return;

    slide.dataset.upsellCurrent = variant.id;

    var image = slide.querySelector('[data-upsell-image]');
    if (image && variant.image) {
      // srcset resterait prioritaire sur la nouvelle src ; il n'y en a pas ici, mais on le retire
      // par sûreté si le thème vient à en poser un.
      image.removeAttribute('srcset');
      image.src = variant.image;
    }

    var price = slide.querySelector('[data-upsell-price]');
    if (price) {
      price.textContent = '';
      if (variant.compare) {
        var compare = document.createElement('s');
        compare.className = 'cart-upsell__compare';
        compare.textContent = variant.compare;
        price.appendChild(compare);
        price.appendChild(document.createTextNode(' '));
      }
      price.appendChild(document.createTextNode(variant.price));
    }

    slide.querySelectorAll('[data-upsell-link]').forEach(function (link) {
      if (variant.url) link.href = variant.url;
    });

    var add = slide.querySelector('[data-upsell-add]');
    var label = slide.querySelector('[data-upsell-add-label]');
    if (add) {
      add.disabled = !variant.available;
      if (label && this.dataset.soldOutLabel && this.dataset.addLabel) {
        label.textContent = variant.available ? this.dataset.addLabel : this.dataset.soldOutLabel;
      }
    }
  }

  onClick(event) {
    var add = event.target.closest('[data-upsell-add]');
    if (add) {
      event.preventDefault();
      this.addToCart(add.closest('[data-upsell-slide]'), add);
      return;
    }

    if (this.prev && event.target.closest('[data-upsell-prev]')) this.scrollBy(-1);
    if (this.next && event.target.closest('[data-upsell-next]')) this.scrollBy(1);
  }

  addToCart(slide, button) {
    if (!slide || button.classList.contains('is-loading')) return;

    var id = slide.dataset.upsellCurrent;
    if (!id) return;

    button.classList.add('is-loading');
    button.disabled = true;
    this.showError('');

    var root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    var self = this;

    fetch(root + 'cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        items: [{ id: id, quantity: 1 }],
        sections: ['cart-drawer', 'cart-icon-bubble'],
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        // Shopify répond 422 avec un corps `{status, message, description}` quand la ligne est
        // refusée (rupture, règle de quantité) : sans ce test on rejouerait un rendu vide.
        if (data.status) {
          self.showError(data.description || data.message);
          button.classList.remove('is-loading');
          button.disabled = false;
          return;
        }

        document.documentElement.dispatchEvent(
          new CustomEvent('cart:rerender', { detail: data, bubbles: true })
        );
      })
      .catch(function () {
        self.showError(self.dataset.errorLabel || '');
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

    var slide = this.slides[0];
    var step = slide ? slide.getBoundingClientRect().width + 12 : this.track.clientWidth;
    this.track.scrollBy({ left: step * direction, behavior: 'smooth' });
  }

  syncNav() {
    if (!this.track || !this.prev || !this.next) return;

    // 2px de marge : les navigateurs arrondissent scrollLeft, et une extrémité atteinte peut
    // rester à une fraction de pixel de la valeur théorique.
    var max = this.track.scrollWidth - this.track.clientWidth;
    var overflows = max > 2;

    this.prev.hidden = !overflows || this.track.scrollLeft <= 2;
    this.next.hidden = !overflows || this.track.scrollLeft >= max - 2;
  }
}

customElements.define('cart-upsell', CartUpsell);
