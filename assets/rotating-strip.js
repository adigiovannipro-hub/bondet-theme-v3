// Bandeau qui montre un élément à la fois.
//
// Le premier est déjà marqué actif par Liquid : sans ce script le bandeau reste lisible, il ne
// défile simplement pas. Le minuteur ne tourne que si le bandeau est visible — dans le tiroir
// panier, c'est-à-dire seulement quand le tiroir est ouvert : faire défiler un bandeau caché
// est du travail perdu.
class RotatingStrip extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('[data-rotate-item]'));
    if (this.items.length < 2) return;

    this.index = Math.max(0, this.items.indexOf(this.querySelector('.is-active')));
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.advance = this.advance.bind(this);
    this.sync = this.sync.bind(this);

    var drawer = this.closest('cart-drawer');
    if (drawer && window.MutationObserver) {
      this.observer = new MutationObserver(this.sync);
      this.observer.observe(drawer, { attributes: true, attributeFilter: ['class'] });
      this.drawer = drawer;
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
    var open = !this.drawer || this.drawer.classList.contains('active');
    if (open && !this.reduced.matches && !document.hidden) this.start();
    else this.stop();
  }

  start() {
    if (this.timer) return;

    var seconds = parseFloat(this.dataset.rotateSpeed) || 3.5;
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

customElements.define('rotating-strip', RotatingStrip);
