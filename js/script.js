/* ============================================================
    INITIALIZATION
    ============================================================ */

// Helper function to get the correct path prefix based on current location
function getPathPrefix() {
    const path = window.location.pathname;
    // Count depth: how many directory levels from the sailing-blog root?
    const depth = path.split('/').filter(p => p && p !== 'sailing-blog').length - 1;
    return depth > 0 ? '../'.repeat(depth) : '';
}

let isErrorRedirectInProgress = false;

function isErrorPage() {
  const currentPath = window.location.pathname.toLowerCase();
  return currentPath.endsWith('/components/errorpage/error.html')
    || currentPath.endsWith('/components/errorpage/404.html')
    || currentPath.endsWith('components/errorpage/error.html')
    || currentPath.endsWith('components/errorpage/404.html');
}

function getErrorPagePath() {
  if (isErrorPage()) return '';

  try {
    const prefix = getPathPrefix();
    return `${prefix}components/errorpage/error.html`;
  } catch (_) {
    return 'components/errorpage/error.html';
  }
}

function redirectToErrorPage(reason) {
  if (isErrorRedirectInProgress || isErrorPage()) return;

  const errorPagePath = getErrorPagePath();
  if (!errorPagePath) return;

  isErrorRedirectInProgress = true;
  const details = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  window.location.replace(`${errorPagePath}${details}`);
}

function logSiteError(context, error) {
  console.error(context, error);
}

async function doesInternalLinkExist(url) {
  try {
    const headResponse = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (headResponse.ok) return true;

    if (headResponse.status === 405) {
      const getResponse = await fetch(url, { method: 'GET', cache: 'no-store' });
      return getResponse.ok;
    }

    return false;
  } catch (_) {
    return false;
  }
}

