// Rotates the reassurance messages, on mobile only: from 768px every message is already
// visible on one line (see .reassurance-bar in base.css), so rotating there would be pure
// noise. Nothing is rendered as "active" by JS alone — the first item is already marked in
// Liquid, so the bar reads correctly if this script never runs.
class ReassuranceBar extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.reassurance-bar__item'));
    if (this.items.length < 2) return;

    this.index = 0;
    this.mobile = window.matchMedia('(max-width: 767px)');
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.sync = this.sync.bind(this);
    this.advance = this.advance.bind(this);

    this.mobile.addEventListener('change', this.sync);
    document.addEventListener('visibilitychange', this.sync);
    this.sync();
  }

  disconnectedCallback() {
    this.stop();
    this.mobile.removeEventListener('change', this.sync);
    document.removeEventListener('visibilitychange', this.sync);
  }

  // Only run the timer when it can actually be seen: not on desktop, not on a hidden tab,
  // and not when the visitor asked for reduced motion.
  sync() {
    var shouldRun = this.mobile.matches && !this.reduced.matches && !document.hidden;
    if (shouldRun) this.start();
    else this.stop();
  }

  start() {
    if (this.timer) return;

    var seconds = parseFloat(this.dataset.rotateSpeed) || 4;
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

customElements.define('reassurance-bar', ReassuranceBar);
