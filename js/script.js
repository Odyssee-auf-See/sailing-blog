/* ============================================================
    INITIALIZATION
    ============================================================ */
async function loadPage() {
    // 1. Load Reusable Components
    if (typeof loadHTML === 'function') {
        // Load Menu
        await loadHTML('menu-bar', 'components/header/menu_bar.html');
        // Load Footer
        await loadHTML('footer', 'components/footer/Footer.html');
    }

    // 2. Initialize Page Content
    initHeroCarousel();
    initHybridGallery();
    loadRelatedPosts();
}

window.onload = loadPage;
document.addEventListener('keydown', e => {
    if(e.key === "Escape") closeHybridLightbox();
    if(document.getElementById('hybridLightbox').style.display === 'flex') {
        if(e.key === "ArrowRight") changeLightboxImage(1);
        if(e.key === "ArrowLeft") changeLightboxImage(-1);
    }
});




//######################################################//
//= laods HTML by file name and injects it into index ==//
//######################################################//

async function loadHTML(id, url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const container = document.getElementById(id);
    container.innerHTML = html;

    // Small delay to ensure the browser has painted the new HTML
    setTimeout(() => {
      if (url.includes('menu_bar.html')) initMenuBar?.();
      if (url.includes('ueber_uns.html')) initValuesToggle?.();
      if (url.includes('ueber_uns.html')) initUnsereWerte?.();
      if (url.includes('blog.html')) initBlog?.();
      if (url.includes('map.html')) initMap?.(id, { autoscale: true });
    }, 0);
    
  } catch (err) {
    console.error("Failed to load page part:", url, err);
  }
}


//#########################################################//
//= Funciton to  MenuBar & load Header-Burger Functions= ==//
//#########################################################//

function initMenuBar(){
  const burgerBtn = document.getElementById('burger');
  const menuDropdown = document.getElementById('menu-dropdown');
  const menuOverlay = document.getElementById('menu-overlay');
  const logoBtn = document.getElementById('logo-scroll-top'); // New reference

  // --- Scroll to Top Logic ---
  if (logoBtn) {
    logoBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // This makes the scroll "glide" instead of jump
      });
      
      // Optional: Close the menu if it was open when clicking the logo
      burgerBtn.classList.remove('active');
      menuDropdown.classList.remove('active');
      menuOverlay.classList.remove('active');
    });
  }

  // --- Burger Logic  ---
  burgerBtn.addEventListener('click', () => {
    burgerBtn.classList.toggle('active');
    menuDropdown.classList.toggle('active');
    menuOverlay.classList.toggle('active');
  });

  menuOverlay.addEventListener('click', () => {
    burgerBtn.classList.remove('active');
    menuDropdown.classList.remove('active');
    menuOverlay.classList.remove('active');
  });
}


//########################################//
//= Values Section Collapse/Expand ======//
//########################################//

function initValuesToggle() {
  const toggleBtn = document.getElementById('valuesToggleBtn');
  const valuesSection = document.getElementById('valuesSection');

  if (!toggleBtn || !valuesSection) return; // Exit if elements don't exist

  // Set initial state
  let isExpanded = false;

  toggleBtn.addEventListener('click', () => {
    isExpanded = !isExpanded;
    toggleBtn.setAttribute('aria-expanded', isExpanded);

    if (isExpanded) {
      // Expand
      const scrollHeight = valuesSection.scrollHeight;
      valuesSection.style.maxHeight = scrollHeight + 'px';
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
  });
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
//############################//
//=== Funktionen für Blog ===//
//############################//

let allPosts = [];
let showingAll = false; // Track state

// 1. Fetch and Initialize
async function initBlog() {
  try {
    const response = await fetch('data/blog_metadata.json');
    allPosts = await response.json();
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Initially only show the first 10
    renderGrid(allPosts.slice(0, 10));
    
    // Show/Hide "Load More" button based on total count
    updateLoadMoreButton(allPosts.length > 10);
  } catch (err) {
    console.error("Error loading blog data:", err);
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
  
  // Target the three separate columns
  const col1 = document.getElementById('col-1');
  const col2 = document.getElementById('col-2');
  const col3 = document.getElementById('col-3');
  
  // Clear everything
  featuredSection.innerHTML = '';
  if(col1) { col1.innerHTML = ''; col2.innerHTML = ''; col3.innerHTML = ''; }

  if (posts.length === 0) return;

  const [newest, ...others] = posts;

  // 1. Render Featured Box (Same as before)
  featuredSection.innerHTML = `
    <a href="${newest.url || '#'}" class="featured-box-link">
      <article class="featured-box">
        <div class="newest-post-label">Neuster Blogbeitrag</div>
        <div class="post-image-container">
          <img src="${newest.image}" alt="${newest.title}">
          <div class="image-overlay"><span>Weiterlesen</span></div>
        </div>
        <div class="post-meta">
          <span class="post-tag">${newest.tag}</span>
          <span class="post-date">${formatDate(newest.date)}</span>
        </div>
        <h2 class="post-title">${newest.title}</h2>
        <p class="post-description">${newest.description || ''}</p>
      </article>
    </a>`;

  // 2. Distribute others into columns 1, 2, and 3
  others.forEach((post, index) => {
    const cardHTML = `
      <a href="${post.url || '#'}" style="text-decoration:none; color:inherit;">
        <article class="blog-card">
          <div class="post-image-container">
            <img src="${post.image}" alt="${post.title}">
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

    // The Magic: This cycles 0, 1, 2, 0, 1, 2...
    if (index % 3 === 0) col1.innerHTML += cardHTML;
    else if (index % 3 === 1) col2.innerHTML += cardHTML;
    else col3.innerHTML += cardHTML;
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
    const allGalleryImages = document.querySelectorAll('.image-scroll-row img');
    
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
        const res = await fetch('data/blog_metadata.json');
        const posts = await res.json();
        const container = document.getElementById('relatedPostsRow');
        container.innerHTML = posts.map(p => `
            <a href="${p.url || '#'}" class="post-card">
                <img src="../../${p.image}" alt="${p.title}">
                <div class="post-card-info">
                    <span class="post-card-tag">${p.tag}</span>
                    <h4 class="post-card-title">${p.title}</h4>
                    <span class="post-card-date">${new Date(p.date).toLocaleDateString('de-DE')}</span>
                </div>
            </a>`).join('');
    } catch (err) { console.error(err); }
}