function registerBrokenLinkHandling() {
  if (window.__brokenLinkHandlingRegistered) return;

  document.addEventListener('click', async (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    if (event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;

    const href = (link.getAttribute('href') || '').trim();
    if (!href) return;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;

    const resolved = new URL(href, window.location.href);
    if (resolved.origin !== window.location.origin) return;

    const isSameDocumentAnchor = resolved.pathname === window.location.pathname
      && resolved.search === window.location.search
      && !!resolved.hash;

    if (isSameDocumentAnchor) return;

    event.preventDefault();

    const linkExists = await doesInternalLinkExist(resolved.href);
    if (linkExists) {
      window.location.href = resolved.href;
    } else {
      redirectToErrorPage('Link nicht gefunden');
    }
  });

  window.__brokenLinkHandlingRegistered = true;
}

registerBrokenLinkHandling();

async function loadPage() {
    const pathPrefix = getPathPrefix();
    
    // 1. Load Reusable Components
    if (typeof loadHTML === 'function') {
        // Load Menu
        await loadHTML('menu-bar', pathPrefix + 'components/header/menu_bar.html');
        // Load Footer
        await loadHTML('footer', pathPrefix + 'components/footer/Footer.html');
    }

    // 2. Initialize Page Content
    await hydratePostTemplateFromMetadata();
    initHeroCarousel();
    await loadRelatedPosts();
    initHybridGallery();
}

window.onload = () => {
  loadPage().catch((error) => {
    logSiteError('Page initialization failed', error);
  });
};
document.addEventListener('keydown', e => {
    if (e.key === "Escape") {
        closeHybridLightbox();
        document.querySelectorAll('.legal-modal-overlay.is-open').forEach(el => {
            const container = el.closest('[id$="-modal"]');
            if (container) closeModal(container.id);
        });
    }
  const hybridLightbox = document.getElementById('hybridLightbox');
  if(hybridLightbox && hybridLightbox.style.display === 'flex') {
        if(e.key === "ArrowRight") changeLightboxImage(1);
        if(e.key === "ArrowLeft") changeLightboxImage(-1);
    }
});


/* ============================================================
    LEGAL MODALS (Impressum & Datenschutz)
    ============================================================ */

function openModal(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const overlay = container.querySelector('.legal-modal-overlay');
    if (!overlay) return;
    overlay.classList.add('is-open');
    document.body.classList.add('modal-open');
}

function closeModal(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const overlay = container.querySelector('.legal-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('modal-open');
}

function submitContactForm(event) {
  event.preventDefault();

  const subjectInput = document.getElementById('kontakt-subject');
  const messageInput = document.getElementById('kontakt-message');
  const feedbackElement = document.getElementById('kontakt-feedback');

  if (!subjectInput || !messageInput) return;

  const subject = subjectInput.value.trim();
  const message = messageInput.value.trim();

  if (!subject || !message) {
    alert('Bitte fülle alle Felder aus.');
    return;
  }

  const email = 'ody.sailing@gmail.com';
  const mailSubject = `[Kontaktformular] ${subject}`;
  const mailBody = message;

  const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

  if (feedbackElement) {
    feedbackElement.textContent = 'Danke! Deine Mail-App wird geöffnet …';
    feedbackElement.classList.add('is-visible');
  }

  window.location.href = mailtoUrl;

  setTimeout(() => {
    closeModal('kontakt-modal');
    event.target.reset();
    if (feedbackElement) {
      feedbackElement.textContent = '';
      feedbackElement.classList.remove('is-visible');
    }
  }, 700);
}




//######################################################//
//= laods HTML by file name and injects it into index ==//
//######################################################//

async function loadHTML(id, url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${url}`);

    const html = await res.text();
    const container = document.getElementById(id);
    if (!container) throw new Error(`Container not found: ${id}`);
    container.innerHTML = html;

    // Small delay to ensure the browser has painted the new HTML
    setTimeout(() => {
      if (url.includes('menu_bar.html')) initMenuBar?.();
      if (url.includes('ueber_uns.html')) initValuesToggle?.();
      if (url.includes('ueber_uns.html')) initUnsereWerte?.();
      if (url.includes('ueber_uns.html')) initAboutHeroTextFit?.();
      if (url.includes('blog.html')) initBlog?.();
      if (url.includes('map.html')) initMap?.(id, { autoscale: true });
    }, 0);
    
  } catch (err) {
    logSiteError(`Failed to load page part: ${url}`, err);
  }
}


//#########################################################//
//= Funciton to  MenuBar & load Header-Burger Functions= ==//
//#########################################################//

function initMenuBar(){
  const burgerBtn = document.getElementById('burger');
  const menuDropdown = document.getElementById('menu-dropdown');
  const menuOverlay = document.getElementById('menu-overlay');
  const logoBtn = document.getElementById('logo-scroll-top');
  const menuLinks = menuDropdown.querySelectorAll('a');

  // Helper function to close menu
  function closeMenu() {
    burgerBtn.classList.remove('active');
    menuDropdown.classList.remove('active');
    menuOverlay.classList.remove('active');
    burgerBtn.setAttribute('aria-expanded', 'false');
  }

  // Helper function to open menu
  function openMenu() {
    burgerBtn.classList.add('active');
    menuDropdown.classList.add('active');
    menuOverlay.classList.add('active');
    burgerBtn.setAttribute('aria-expanded', 'true');
  }

  // Helper function to toggle menu
  function toggleMenu() {
    const isOpen = menuDropdown.classList.contains('active');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // --- Scroll to Top Logic ---
  if (logoBtn) {
    logoBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      closeMenu();
    });
  }

  // --- Burger Logic  ---
  burgerBtn.addEventListener('click', () => {
    toggleMenu();
  });

  // --- Close menu when clicking overlay ---
  menuOverlay.addEventListener('click', () => {
    closeMenu();
  });

  // --- Keyboard support: Close menu with Escape key ---
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuDropdown.classList.contains('active')) {
      closeMenu();
    }
  });

  // --- Make menu links functional ---
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Get the link text to determine target section
      const linkText = link.textContent.trim();
      let targetId = '';
      
      // Map menu items to section IDs
      switch(linkText) {
        case 'HOME':
          targetId = 'landing';
          break;
        case 'ÜBER UNS':
          targetId = 'ueber-uns';
          break;
        case 'BLOG':
          targetId = 'blog';
          break;
        case 'KARTE':
          targetId = 'map';
          break;
        case 'KONTAKT':
          openModal('kontakt-modal');
          closeMenu();
          return;
      }
      
      // Scroll to target section
      if (targetId) {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          // Calculate offset to account for sticky menu bar
          const menuBarHeight = document.getElementById('menu-bar')?.offsetHeight || 0;
          const targetPosition = targetElement.offsetTop - menuBarHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          
          // Update active state
          menuLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        }
      }
      
      // Close menu after clicking
      closeMenu();
    });
  });

  // --- Update active menu item on scroll ---
  let scrollTimeout;
  window.addEventListener('scroll', () => {
    // Debounce scroll event for performance
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const sections = ['landing', 'ueber-uns', 'blog', 'map'];
      const menuBarHeight = document.getElementById('menu-bar')?.offsetHeight || 0;
      const scrollPosition = window.scrollY + menuBarHeight + 50; // 50px offset for better UX
      
      // Find current section
      let currentSection = '';
      sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section && section.offsetTop <= scrollPosition) {
          currentSection = sectionId;
        }
      });
      
      // Update active state in menu
      menuLinks.forEach(link => {
        const linkText = link.textContent.trim();
        let shouldBeActive = false;
        
        switch(currentSection) {
          case 'landing':
            shouldBeActive = linkText === 'HOME';
            break;
          case 'ueber-uns':
            shouldBeActive = linkText === 'ÜBER UNS';
            break;
          case 'blog':
            shouldBeActive = linkText === 'BLOG';
            break;
          case 'map':
            shouldBeActive = linkText === 'KARTE';
            break;
        }
        
        if (shouldBeActive) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    }, 100); // Debounce delay
  });
}


//########################################//
//= Values Section Collapse/Expand ======//
//########################################//

function initValuesToggle() {
  const toggleBtn = document.getElementById('valuesToggleBtn');
  const valuesSection = document.getElementById('valuesSection');
  const valuesCardHeader = document.querySelector('.values-card__header');
  const valuesToggleContainer = document.querySelector('.values-toggle-container');

  if (!toggleBtn || !valuesSection) return; // Exit if elements don't exist

  // Set initial state
  let isExpanded = false;
  let hasAutoExpanded = false; // Track if auto-expansion has occurred
  const expandedHeightOffset = 500; // Increase/decrease this value to tune expanded height

  const syncExpandedHeight = () => {
    if (!isExpanded) return;
    valuesSection.style.maxHeight = (valuesSection.scrollHeight + expandedHeightOffset) + 'px';
  };

  window.addEventListener('resize', syncExpandedHeight);

  if (typeof ResizeObserver !== 'undefined') {
    const valuesResizeObserver = new ResizeObserver(() => {
      syncExpandedHeight();
    });
    valuesResizeObserver.observe(valuesSection);
  }

  const toggleValues = () => {
    isExpanded = !isExpanded;
    toggleBtn.setAttribute('aria-expanded', isExpanded);

    if (isExpanded) {
      // Expand
      syncExpandedHeight();
      valuesSection.classList.add('expanded');
      
      // Trigger animations for values when expanded
      setTimeout(() => {
        const wert1 = valuesSection.querySelector('.text-wert1');
        const wert2 = valuesSection.querySelector('.text-wert2');
        const wert3 = valuesSection.querySelector('.text-wert3');
        const wert4 = valuesSection.querySelector('.text-wert4');
        
        if (wert1) wert1.classList.add('animate-left');
        if (wert3) wert3.classList.add('animate-left');
        if (wert2) wert2.classList.add('animate-right');
        if (wert4) wert4.classList.add('animate-right');
      }, 50);
    } else {
      // Collapse
      valuesSection.style.maxHeight = '0px';
      valuesSection.classList.remove('expanded');
      
      // Remove animation classes when collapsing
      const wert1 = valuesSection.querySelector('.text-wert1');
      const wert2 = valuesSection.querySelector('.text-wert2');
      const wert3 = valuesSection.querySelector('.text-wert3');
      const wert4 = valuesSection.querySelector('.text-wert4');
      
      if (wert1) wert1.classList.remove('animate-left');
      if (wert3) wert3.classList.remove('animate-left');
      if (wert2) wert2.classList.remove('animate-right');
      if (wert4) wert4.classList.remove('animate-right');
    }
  };

  // Auto-expand when toggle container reaches the middle of the screen
  if (valuesToggleContainer) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        // Only auto-expand once when it reaches the middle and hasn't already expanded
        if (entry.isIntersecting && !hasAutoExpanded && !isExpanded) {
          hasAutoExpanded = true;
          toggleValues();
        }
      });
    }, {
      rootMargin: '-50% 0px -50% 0px', // Trigger when element reaches the middle of the viewport
      threshold: 0
    });

    observer.observe(valuesToggleContainer);
  }

  // Only attach click listener to the header (covers everything including arrow)
  if (valuesCardHeader) {
    valuesCardHeader.addEventListener('click', toggleValues);
  }
}


//################################//
//= Unsere Werte Text Animation ==//
//################################//

function initUnsereWerte() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Create a list of the elements you want to toggle
            const wert1 = document.querySelector('.text-wert1');
            const wert2 = document.querySelector('.text-wert2');
            const wert3 = document.querySelector('.text-wert3');
            const wert4 = document.querySelector('.text-wert4');

            if (entry.isIntersecting) {
                // Add classes when the section is in view
                wert1.classList.add('animate-left');
                wert3.classList.add('animate-left');
                wert2.classList.add('animate-right');
                wert4.classList.add('animate-right');
            } else {
                // Remove classes when the section leaves the view
                wert1.classList.remove('animate-left');
                wert3.classList.remove('animate-left');
                wert2.classList.remove('animate-right');
                wert4.classList.remove('animate-right');
            }
        });
    }, {
        threshold: 0.2, // Trigger earlier (20%) so it feels more responsive
        rootMargin: "0px 0px -50px 0px"
    });

    const target = document.querySelector('.werte-box');
    if (target) {
        observer.observe(target);
    }
}

function initAboutHeroTextFit() {
  const heroes = document.querySelectorAll('.about-values__hero');
  if (!heroes.length) return;

  const MIN_FONT_SIZE = 10;
  const EPSILON = 1;

  const fitOneHero = (hero) => {
    const media = hero.querySelector('.about-values__media');
    const text = hero.querySelector('.about-values__text');
    const body = hero.querySelector('.about-values__body');
    if (!media || !text || !body) return;

    hero.classList.remove('about-values__hero--fallback-grow');
    text.style.height = '';
    body.style.fontSize = '';
    body.style.lineHeight = '';

    const mediaHeight = media.getBoundingClientRect().height;
    if (mediaHeight <= 0) return;

    text.style.height = `${Math.round(mediaHeight)}px`;

    const computedBodyFontSize = parseFloat(window.getComputedStyle(body).fontSize) || 16;
    const maxFontSize = Math.max(MIN_FONT_SIZE, Math.round(computedBodyFontSize));

    const fitsAt = (fontSizePx) => {
      body.style.fontSize = `${fontSizePx}px`;
      body.style.lineHeight = '1.5';
      return body.scrollHeight <= body.clientHeight + EPSILON;
    };

    if (fitsAt(maxFontSize)) return;

    let low = MIN_FONT_SIZE;
    let high = maxFontSize;
    let bestFit = -1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (fitsAt(mid)) {
        bestFit = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (bestFit >= MIN_FONT_SIZE) {
      fitsAt(bestFit);
    } else {
      fitsAt(MIN_FONT_SIZE);
    }

    const stillOverflowing = body.scrollHeight > body.clientHeight + EPSILON;
    if (stillOverflowing) {
      hero.classList.add('about-values__hero--fallback-grow');
      text.style.height = 'auto';
      body.style.fontSize = `${MIN_FONT_SIZE}px`;
      body.style.lineHeight = '1.5';
    }
  };

  const fitAllHeroes = () => {
    heroes.forEach((hero) => fitOneHero(hero));
  };

  let resizeDebounce;
  const onResize = () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(fitAllHeroes, 120);
  };

  fitAllHeroes();
  requestAnimationFrame(fitAllHeroes);

  if (!window.__aboutHeroTextFitBound) {
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', fitAllHeroes);
    window.__aboutHeroTextFitBound = true;
  }

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      fitAllHeroes();
    });

    heroes.forEach((hero) => {
      const media = hero.querySelector('.about-values__media');
      if (media) observer.observe(media);
      observer.observe(hero);
    });
  }
}
//############################//
//=== Funktionen für Blog ===//
//############################//

let allPosts = [];
let showingAll = false; // Track state
let blogMetaCache = null;

function resolvePath(pathPrefix, value) {
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('/')) {
    return value;
  }
  return `${pathPrefix}${value}`;
}

function createPostHref(post) {
  const fallbackUrl = post.url || post.postUrl || 'pages/blog/post-template.html';
  if (!post.slug || /slug=/.test(fallbackUrl) || !fallbackUrl.includes('post-template.html')) {
    return fallbackUrl;
  }
  const separator = fallbackUrl.includes('?') ? '&' : '?';
  return `${fallbackUrl}${separator}slug=${encodeURIComponent(post.slug)}`;
}

function normalizeBlogMetadata(raw) {
  const site = Array.isArray(raw) ? {} : (raw.site || {});
  const postSource = Array.isArray(raw) ? raw : (raw.posts || []);

  const posts = postSource.map((item, index) => {
    const id = item.id || `post-${index + 1}`;
    const slug = item.slug || id;
    const image = item.image || item.coverImage || (item.heroImages?.[0]?.src) || '';
    const description = item.description || item.excerpt || '';

    return {
      id,
      slug,
      title: item.title || 'Ohne Titel',
      date: item.date || new Date().toISOString().slice(0, 10),
      updated: item.updated || item.date || new Date().toISOString().slice(0, 10),
      tag: item.tag || 'Boot',
      url: createPostHref({ ...item, slug }),
      image,
        intro: item.intro || '',
      description,
      excerpt: item.excerpt || description,
      author: item.author || 'Vito & Lea',
      canonical: item.canonical || '',
      keywords: Array.isArray(item.keywords)
        ? item.keywords
        : (typeof item.keywords === 'string' ? item.keywords.split(',').map(k => k.trim()).filter(Boolean) : []),
      heroImages: Array.isArray(item.heroImages) ? item.heroImages : [],
      sections: Array.isArray(item.sections) ? item.sections : [],
      related: Array.isArray(item.related) ? item.related : []
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  return { site, posts };
}

async function getBlogMetadata() {
  if (blogMetaCache) return blogMetaCache;

  const pathPrefix = getPathPrefix();
  const response = await fetch(pathPrefix + 'data/blog_metadata.json');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while loading blog metadata`);
  }
  const raw = await response.json();
  blogMetaCache = normalizeBlogMetadata(raw);
  return blogMetaCache;
}

