// Fait alterner les messages de réassurance, un à la fois, à toutes les largeurs.
//
// Le bureau affichait les quatre messages côte à côte sur une seule ligne : trop serré, et la
// ligne se lisait comme un bloc compact plutôt que comme quatre arguments. Un message centré à
// la fois laisse à chacun toute la largeur de la barre.
//
// Rien n'est rendu « actif » par le JS seul : le premier item porte déjà sa classe depuis le
// Liquid, donc la barre reste lisible si ce script ne s'exécute jamais.
class ReassuranceBar extends HTMLElement {
  connectedCallback() {
    this.items = Array.from(this.querySelectorAll('.reassurance-bar__item'));
    if (this.items.length < 2) return;

    this.index = 0;
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.sync = this.sync.bind(this);
    this.advance = this.advance.bind(this);

    this.reduced.addEventListener('change', this.sync);
    document.addEventListener('visibilitychange', this.sync);
    this.sync();
  }

  disconnectedCallback() {
    this.stop();
    if (!this.reduced) return;

    this.reduced.removeEventListener('change', this.sync);
    document.removeEventListener('visibilitychange', this.sync);
  }

  // Le minuteur ne tourne que quand l'alternance peut être vue : pas sur un onglet caché, et
  // pas quand le visiteur a demandé de limiter les animations. Dans ce dernier cas la barre ne
  // reste pas figée sur le premier message pour autant : à partir de 768px, base.css les
  // rétablit tous côte à côte, sans mouvement.
  sync() {
    var shouldRun = !this.reduced.matches && !document.hidden;
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
