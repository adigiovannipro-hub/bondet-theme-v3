class FacetsCollection extends HTMLElement {
  constructor() {
    super();

    this.isLoading = false;
  }

  get sectionId() {
    return this.dataset.sectionId;
  }

  connectedCallback() {
    this.filterInputs = this.querySelectorAll('input');
    this.handleClick = this.handleClick.bind(this);
    this.details = Array.from(this.querySelectorAll('.collections-details'));

    this.filterInputs.forEach(input => {
      input.addEventListener('click', this.handleClick);
    });
  }

  handleClick(event) {
    if (this.isLoading) return;

    this.isLoading = true;
    this.classList.add('is-loading');

    const input = event.currentTarget;
    const url = new URL(input.checked ? input.dataset.addUrl : input.dataset.removeUrl, window.location.origin);

    url.searchParams.set('section_id', this.sectionId);

    fetch(url.toString())
      .then((response) => {
        return response.text();
      })
      .then((html) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const openDetails = this.details.map((value, index) => {
          return value.classList.contains('menu-opening') ? index : null;
        }).filter((index) => index !== null);

        openDetails.forEach((index) => {
          const detailElement = tempDiv.querySelectorAll('details')[index];

          if (detailElement) {
            detailElement.classList.add('menu-opening');
            detailElement.setAttribute('open', '');
          }
        });

        document.querySelector('.collection-inner').innerHTML =
          tempDiv.querySelector('.collection-inner').innerHTML;

        const loaded = parseInt(sessionStorage.getItem('collection-loaded'), 10);
        const items = document.querySelectorAll('.collection-products .product-item.hidden');

        let count = 0;
        const countToShow = loaded && loaded > 0 ? loaded : 21;

        for (const item of items) {
          if (count >= countToShow) break;

          item.classList.remove('hidden');
          item.classList.add('visible');
          count++;
        }

        updateLoadMoreVisibility();

        const newFilters = document.querySelector('facets-collection');

        if (newFilters) {
          newFilters.filterInputs = newFilters.querySelectorAll('input');
          newFilters.details = Array.from(newFilters.querySelectorAll('details'));
          newFilters.filterInputs.forEach(input => {
            input.addEventListener('click', newFilters.handleClick.bind(newFilters));
          });
          newFilters.isLoading = false;
        }

        url.searchParams.delete('section_id');
        window.history.pushState({}, '', url.toString());
      })
      .finally(() => {
        const event = new CustomEvent('facet:productsRendered', {
          detail: {
            container: document.querySelector('.collection-inner'),
          }
        });

        window.dispatchEvent(event);
      });
  }
}

customElements.define('facets-collection', FacetsCollection);

class FilterRemove extends HTMLElement {
  constructor() {
    super();
    this.isLoading = false;

    const facetLink = this.querySelector('a');

    facetLink.setAttribute('role', 'button');
    facetLink.addEventListener('click', this.closeFilter.bind(this));

    facetLink.addEventListener('keyup', (event) => {
      event.preventDefault();
      if (event.code.toUpperCase() === 'SPACE') this.closeFilter(event);
    });
  }

  closeFilter(event) {
    event.preventDefault();

    if (this.isLoading) return;

    this.isLoading = true;
    this.classList.add('is-loading');

    const collectionFilters = document.querySelector('facets-collection');
    const sectionId = collectionFilters.dataset.sectionId;
    const cleanUrl = new URL(window.location.href);

    cleanUrl.searchParams.delete('filter.p.m.custom.genre');
    cleanUrl.searchParams.delete('filter.v.m.custom.tonalites');
    cleanUrl.searchParams.delete('filter.p.m.custom.collections');
    cleanUrl.searchParams.delete('loaded');

    cleanUrl.searchParams.set('section_id', sectionId);

    const openDetails = collectionFilters.details
      .map((value, index) =>
        value.classList.contains('menu-opening') ? index : null
      )
      .filter(index => index !== null);

    fetch(cleanUrl.toString())
      .then(response => response.text())
      .then(html => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        openDetails.forEach(index => {
          const detailElement = tempDiv.querySelectorAll('details')[index];
          if (detailElement) {
            detailElement.classList.add('menu-opening');
            detailElement.setAttribute('open', '');
          }
        });

        document.querySelector('.collection-inner').innerHTML =
          tempDiv.querySelector('.collection-inner').innerHTML;

        sessionStorage.removeItem('collection-loaded');

        const items = document.querySelectorAll('.collection-products .product-item');

        items.forEach(item => {
          item.classList.add('hidden');
          item.classList.remove('visible');
        });

        for (let i = 0; i < 21 && i < items.length; i++) {
          items[i].classList.remove('hidden');
          items[i].classList.add('visible');
        }

        updateLoadMoreVisibility();

        const newFilters = document.querySelector('facets-collection');

        if (newFilters) {
          newFilters.filterInputs = newFilters.querySelectorAll('input');
          newFilters.details = Array.from(newFilters.querySelectorAll('details'));
          newFilters.filterInputs.forEach(input => {
            input.addEventListener('click', newFilters.handleClick.bind(newFilters));
          });
          newFilters.isLoading = false;
        }

        cleanUrl.searchParams.delete('section_id');
        window.history.pushState({}, '', cleanUrl.toString());

        collectionFilters.filterInputs.forEach(input => {
          input.checked = false;
        });

        if (collectionFilters.updateInputUrls) collectionFilters.updateInputUrls();
      })
      .finally(() => {
        const event = new CustomEvent('facet:productsRendered', {
          detail: {
            container: document.querySelector('.collection-inner'),
          }
        });

        window.dispatchEvent(event);
      });
  }
}