// 1. Fetch and Initialize
async function initBlog() {
  try {
    const meta = await getBlogMetadata();
    allPosts = meta.posts;

    // Initially only show the first 10
    renderGrid(allPosts.slice(0, 10));
    
    // Show/Hide "Load More" button based on total count
    updateLoadMoreButton(allPosts.length > 10);
    
    // Re-render grid when viewport size changes (responsive columns)
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const postsToDisplay = showingAll ? allPosts : allPosts.slice(0, 10);
        renderGrid(postsToDisplay);
      }, 250); // Debounce to avoid excessive re-renders
    });
  } catch (err) {
    logSiteError('Error loading blog data', err);
  }
}

function showAllPosts() {
    showingAll = true;
    const activeCategory = document.querySelector('.filter-btn.active').innerText.trim();
    filterBlog(activeCategory); // Re-run filter with showingAll = true
}

function updateLoadMoreButton(isVisible) {
    const btn = document.getElementById('loadMoreBtn');
    if (isVisible && !showingAll) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

function renderGrid(posts) {
  const featuredSection = document.getElementById('featured-section');
  if (!featuredSection) return;
  const pathPrefix = getPathPrefix();
  
  // Determine number of columns based on screen size
  const screenWidth = window.innerWidth;
  const numColumns = screenWidth < 1024 ? 2 : 3;
  
  // Get column elements
  const columns = [];
  for (let i = 1; i <= 3; i++) {
    const col = document.getElementById(`col-${i}`);
    if (col) columns.push(col);
  }
  
  // Clear all columns
  featuredSection.innerHTML = '';
  columns.forEach(col => col.innerHTML = '');

  if (posts.length === 0) return;

  const [newest, ...others] = posts;

  // 1. Render Featured Box
  featuredSection.innerHTML = `
    <a href="${resolvePath(pathPrefix, newest.url || '#')}" class="featured-box-link">
      <article class="featured-box">
        <div class="newest-post-label">Neuster Blogbeitrag</div>
        <div class="post-image-container">
          <img src="${resolvePath(pathPrefix, newest.image)}" alt="${newest.title}" loading="lazy" width="350" height="280">
          <div class="image-overlay"><span>Weiterlesen</span></div>
        </div>
        <div class="post-meta">
          <span class="post-tag">${newest.tag}</span>
          <span class="post-date">${formatDate(newest.date)}</span>
        </div>
        <h2 class="post-title">${newest.title}</h2>
        <p class="post-description">${newest.intro || newest.excerpt || newest.description || ''}</p>
      </article>
    </a>`;

  // 2. Distribute others into columns (2 or 3 based on screen size)
  others.forEach((post, index) => {
    const cardHTML = `
      <a href="${resolvePath(pathPrefix, post.url || '#')}" style="text-decoration:none; color:inherit;">
        <article class="blog-card">
          <div class="post-image-container">
            <img src="${resolvePath(pathPrefix, post.image)}" alt="${post.title}" loading="lazy" width="300" height="240">
            <div class="image-overlay"><span>Weiterlesen</span></div>
          </div>
          <div class="post-meta">
            <span class="post-tag">${post.tag}</span>
            <span class="post-date">${formatDate(post.date)}</span>
          </div>
          <h3 class="post-title">${post.title}</h3>
        </article>
      </a>
    `;

    // Distribute to active columns (2 or 3)
    const columnIndex = index % numColumns;
    if (columns[columnIndex]) {
      columns[columnIndex].innerHTML += cardHTML;
    }
  });
}

function filterBlog(category) {
    // 1. Update Buttons
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.innerText.trim().toUpperCase() === category.toUpperCase());
    });

    // 2. Logic
    const absoluteNewest = allPosts[0];
    let filtered;

    if (category === 'All' || category === 'Alle') {
        filtered = allPosts;
    } else {
        filtered = allPosts.filter(post => post.tag === category);
        if (!filtered.some(post => post === absoluteNewest)) {
            filtered.unshift(absoluteNewest);
        }
    }

    // 3. Slice the data if not "showingAll"
    const postsToDisplay = showingAll ? filtered : filtered.slice(0, 10);
    
    renderGrid(postsToDisplay);
    
    // 4. Update button visibility
    // Only show button if there are more than 10 posts in THIS specific filtered list
    updateLoadMoreButton(filtered.length > 10);
}

