// Rotates the testimonials shown at the top of the cart drawer.
//
// The first item is already marked active in Liquid, so the strip reads correctly if this
// never runs. The timer only ticks while the drawer is actually open — a cart drawer spends
// most of its life closed, and rotating a hidden strip is wasted work.
class CartTestimonials extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.cart-testimonials__item'));
    if (this.items.length < 2) return;

    this.index = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.advance = this.advance.bind(this);
    this.sync = this.sync.bind(this);

    this.drawer = this.closest('cart-drawer');
    if (this.drawer && window.MutationObserver) {
      this.observer = new MutationObserver(this.sync);
      this.observer.observe(this.drawer, { attributes: true, attributeFilter: ['class'] });
    }

    document.addEventListener('visibilitychange', this.sync);
    this.sync();
  }

  disconnectedCallback() {
    this.stop();
    if (this.observer) this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.sync);
  }

  sync() {
    var drawerOpen = !this.drawer || this.drawer.classList.contains('active');
    if (drawerOpen && !this.reduced.matches && !document.hidden) this.start();
    else this.stop();
  }

  start() {
    if (this.timer) return;

    var seconds = parseFloat(this.dataset.rotateSpeed) || 5;
    this.timer = setInterval(this.advance, seconds * 1000);
  }

  stop() {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = null;
  }

  advance() {
    this.items[this.index].classList.remove('is-active');
    this.index = (this.index + 1) % this.items.length;
    this.items[this.index].classList.add('is-active');
  }
}

customElements.define('cart-testimonials', CartTestimonials);
