// Fait alterner les messages de réassurance, un à la fois, à toutes les largeurs.
//
// Le bureau affichait les quatre messages côte à côte sur une seule ligne : trop serré, et la
// ligne se lisait comme un bloc compact plutôt que comme quatre arguments. Un message centré à
// la fois laisse à chacun toute la largeur de la barre.
//
// Rien n'est rendu « actif » par le JS seul : le premier item porte déjà sa classe depuis le
// Liquid, donc la barre reste lisible si ce script ne s'exécute jamais.
//
// Le tout est enfermé et gardé parce que la balise <script> vit dans la section : l'éditeur de
// thème réinjecte celle-ci à chaque modification, ce qui réexécute le fichier. Une `class` au
// premier niveau lèverait alors « already been declared », et le bandeau resterait figé le
// temps de l'édition. Une définition suffit : les éléments rendus ensuite sont promus seuls.
(function () {
  if (customElements.get('reassurance-bar')) return;

  class ReassuranceBar extends HTMLElement {
    connectedCallback() {
      this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

      if (this.classList.contains('reassurance-bar--scroll')) {
        this.setupScroll();
        return;
      }

      this.items = Array.from(this.querySelectorAll('.reassurance-bar__item'));
      if (this.items.length < 2) return;

      this.index = 0;

      this.sync = this.sync.bind(this);
      this.advance = this.advance.bind(this);

      this.reduced.addEventListener('change', this.sync);
      document.addEventListener('visibilitychange', this.sync);
      this.sync();
    }

    disconnectedCallback() {
      this.stop();
      if (!this.reduced) return;

      if (this.layout) {
        this.reduced.removeEventListener('change', this.layout);
        window.removeEventListener('resize', this.layout);
        if (this.observer) this.observer.disconnect();
        return;
      }

      this.reduced.removeEventListener('change', this.sync);
      document.removeEventListener('visibilitychange', this.sync);
    }

    // ── Défilement continu ────────────────────────────────────────────────────────────────────
    //
    // La piste est faite de copies d'un même groupe, et l'animation la décale d'exactement une
    // largeur de groupe : au bout du compte, l'image est identique à celle du départ, la boucle
    // ne se voit pas. Le décalage est mesuré, jamais deviné — un pourcentage ou une valeur en dur
    // laisserait un saut dès que la largeur du texte change (police chargée, autre langue).
    //
    // Le nombre de copies vient de la largeur disponible : il en faut assez pour qu'au moment où
    // la piste est décalée d'un groupe, la fenêtre soit encore entièrement couverte.
    setupScroll() {
      this.viewport = this.querySelector('.reassurance-bar__viewport');
      this.marquee = this.querySelector('.reassurance-bar__marquee');
      this.group = this.querySelector('.reassurance-bar__group');
      if (!this.viewport || !this.marquee || !this.group) return;

      this.layout = this.layout.bind(this);
      this.reduced.addEventListener('change', this.layout);

      // La largeur du groupe dépend de la police : mesurée trop tôt, elle est celle de la police
      // de repli, et la boucle sauterait une fois la vraie police posée.
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(this.layout);

      if (window.ResizeObserver) {
        this.observer = new ResizeObserver(this.layout);
        this.observer.observe(this.viewport);
      } else {
        window.addEventListener('resize', this.layout);
      }

      this.layout();
    }

    layout() {
      // On repart toujours de l'état rendu par le Liquid : un seul groupe, aucune animation.
      // Recalculer par-dessus les copies précédentes ferait grossir la piste à chaque appel.
      var clones = this.marquee.querySelectorAll('[data-marquee-clone]');
      for (var i = 0; i < clones.length; i++) clones[i].remove();
      this.classList.remove('is-scrolling');

      if (this.reduced.matches) return;

      var width = this.group.getBoundingClientRect().width;
      var room = this.viewport.getBoundingClientRect().width;
      if (!width || !room) return;

      var copies = Math.ceil(room / width) + 1;
      for (var c = 0; c < copies; c++) {
        var clone = this.group.cloneNode(true);
        clone.setAttribute('data-marquee-clone', '');
        // Le lecteur d'écran n'annonce que l'exemplaire d'origine : les copies ne sont là que
        // pour que la bande ne se vide jamais.
        clone.setAttribute('aria-hidden', 'true');
        this.marquee.appendChild(clone);
      }

      var speed = parseFloat(this.dataset.scrollSpeed) || 60;
      this.marquee.style.setProperty('--marquee-shift', width + 'px');
      this.marquee.style.setProperty('--marquee-duration', width / speed + 's');
      this.classList.add('is-scrolling');
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
})();