// 4. Helper for Dates
function formatDate(dateString) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateString).toLocaleDateString('de-DE', options);
}

function updateMetaTag(selector, value) {
  const tag = document.querySelector(selector);
  if (tag && value) tag.setAttribute('content', value);
}

function updateCanonical(pathPrefix, canonicalPath, siteBaseUrl) {
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) return;

  if (canonicalPath) {
    if (/^(https?:)?\/\//i.test(canonicalPath)) {
      canonical.setAttribute('href', canonicalPath);
      return;
    }

    const base = (siteBaseUrl || '').replace(/\/$/, '');
    const normalizedPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    if (base) {
      canonical.setAttribute('href', `${base}${normalizedPath}`);
      return;
    }

    canonical.setAttribute('href', resolvePath(pathPrefix, canonicalPath));
  }
}

function renderSectionsFromMetadata(post, pathPrefix) {
  const articleContainer = document.querySelector('.article-container');
  const relatedBox = articleContainer?.querySelector('.related-posts-box');
  if (!articleContainer || !relatedBox || !Array.isArray(post.sections) || post.sections.length === 0) return;

  articleContainer.querySelectorAll('.content-block').forEach(block => block.remove());

  post.sections.forEach((section, sectionIndex) => {
    const rowId = `scrollRow${sectionIndex + 1}`;
    const galleryImages = Array.isArray(section.gallery) ? section.gallery : [];
    const galleryHtml = galleryImages.length > 0
      ? `
        <div class="hybrid-gallery">
            <div class="image-scroll-row" id="${rowId}">
                ${galleryImages.map(image => `<img src="${resolvePath(pathPrefix, image.src)}" alt="${image.alt || ''}">`).join('')}
            </div>
            <button class="scroll-arrow left" onclick="scrollGrid('${rowId}', -1)" aria-label="Previous image"><i class="fa-solid fa-chevron-left"></i></button>
            <button class="scroll-arrow right" onclick="scrollGrid('${rowId}', 1)" aria-label="Next image"><i class="fa-solid fa-chevron-right"></i></button>
        </div>`
      : '';

    const sectionEl = document.createElement('section');
    sectionEl.className = 'content-block';
    sectionEl.innerHTML = `
      <h2 class="block-title">${section.title || 'Absatz'}</h2>
      <p class="block-text">${section.html || ''}</p>
      ${galleryHtml}
    `;

    articleContainer.insertBefore(sectionEl, relatedBox);
  });
}

