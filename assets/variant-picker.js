class VariantPicker extends HTMLElement {
  constructor() {
    super();
  }

  get sectionId() {
    return this.dataset.sectionId;
  }

  connectedCallback() {
    this.variantSelectors = this.querySelectorAll('input[type="radio"]');
    this.handleChange = this.handleChange.bind(this);

    this.variantSelectors.forEach((selector) => {
      selector.addEventListener('change', this.handleChange);
    });

    this.details = Array.from(this.querySelectorAll('details'));
  }

  disconnectedCallback() {
    this.variantSelectors.forEach((selector) => {
      selector.removeEventListener('change', this.handleChange);
    });
  }

  handleChange(event) {
    const input = event.currentTarget;
    const url = `${window.location.pathname}?variant=${input.value}&section_id=${this.sectionId}`;
    const productForm = document.querySelector('.product-form');
    const hasMenuOpening = productForm?.classList.contains('menu-opening');
    console.log(url)

    fetch(url)
      .then((response) => response.text())
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

        document.querySelector('.product').innerHTML =
          tempDiv.querySelector('.product').innerHTML;

        if (hasMenuOpening) {
          const newProductForm = document.querySelector('.product-form');
          newProductForm?.classList.add('menu-opening');
        }

        const newUrl = new URL(url, window.location.origin);

        newUrl.searchParams.delete('section_id')
        window.history.pushState({}, '', newUrl.toString());
      })
      .catch((error) => {
        console.error('Error fetching variant data:', error);
      })
      .finally(() => {
        const event = new CustomEvent('variant:change', {
          detail: {
            container: document.querySelector('.section-main-product'),
          }
        });

        window.dispatchEvent(event);
      });
  }
}

customElements.define('variant-picker', VariantPicker);