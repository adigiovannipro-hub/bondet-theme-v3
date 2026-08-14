// Verrou CGV : aucun passage en caisse sans consentement.
//
// Le bouton de paiement était auparavant `disabled` tant que la case n'était pas cochée, ce qui
// ne donnait aucun retour au toucher — il se lisait comme un bouton cassé. Le bouton reste donc
// actif et c'est l'envoi du formulaire qui est bloqué, avec un message explicite.
//
// Deux emplacements à couvrir, le tiroir panier et la page /cart, chacun avec son formulaire.
// Le rattachement se fait par `data-cgv-form`, qui porte l'id du formulaire gardé, et non par
// des identifiants en dur.
//
// Tout est délégué depuis `document` : le contenu du tiroir est remplacé en entier à chaque mise
// à jour du panier, ce qui emporterait des écouteurs posés sur les éléments eux-mêmes.
(function () {
  function wrapperForForm(form) {
    if (!form || !form.id) return null;

    // Un seul bloc CGV par formulaire ; on le retrouve par l'id qu'il déclare garder.
    var wrappers = document.querySelectorAll('[data-cart-cgv][data-cgv-form]');

    for (var i = 0; i < wrappers.length; i++) {
      if (wrappers[i].getAttribute('data-cgv-form') === form.id) return wrappers[i];
    }

    return null;
  }

  function partsFor(wrapper) {
    var checkbox = wrapper.querySelector('[data-cgv-checkbox]');
    if (!checkbox) return null;

    return {
      wrapper: wrapper,
      checkbox: checkbox,
      error: wrapper.querySelector('[data-cgv-error]'),
      timestamp: wrapper.querySelector('[data-cgv-timestamp]'),
    };
  }

  function setError(parts, visible) {
    if (parts.error) parts.error.hidden = !visible;
    parts.wrapper.classList.toggle('cart-cgv--error', visible);
    parts.checkbox.setAttribute('aria-invalid', visible ? 'true' : 'false');
  }

  document.addEventListener('change', function (event) {
    var checkbox = event.target;
    if (!checkbox || !checkbox.hasAttribute || !checkbox.hasAttribute('data-cgv-checkbox')) return;

    var wrapper = checkbox.closest('[data-cart-cgv]');
    if (!wrapper) return;

    var parts = partsFor(wrapper);
    if (!parts) return;

    if (parts.checkbox.checked) setError(parts, false);

    // Trace de l'acceptation, transmise en attribut de commande avec le panier.
    if (parts.timestamp) {
      parts.timestamp.value = parts.checkbox.checked ? new Date().toLocaleString('fr-FR') : '';
    }
  });

  function refuse(parts) {
    setError(parts, true);

    if (parts.wrapper.scrollIntoView) {
      parts.wrapper.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    parts.checkbox.focus({ preventScroll: true });
  }

  // La case porte `required`, donc c'est le navigateur qui bloque l'envoi, et il le fait AVANT
  // d'émettre `submit` : un verrou posé uniquement sur `submit` ne se déclenchait jamais et son
  // message restait lettre morte. On écoute donc `invalid`, et le preventDefault y remplace
  // l'infobulle native — illisible sur mobile et hors charte — par notre message.
  //
  // `required` est conservé à dessein : il bloque même si ce script ne se charge pas.
  document.addEventListener(
    'invalid',
    function (event) {
      var checkbox = event.target;
      if (!checkbox || !checkbox.hasAttribute || !checkbox.hasAttribute('data-cgv-checkbox')) return;

      var wrapper = checkbox.closest('[data-cart-cgv]');
      if (!wrapper) return;

      var parts = partsFor(wrapper);
      if (!parts) return;

      event.preventDefault();
      refuse(parts);
    },
    true
  );

  // Filet pour les envois qui échappent à la validation natale du navigateur : un bouton en
  // `formnovalidate`, ou un formulaire envoyé depuis le JS du thème. Phase de capture pour
  // passer avant tout autre gestionnaire.
  document.addEventListener(
    'submit',
    function (event) {
      var wrapper = wrapperForForm(event.target);
      if (!wrapper) return;

      var parts = partsFor(wrapper);
      if (!parts || parts.checkbox.checked) return;

      event.preventDefault();
      refuse(parts);
    },
    true
  );
})();