function setHeroDataSource(post, pathPrefix) {
  const heroSource = document.getElementById('hero-data-source');
  if (!heroSource || !Array.isArray(post.heroImages) || post.heroImages.length === 0) return;

  heroSource.innerHTML = post.heroImages
    .map(image => `<img src="${resolvePath(pathPrefix, image.src)}" alt="${image.alt || ''}">`)
    .join('');
}

function updatePostHeader(post) {
  const tagElement = document.querySelector('.article-tag');
  const dateElement = document.querySelector('.article-date');
  const titleElement = document.querySelector('.article-title');
  const introElement = document.querySelector('.article-intro');

  if (tagElement) tagElement.textContent = (post.tag || 'Boot').toUpperCase();
  if (dateElement) dateElement.textContent = formatDate(post.date);
  if (titleElement) titleElement.textContent = post.title;
  if (introElement) introElement.textContent = post.intro || post.excerpt || '';
  document.title = `${post.title} - Odyssee auf See`;
}

function updatePostSeo(post, siteBaseUrl, pathPrefix) {
  const keywords = (post.keywords || []).join(', ');
  const firstImage = post.heroImages?.[0]?.src || post.image || '';
  const resolvedImage = resolvePath(pathPrefix, firstImage);
  const canonicalPath = post.canonical || post.url;

  updateMetaTag('meta[name="description"]', post.excerpt || post.description);
  updateMetaTag('meta[name="keywords"]', keywords);
  updateMetaTag('meta[property="og:title"]', `${post.title} - Odyssee auf See`);
  updateMetaTag('meta[property="og:description"]', post.excerpt || post.description);
  updateMetaTag('meta[property="article:published_time"]', `${post.date}T00:00:00+00:00`);
  updateMetaTag('meta[property="article:tag"]', post.tag);
  updateMetaTag('meta[name="twitter:title"]', `${post.title} - Odyssee auf See`);
  updateMetaTag('meta[name="twitter:description"]', post.excerpt || post.description);
  updateMetaTag('meta[property="og:image"]', resolvedImage);
  updateMetaTag('meta[name="twitter:image"]', resolvedImage);

  const canonicalAbsolute = (() => {
    if (!canonicalPath) return '';
    if (/^(https?:)?\/\//i.test(canonicalPath)) return canonicalPath;
    const base = (siteBaseUrl || '').replace(/\/$/, '');
    const normalized = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    return base ? `${base}${normalized}` : resolvePath(pathPrefix, canonicalPath);
  })();

  updateMetaTag('meta[property="og:url"]', canonicalAbsolute);
  updateMetaTag('meta[name="twitter:url"]', canonicalAbsolute);
  updateCanonical(pathPrefix, canonicalPath, siteBaseUrl);

  const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
  if (!jsonLdScript) return;

  try {
    const ld = JSON.parse(jsonLdScript.textContent);
    ld.headline = post.title;
    ld.description = post.excerpt || post.description || '';
    ld.image = canonicalAbsolute && firstImage && !/^(https?:)?\/\//i.test(firstImage)
      ? `${canonicalAbsolute.replace(/\/$/, '')}/${firstImage.replace(/^\//, '')}`
      : resolvedImage;
    ld.datePublished = `${post.date}T00:00:00+00:00`;
    ld.dateModified = `${post.updated}T00:00:00+00:00`;
    ld.keywords = keywords;
    ld.articleSection = post.tag;
    if (ld.mainEntityOfPage && canonicalAbsolute) {
      ld.mainEntityOfPage['@id'] = canonicalAbsolute;
    }
    jsonLdScript.textContent = JSON.stringify(ld, null, 2);
  } catch (error) {
    logSiteError('Could not update JSON-LD metadata', error);
  }
}

async function hydratePostTemplateFromMetadata() {
  const postContainer = document.querySelector('.article-container');
  if (!postContainer) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) return;

  try {
    const pathPrefix = getPathPrefix();
    const meta = await getBlogMetadata();
    const post = meta.posts.find(item => item.slug === slug || item.id === slug);
    if (!post) return;

    updatePostHeader(post);
    setHeroDataSource(post, pathPrefix);
    renderSectionsFromMetadata(post, pathPrefix);
    updatePostSeo(post, meta.site?.baseUrl || '', pathPrefix);
  } catch (error) {
    logSiteError('Error hydrating post template from metadata', error);
  }
}


