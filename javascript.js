/* ==========
 * Custom Announcement Bar
 * Version 1
 * This Code is licensed by Will-Myers.com 
========== */

(function(){  
  const ps = {
    cssId: 'wm-mega-announcement',
    cssFile: 'https://cdn.jsdelivr.net/gh/willmyethewebsiteguy/megaAnnouncementBar@1.1.003/styles.min.css'
  };
  const defaults = {
  };
  const utils = {
    /* Emit a custom event */
    emitEvent: function (type, detail = {}, elem = document) {
      // Make sure there's an event type
      if (!type) return;

      // Create a new event
      let event = new CustomEvent(type, {
        bubbles: true,
        cancelable: true,
        detail: detail,
      });

      // Dispatch the event
      return elem.dispatchEvent(event);
    },
    inIframe: function () {
      try {
        return window.self !== window.top;
      } catch (e) {
        return true;
      }
    },
    preventPlugin: function(){
      let styles = window.getComputedStyle(document.body),
          prevent = (styles.getPropertyValue(`--${ps.id}-edit-mode`) === 'true');

      return (prevent && utils.inIframe());
    },
    loadImages: function(container){
      let images = container.querySelectorAll('.summary-v2-block img, .sqs-block-image img, .section-background img');
      images.forEach(img => {

        img.classList.add('loaded');
        let imgData = img.dataset,
            focalPoint = imgData.imageFocalPoint,
            parentRation = imgData.parentRatio,
            src = img.src;
        if (focalPoint) {
          let x = focalPoint.split(',')[0] * 100,
              y = focalPoint.split(',')[1] * 100;
          img.style.setProperty('--position', `${x}% ${y}%`)
        }
        if (!src) {
          img.src = imgData.src
        }
      });
    },
    debounce: function (fn) {
      // Setup a timer
      let timeout;

      // Return a function to run debounced
      return function () {
        // Setup the arguments
        let context = this;
        let args = arguments;

        // If there's a timer, cancel it
        if (timeout) {
          window.cancelAnimationFrame(timeout);
        }

        // Setup the new requestAnimationFrame()
        timeout = window.requestAnimationFrame(function () {
          fn.apply(context, args);
        });
      }
    },
    getPropertyValue: function(el, prop) {
      let styles = window.getComputedStyle(el),
          value = styles.getPropertyValue(prop);
      return value;
    },
    unescapeSlashes: function(str) {
      let parsedStr = str.replace(/(^|[^\\])(\\\\)*\\$/, "$&\\");
      parsedStr = parsedStr.replace(/(^|[^\\])((\\\\)*")/g, "$1\\$2");

      try {
        parsedStr = JSON.parse(`"${parsedStr}"`);
      } catch(e) {
        return str;
      }
      return parsedStr ;
    }
  }

  let MegaAnnouncementBar = (function(){
    
    function addDropdownArrow(instance) {
      let arrow = `<button class="dropdown-arrow">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-labelledby="title" role="img" xmlns:xlink="http://www.w3.org/1999/xlink">
          <title>Angle Up</title>
          <path data-name="layer1" fill="none" stroke="#202020" stroke-miterlimit="10" stroke-width="2" d="M4 19 l28 26 L60 19" stroke-linejoin="round" stroke-linecap="round"></path>
         </svg>
      </button>`,
          innerText = instance.settings.innerText,
          section = instance.settings.section,
          contentWrapper = section.querySelector('.content-wrapper'),
          height;
      
      innerText.insertAdjacentHTML('afterbegin', arrow);
      
      function closeAccordion(){
        contentWrapper.style.display = 'none';
        height = innerText.getBoundingClientRect().height;
        section.style.height = height + 'px';
        section.classList.add('close');
        section.classList.remove('open');
        instance.settings.dropdownArrow.classList.add('close');
        instance.settings.dropdownArrow.classList.remove('open');
      }
      function openAccordion(){
        contentWrapper.style.display = 'flex';
        contentWrapper.style.paddingTop = (innerText.getBoundingClientRect().height + parseInt(utils.getPropertyValue(contentWrapper, 'padding-bottom'))) + 'px';
        let height = contentWrapper.getBoundingClientRect().height;
        section.style.height = height + 'px';
        section.classList.add('open');
        section.classList.remove('close');
        instance.settings.dropdownArrow.classList.add('open')
        instance.settings.dropdownArrow.classList.remove('close')
      }
      
      function toggleAccordion(e) {
        if (e.target.closest('button').classList.contains('open')){
          closeAccordion()
        } else {
          openAccordion();
        }
      }

      instance.settings.dropdownArrow.addEventListener('click', toggleAccordion);
      instance.settings.isOpen ? openAccordion() : closeAccordion();
    }

    function moveSection(instance) {
      let section = instance.settings.section,
          aBDropzone = instance.settings.aBDropzone,
          aBar = aBDropzone.querySelector('.sqs-announcement-bar'),
          abText = instance.settings.abText,
          innerTextEl = instance.settings.innerText,
          container = instance.settings.container,
          sectionClone = section.cloneNode(),
          closeBtn = instance.settings.closeBtn;
      
      console.log(sectionClone);

      aBDropzone.classList.add('wm-custom-announcement-bar', 'loaded');
      section.insertAdjacentElement('afterend', sectionClone);
      sectionClone.style.display = 'none';
      container.append(section);
      section.prepend(innerTextEl);
      innerTextEl.prepend(closeBtn);
      closeBtn.innerHTML = '×';
      section.classList.add('announcement-bar-section');
      abText.classList.remove('sqs-announcement-bar-text');

      utils.loadImages(section);

      //Global Init
      if (Squarespace) Squarespace.initializeLayoutBlocks(Y)
    }
    
    function syncStyles(instance) {
      let siteWrapper = document.querySelector('.site-wrapper'),
          clone = instance.settings.sectionClone,
          section = instance.settings.section,
          dropzone = instance.settings.aBDropzone; 
      
      //Set Paragraph Line Height
      section.style.lineHeight = utils.getPropertyValue(siteWrapper, 'line-height');
      
      //Paragraph Color
      let sectionColor = utils.getPropertyValue(section, 'color');
      dropzone.style.setProperty('--color', sectionColor)

      //Background Color
      section.querySelector('.section-background').style.background = utils.getPropertyValue(section.querySelector('.section-background'), 'background-color');
    }

    function setFooterIndex(instance) {
      let section = instance.settings.section,
          index = Array.from(
            section.parentElement.children
          ).indexOf(section);
      
      instance.settings.footerIndex = index;
    }

    /*Remove Section if Jumping into Edit Mode*/
    function returnSection(instance) {
      let section = document.querySelector('.announcement-bar-section'),
          aBDropzone = document.querySelector('.wm-custom-announcement-bar'),
          innerText = document.querySelector('#announcement-bar-text-inner-id'),
          button = innerText.querySelector('button'),
          footer = document.querySelector('#footer-sections'),
          index = instance.settings.footerIndex;
      
      if (!section) return;

      instance.settings.abText.classList.add('sqs-announcement-bar-text');
      section.insertAdjacentElement('beforebegin', innerText);
      if (footer.children[index]) {
        footer.children[index].insertAdjacentElement('beforebegin', section);
        footer.children[index + 1].remove();
      } else {
        footer.append(section);
      }
      button.remove();
      aBDropzone.classList.remove('wm-custom-announcement-bar');
      section.classList.remove('announcement-bar-section');
      section.classList.remove('close');
      section.classList.remove('open');
      section.style.height = '';
      section.querySelector('.content-wrapper').style.display = '';
      section.querySelector('.content-wrapper').style.paddingTop = '';
      section.querySelector('.section-background').style.background = '';
    }

    function Constructor(el, options = {}) {
      let instance = this;

      // Add Elements Obj
      this.settings = {
        section: el,
        footerIndex: 0,
        abText: document.querySelector('.sqs-announcement-bar-text'),
        get aBDropzone() {
          return document.querySelector('.sqs-announcement-bar-dropzone')
        },
        get innerText() {
          return this.aBDropzone.querySelector('#announcement-bar-text-inner-id');
        },
        get container() {
          return this.aBDropzone.querySelector('.sqs-announcement-bar-text')
        },
        get closeBtn() {
          return document.querySelector('.sqs-announcement-bar-close')
        },
        get dropdownArrow() {
          return this.innerText.querySelector('.dropdown-arrow')
        },
        get isOpen() {
          let isOpen = utils.getPropertyValue(this.section, '--is-open');
          isOpen === 'true' ? isOpen = true : isOpen = false;
          return isOpen;
        }
      };
      
      //Set Footer Index
      setFooterIndex(this);
      
      //Sync Styles
      syncStyles(this)
      
      //Move Section to Announcement Bar
      moveSection(this);
      
      //Add Dropdown Arrow
      addDropdownArrow(this);

      //If In Backend, Watch for Edit Mode
      const editModeObserver = new MutationObserver(function(mutations_list) {
        mutations_list.forEach(function(mutation) {
          let classList = document.body.classList;
          if (mutation.attributeName === 'class' 
              && classList.contains('sqs-edit-mode-active')){
            editModeObserver.disconnect();
            returnSection(instance);
          }
        });
      });
      if(window.self !== window.top) {
        let options = {subtree: false, childList: false, attributes: true}
        editModeObserver.observe(document.body, options);
      }

      el.wmMegaAnnouncement = {
        initilized: true,
        settings: this.settings,
      };
    }

    return Constructor;
  }());

  
  const aBDropzone = document.querySelector('.sqs-announcement-bar-dropzone'),
        footerSections = document.querySelectorAll('#footer-sections .page-section');


  footerSections.forEach(section => {
    let isTrue = utils.getPropertyValue(section, '--mega-announcement');
    if (isTrue !== 'true') return;

    const observer = new MutationObserver(function(mutations_list) {
      mutations_list.forEach(function(mutation) {
        if (mutation.addedNodes.length !== 0){
          new MegaAnnouncementBar(section)
          observer.disconnect();
        }
      });
    });
    observer.observe(aBDropzone, { subtree: false, childList: true, attributes: false});
  })
  
  window.setTimeout(function(){
    aBDropzone?.classList.add('loaded')
  }, 300);
}());