customElements.define('filter-remove', FilterRemove);

class LoadMoreProduct extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.button = this.querySelector('button');

    if (!this.button) return;

    this.handleClick = this.handleClick.bind(this);
    this.button.addEventListener('click', this.handleClick);

    this.hasLoadedOnce = false;

    const loaded = parseInt(sessionStorage.getItem('collection-loaded'), 10);

    if (loaded && loaded > 0) this.restoreLoadedItems(loaded);
    else this.showNextBatch();
  }

  disconnectedCallback() {
    if (this.button) this.button.removeEventListener('click', this.handleClick);
  }

  handleClick() {
    this.showNextBatch();
  }

  showNextBatch() {
    const items = document.querySelectorAll('.collection-products .product-item.hidden');
    const batchSize = this.hasLoadedOnce ? 42 : 21;

    let count = 0;

    for (const item of items) {
      if (count >= batchSize) break;

      item.classList.remove('hidden');
      item.classList.add('visible');
      count++;
    }

    this.hasLoadedOnce = true;

    const visibleCount = document.querySelectorAll('.collection-products .product-item.visible').length;

    sessionStorage.setItem('collection-loaded', visibleCount);

    updateLoadMoreVisibility();
  }

  restoreLoadedItems(countToShow) {
    const items = document.querySelectorAll('.collection-products .product-item.hidden');

    let count = 0;

    for (const item of items) {
      if (count >= countToShow) break;

      item.classList.remove('hidden');
      item.classList.add('visible');
      count++;
    }

    this.hasLoadedOnce = countToShow > 21;

    updateLoadMoreVisibility();
  }
}

customElements.define('load-more-product', LoadMoreProduct);

// Version précédente avec fetch pour charger plus de produits depuis le serveur, mais on opte finalement pour une solution plus simple qui consiste à cacher les produits supplémentaires et les afficher par batch au clic du bouton "charger + de produits"
// class LoadMoreProduct extends HTMLElement {
//   connectedCallback() {
//     this.button = this.querySelector('button');
//     if (!this.button) return;

//     this.handleClick = this.handleClick.bind(this);
//     this.button.addEventListener('click', this.handleClick);
//   }

//   async handleClick() {
//     if (this.isLoading) return;

//     this.isLoading = true;

//     const nextUrl = new URL(this.button.dataset.nextUrl, window.location.origin);
//     const currentUrl = new URL(window.location.href);

//     currentUrl.searchParams.forEach((value, key) => {
//       if (key.startsWith('filter') || key === 'q') {
//         nextUrl.searchParams.set(key, value);
//       }
//     });

//     nextUrl.searchParams.set('section_id', document.querySelector('facets-collection')?.dataset.sectionId);

//     const res = await fetch(nextUrl.toString());
//     const html = await res.text();

//     const tempDiv = document.createElement('div');
//     tempDiv.innerHTML = html;

//     const newItems = tempDiv.querySelectorAll('.product-item');
//     const container = document.querySelector('.collection-products');

//     newItems.forEach(item => container.appendChild(item));

//     const newLoadMore = tempDiv.querySelector('load-more-product');

//     if (newLoadMore) {
//       this.replaceWith(newLoadMore);
//     } else {
//       this.remove();
//     }

//     this.isLoading = false;
//   }
// }

function updateLoadMoreVisibility() {
  const hiddenItems = document.querySelectorAll('.product-item.hidden').length;
  const button = document.querySelector('load-more-product button');

  if (!button) return;

  if (hiddenItems === 0) button.style.display = 'none';
  else button.style.display = 'block';
}