//############################//
//= Funktionen für Blog Page ==//
//############################//

/* ============================================================
    1. HERO CAROUSEL LOGIC (TOP)
    ============================================================ */
let heroImages = []; 
let heroIndex = 0;

function initHeroCarousel() {
    // 1. Get images from the HTML data source
    const dataSource = document.querySelectorAll('#hero-data-source img');
    
    // 2. Map them into our array
    heroImages = Array.from(dataSource).map(img => ({
        url: img.src,
        desc: img.alt
    }));

    // 3. Setup Dots
    const dots = document.getElementById('dot-container');
    if(dots && heroImages.length > 0) {
        dots.innerHTML = heroImages.map((_, i) => 
            `<span class="dot ${i === 0 ? 'active' : ''}" onclick="jumpToHero(${i})"></span>`
        ).join('');
    }

    // 4. Show the first image
    if(heroImages.length > 0) updateHeroUI();
}

function jumpToHero(index) {
    heroIndex = index;
    updateHeroUI();
}

function changeHeroImage(dir) {
    heroIndex = (heroIndex + dir + heroImages.length) % heroImages.length;
    updateHeroUI();
}

function updateHeroUI() {
    document.getElementById('carousel-img').src = heroImages[heroIndex].url;
    document.getElementById('image-description').innerText = heroImages[heroIndex].desc;
    document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === heroIndex));
}

