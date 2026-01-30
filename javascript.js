/**
 * Mega Announcement Bar Plugin for Squarespace
 * Transforms a footer section into an expandable announcement bar
 * Copyright Will-Myers.com
 **/

class WMMegaAnnouncementBar {
  // Static properties
  static pluginName = "mega-announcement-bar";
  static instances = [];
  static originalPositions = new Map();
  static isEditModeObserverSet = false;

  // Default settings - can be overridden via JS or CSS custom properties
  static defaultSettings = {
    isOpen: false,
    mobileIsOpen: false,
    clickableArea: false,
    dropdownArrowHtml: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-labelledby="title" role="img">
      <title>Toggle Announcement Bar</title>
      <path data-name="layer1" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="2" d="M4 19 l28 26 L60 19" stroke-linejoin="round" stroke-linecap="round"></path>
    </svg>`,
  };

  // Static method to emit custom events
  static emitEvent(type, detail = {}, elem = document) {
    elem.dispatchEvent(
      new CustomEvent(`wm-${this.pluginName}${type}`, {
        detail,
        bubbles: true,
      })
    );
  }

  // Static method to deconstruct all instances (for edit mode)
  static deconstruct() {
    WMMegaAnnouncementBar.instances.forEach(instance => {
      if (instance && typeof instance.destroy === "function") {
          instance.destroy();
        }
      });
      
      // Clear instances array
    WMMegaAnnouncementBar.instances = [];
      
      // Clear original positions map
    WMMegaAnnouncementBar.originalPositions.clear();

    // Reset observer flag so it can be set up again if needed
    WMMegaAnnouncementBar.isEditModeObserverSet = false;
  }

  // Static method to set up edit mode observer (only once)
  static addEditModeObserver() {
    const isBackend = window.self !== window.top;
    if (WMMegaAnnouncementBar.isEditModeObserverSet || !isBackend) return;

    const bodyObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.attributeName === "class") {
          if (document.body.classList.contains("sqs-edit-mode-active")) {
            WMMegaAnnouncementBar.deconstruct();
            bodyObserver.disconnect();
          }
        }
      });
    });

    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    WMMegaAnnouncementBar.isEditModeObserverSet = true;
  }

  // Static utility: get CSS property value
  static getPropertyValue(el, prop) {
    return window.getComputedStyle(el).getPropertyValue(prop).trim();
  }

  // Static utility: load images
  static loadImages(container) {
    const images = container.querySelectorAll(
      ".summary-v2-block img, .sqs-block-image img, .section-background img"
    );
    images.forEach(img => {
      img.classList.add("loaded");
      const imgData = img.dataset;
      const focalPoint = imgData.imageFocalPoint;
      const src = img.src;

      if (focalPoint) {
        const x = focalPoint.split(",")[0] * 100;
        const y = focalPoint.split(",")[1] * 100;
        img.style.setProperty("--position", `${x}% ${y}%`);
      }
      if (!src && imgData.src) {
        img.src = imgData.src;
      }
    });
  }

  constructor(el, settings = {}) {
    this.el = el; // The footer section element
    this.isBackend = window.self !== window.top;

    // Start with default settings
    this.settings = { ...WMMegaAnnouncementBar.defaultSettings };

    // Elements object - populated during init
    this.elements = {};

    // Event handlers storage for cleanup
    this._eventHandlers = {};

    // Store passed settings for later merge (after CSS extraction)
    this._passedSettings = settings;

    this.init();
  }

  init() {
    WMMegaAnnouncementBar.emitEvent(":beforeInit", { el: this.el }, this.el);

    // Cache DOM elements
    this.cacheElements();

    // Validate required elements exist
    if (!this.elements.aBDropzone) {
      console.warn(`[${WMMegaAnnouncementBar.pluginName}] Announcement bar dropzone not found`);
      return;
    }

    // Add classes BEFORE extracting settings (users target .announcement-bar-section in CSS)
    this.el.dataset.wmPlugin = WMMegaAnnouncementBar.pluginName;
    this.el.classList.add("announcement-bar-footer-section", "announcement-bar-section");

    // Extract settings from CSS custom properties (now the class is applied)
    this.extractSettings();

    // Sync styles before moving
    this.syncStyles();

    // Move section to announcement bar
    this.moveSection();

    // Build dropdown controls
    this.buildDropdownControls();

    // Bind events
    this.bindEvents();

    // Set initial state
    this.setInitialState();

    // Add to instances
    WMMegaAnnouncementBar.instances.push(this);

    // Attach to element for external access
    this.el.wmMegaAnnouncementBar = this;

    // Set up edit mode observer
    WMMegaAnnouncementBar.addEditModeObserver();

    WMMegaAnnouncementBar.emitEvent(":afterInit", { el: this.el }, this.el);
  }

  cacheElements() {
    this.elements = {
      section: this.el,
      header: document.querySelector("#header"),
      aBDropzone: document.querySelector(".sqs-announcement-bar-dropzone"),
      abText: document.querySelector(".sqs-announcement-bar-text"),
      contentWrapper: this.el.querySelector(".content-wrapper"),
      sectionBackground: this.el.querySelector(".section-background"),
    };

    // Elements that depend on aBDropzone
    if (this.elements.aBDropzone) {
      this.elements.innerText = this.elements.aBDropzone.querySelector("#announcement-bar-text-inner-id");
      this.elements.container = this.elements.aBDropzone.querySelector(".sqs-announcement-bar-text");
      this.elements.closeBtn = document.querySelector(".sqs-announcement-bar-close");
    }
  }

  extractSettings() {
    const section = this.el;

    // Priority: defaults < CSS custom properties < JS settings (window or passed)
    
    // 1. Read CSS custom properties (override defaults)
    const isOpenValue = WMMegaAnnouncementBar.getPropertyValue(section, "--is-open");
    if (isOpenValue === "true") {
      this.settings.isOpen = true;
    } else if (isOpenValue === "false") {
      this.settings.isOpen = false;
    }

    const mobileIsOpenValue = WMMegaAnnouncementBar.getPropertyValue(section, "--mobile-is-open");
    if (mobileIsOpenValue === "true") {
      this.settings.mobileIsOpen = true;
    } else if (mobileIsOpenValue === "false") {
      this.settings.mobileIsOpen = false;
    }

    const clickableAreaValue = WMMegaAnnouncementBar.getPropertyValue(section, "--clickable-area");
    if (clickableAreaValue.includes("true")) {
      this.settings.clickableArea = true;
    } else if (clickableAreaValue.includes("false")) {
      this.settings.clickableArea = false;
    }

    // 2. Apply global JS settings from window (override CSS)
    const globalSettings = window.wmMegaAnnouncementBarSettings || {};
    if (Object.keys(globalSettings).length > 0) {
      Object.assign(this.settings, globalSettings);
    }

    // 3. Apply passed settings (highest priority, override everything)
    if (this._passedSettings && Object.keys(this._passedSettings).length > 0) {
      Object.assign(this.settings, this._passedSettings);
    }
  }

  syncStyles() {
    const { section, aBDropzone, sectionBackground } = this.elements;
    if (!aBDropzone || !section) return;

    // Sync paragraph color
    const sectionColor = WMMegaAnnouncementBar.getPropertyValue(section, "color");
    aBDropzone.style.setProperty("--color", sectionColor);

    // Sync background color
    if (sectionBackground) {
      const bgColor = WMMegaAnnouncementBar.getPropertyValue(sectionBackground, "background-color");
      sectionBackground.style.background = bgColor;
    }
  }

  moveSection() {
    const { section, aBDropzone, abText, innerText, container, closeBtn } = this.elements;
    if (!section || !aBDropzone || !container) return;

    // Create placeholder for restoration
    const placeholder = document.createElement("div");
    placeholder.classList.add("wm-mega-announcement-placeholder");
    placeholder.style.display = "none";
      
      // Insert placeholder before moving the section
      section.parentNode.insertBefore(placeholder, section);
      
    // Store original position info
    WMMegaAnnouncementBar.originalPositions.set(section, {
        originalParent: section.parentNode,
      placeholder,
      abText,
      innerText,
    });

    // Move section to announcement bar
    aBDropzone.classList.add("wm-custom-announcement-bar", "loaded");
    container.append(section);

    // Move inner text into section
    if (innerText) {
      section.prepend(innerText);
    }

    // Move close button into inner text
    if (closeBtn && innerText) {
      innerText.prepend(closeBtn);
      closeBtn.innerHTML = "×";
    }

    // Add site-wrapper class (announcement-bar-section already added in init)
    section.classList.add("site-wrapper");

    // Remove default class from abText
    if (abText) {
      abText.classList.remove("sqs-announcement-bar-text");
    }

    // Load images
    WMMegaAnnouncementBar.loadImages(section);

    // Initialize Squarespace layout blocks
    if (typeof Squarespace !== "undefined" && typeof Y !== "undefined") {
      Squarespace.initializeLayoutBlocks(Y);
    }
  }

  buildDropdownControls() {
    const { innerText, header } = this.elements;
    if (!innerText) return;

    // Create dropdown arrow button
    const arrowBtn = document.createElement("button");
    arrowBtn.className = "dropdown-arrow";
    arrowBtn.innerHTML = this.settings.dropdownArrowHtml;
    innerText.insertAdjacentElement("afterbegin", arrowBtn);

    // Create clickable toggle area
    const toggleArea = document.createElement("a");
    toggleArea.href = "#";
    toggleArea.className = "dropdown-toggle-area";
    innerText.insertAdjacentElement("afterbegin", toggleArea);

    // Store references
    this.elements.dropdownArrow = arrowBtn;
    this.elements.dropdownToggleArea = toggleArea;

    // Add clickable area class to header if enabled
    if (this.settings.clickableArea && header) {
      header.classList.add("ab-entire-area");
    }
  }

  setInitialState() {
    const isMobile = window.innerWidth < 767;
    const shouldBeOpen = isMobile ? this.settings.mobileIsOpen : this.settings.isOpen;

    if (shouldBeOpen) {
      this.openAccordion();
    } else {
      this.closeAccordion();
    }
  }

  openAccordion() {
    const { header, section, contentWrapper, innerText, dropdownArrow, dropdownToggleArea } = this.elements;
    if (!header || !section || !contentWrapper || !innerText) return;

    header.classList.add("announcement-bar-open");
    contentWrapper.style.display = "flex";

    // Calculate padding for content wrapper
    const innerTextHeight = innerText.getBoundingClientRect().height;
    const paddingBottom = parseInt(WMMegaAnnouncementBar.getPropertyValue(contentWrapper, "padding-bottom")) || 0;
    contentWrapper.style.paddingTop = `${innerTextHeight + paddingBottom}px`;

    // Set section height
    const contentHeight = contentWrapper.getBoundingClientRect().height;
    section.style.height = `${contentHeight}px`;

    // Update classes
    section.classList.add("open");
    section.classList.remove("close");

    if (dropdownArrow) {
      dropdownArrow.classList.add("open");
      dropdownArrow.classList.remove("close");
    }

    if (dropdownToggleArea) {
      dropdownToggleArea.classList.add("open");
      dropdownToggleArea.classList.remove("close");
    }

    WMMegaAnnouncementBar.emitEvent(":open", { el: this.el }, this.el);
  }

  closeAccordion() {
    const { header, section, contentWrapper, innerText, dropdownArrow, dropdownToggleArea } = this.elements;
    if (!header || !section || !contentWrapper || !innerText) return;

    header.classList.remove("announcement-bar-open");
    contentWrapper.style.display = "none";

    // Set section height to just the inner text height
    const innerTextHeight = innerText.getBoundingClientRect().height;
    section.style.height = `${innerTextHeight}px`;

    // Update classes
    section.classList.add("close");
    section.classList.remove("open");

    if (dropdownArrow) {
      dropdownArrow.classList.add("close");
      dropdownArrow.classList.remove("open");
    }

    if (dropdownToggleArea) {
      dropdownToggleArea.classList.add("close");
      dropdownToggleArea.classList.remove("open");
    }

    WMMegaAnnouncementBar.emitEvent(":close", { el: this.el }, this.el);
  }

  toggleAccordion(e) {
    if (!e.target.closest("#header")) return;
    e.preventDefault();

    const isOpen = e.target.closest("#header").classList.contains("announcement-bar-open");

    if (isOpen) {
      this.closeAccordion();
    } else {
      this.openAccordion();
    }
  }

  bindEvents() {
    const { dropdownArrow, dropdownToggleArea } = this.elements;

    // Create bound handler for cleanup
    this._eventHandlers.toggleAccordion = e => this.toggleAccordion(e);

    if (dropdownToggleArea) {
      dropdownToggleArea.addEventListener("click", this._eventHandlers.toggleAccordion);
    }

    if (dropdownArrow) {
      dropdownArrow.addEventListener("click", this._eventHandlers.toggleAccordion);
    }
  }

  destroy() {
    const { section, header, contentWrapper, sectionBackground, dropdownArrow, dropdownToggleArea } = this.elements;
      
      if (!section) return;
      
    // Get stored position info
    const positionInfo = WMMegaAnnouncementBar.originalPositions.get(section);
      if (!positionInfo || !positionInfo.placeholder) return;
      
    const { placeholder, abText, innerText } = positionInfo;
    const aBDropzone = document.querySelector(".wm-custom-announcement-bar");

    // Remove event listeners
    if (dropdownToggleArea && this._eventHandlers.toggleAccordion) {
      dropdownToggleArea.removeEventListener("click", this._eventHandlers.toggleAccordion);
    }
    if (dropdownArrow && this._eventHandlers.toggleAccordion) {
      dropdownArrow.removeEventListener("click", this._eventHandlers.toggleAccordion);
    }
      
      // Restore abText class
      if (abText) {
      abText.classList.add("sqs-announcement-bar-text");
      }
      
      // Move innerText back before section
    if (innerText && section.contains(innerText)) {
      section.insertAdjacentElement("beforebegin", innerText);

        // Remove added buttons from innerText
      const addedButtons = innerText.querySelectorAll(".dropdown-arrow, .dropdown-toggle-area");
        addedButtons.forEach(btn => btn.remove());
      }
      
    // Restore section to original position
      if (placeholder.parentNode) {
        placeholder.parentNode.insertBefore(section, placeholder);
        placeholder.remove();
      }
      
    // Clean up dropzone
      if (aBDropzone) {
      aBDropzone.classList.remove("wm-custom-announcement-bar");
    }

    // Clean up section classes and styles
    section.classList.remove("announcement-bar-section", "site-wrapper", "close", "open");
    section.style.height = "";
    section.removeAttribute("data-wm-plugin");

    // Clean up header
    if (header) {
      header.classList.remove("announcement-bar-open", "ab-entire-area");
    }

    // Clean up content wrapper
    if (contentWrapper) {
      contentWrapper.style.display = "";
      contentWrapper.style.paddingTop = "";
    }

    // Clean up section background
    if (sectionBackground) {
      sectionBackground.style.background = "";
    }

    // Remove from original positions map
    WMMegaAnnouncementBar.originalPositions.delete(section);

    // Remove element reference
    delete this.el.wmMegaAnnouncementBar;

    WMMegaAnnouncementBar.emitEvent(":destroy", { el: this.el }, this.el);
  }
}

// IIFE for auto-initialization
(function () {
  const pluginName = WMMegaAnnouncementBar.pluginName;

  function initMegaAnnouncementBar() {
    const aBDropzone = document.querySelector(".sqs-announcement-bar-dropzone");
    const footerSections = document.querySelectorAll("#footer-sections .page-section");

    if (!aBDropzone) return;

    footerSections.forEach(section => {
      // Check if section should be a mega announcement bar
      const isMegaAnnouncement = WMMegaAnnouncementBar.getPropertyValue(section, "--mega-announcement");
      if (isMegaAnnouncement !== "true") return;

      // Skip if already initialized
      if (section.wmMegaAnnouncementBar) return;

      // Wait for announcement bar dropzone to be populated
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length !== 0) {
            // Settings are extracted internally (CSS props + window.wmMegaAnnouncementBarSettings)
            new WMMegaAnnouncementBar(section);
            observer.disconnect();
          }
        });
      });
      
    observer.observe(aBDropzone, { 
      subtree: false, 
      childList: true, 
        attributes: false,
    });
  });
  
    // Mark dropzone as loaded after a short delay
    setTimeout(() => {
      aBDropzone?.classList.add("loaded");
  }, 300);
  }

  // Expose global API
  window.WMMegaAnnouncementBar = {
    init: initMegaAnnouncementBar,
    deconstruct: () => WMMegaAnnouncementBar.deconstruct(),
    get instances() {
      return WMMegaAnnouncementBar.instances;
    },
  };

  // Auto-initialize
  initMegaAnnouncementBar();
})();