/* ============================================================
    3 & 4. HYBRID GALLERY & LIGHTBOX (MIDDLE)
    ============================================================ */
let galleryImages = [];
let lbIndex = 0;

function initHybridGallery() {
    // Select ALL images inside any div with the class 'image-scroll-row'
    // This covers scrollRow1, scrollRow2, and relatedPostsRow automatically!
  const galleryRows = document.querySelectorAll('.image-scroll-row');
  const allGalleryImages = document.querySelectorAll('.image-scroll-row img');

  galleryRows.forEach(row => {
    row.scrollLeft = 0;
  });
    
    galleryImages = Array.from(allGalleryImages).map((img, i) => {
        // Assign the click event to open the lightbox at this specific index
        img.onclick = () => openHybridLightbox(i);
        
        return { 
            src: img.src, 
            alt: img.alt 
        };
    });
}

function scrollGrid(id, dir) {
    const element = document.getElementById(id);
    if (element) {
        element.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
}

function openHybridLightbox(i) {
    lbIndex = i;
    updateLightboxUI();
    document.getElementById('hybridLightbox').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function updateLightboxUI() {
    document.getElementById('lightbox-img').src = galleryImages[lbIndex].src;
    document.getElementById('hybridLightboxCaption').innerText = galleryImages[lbIndex].alt;
}

function changeLightboxImage(dir, e) {
    if(e) e.stopPropagation();
    lbIndex = (lbIndex + dir + galleryImages.length) % galleryImages.length;
    updateLightboxUI();
}

function handleLightboxClick(e) {
    if(e.target.id === 'hybridLightbox') closeHybridLightbox();
}

function closeHybridLightbox() {
    document.getElementById('hybridLightbox').style.display = 'none';
    document.body.style.overflow = 'auto';
}

/* ============================================================
    5. RELATED POSTS LOGIC (BOTTOM)
    ============================================================ */
async function loadRelatedPosts() {
    const container = document.getElementById('relatedPostsRow');
    
    // If the element isn't there, just stop here and don't throw an error
    if (!container) return;

    try {
        const pathPrefix = getPathPrefix();
      const meta = await getBlogMetadata();
      const posts = meta.posts;
      const slug = new URLSearchParams(window.location.search).get('slug');
      const activePost = posts.find(p => p.slug === slug || p.id === slug);

      let relatedPosts = [];
      if (activePost && Array.isArray(activePost.related) && activePost.related.length > 0) {
        relatedPosts = activePost.related
          .map(id => posts.find(p => p.id === id || p.slug === id))
          .filter(Boolean);
      }

      if (relatedPosts.length === 0) {
        relatedPosts = posts.filter(p => p.slug !== slug).slice(0, 8);
      }

      container.innerHTML = relatedPosts.map(p => `
        <a href="${resolvePath(pathPrefix, p.url || '#')}" class="post-card">
          <img src="${resolvePath(pathPrefix, p.image)}" alt="${p.title}" loading="lazy" width="280" height="300">
                <div class="post-card-info">
                    <span class="post-card-tag">${p.tag}</span>
                    <h4 class="post-card-title">${p.title}</h4>
                    <span class="post-card-date">${new Date(p.date).toLocaleDateString('de-DE')}</span>
                </div>
            </a>`).join('');
    } catch (err) {
      logSiteError('Error loading related posts', err);
    }
}

