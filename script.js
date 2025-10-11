
//=== Funciton to move the landing page title to the top of the screen ====//
function initLandingPage() {
  const title = document.getElementById('mainTitle');
  if (!title) {
    console.warn('mainTitle element not found!');
    return;
  }

  //Title Background Image 
  const backgroundImage = document.getElementById("titleBackgroundImage");

  window.addEventListener('scroll', () => {
    //offset --> scroll point of Y-Axis on Screen
    const offset = window.scrollY;
    //trigger point for when the title moves to the top of the screen (when 30% of the scren is scrolled past)
    const triggertitle = window.innerHeight * 0.3;

    if (offset > triggertitle) {
      if (!title.classList.contains('sticky')) {
        title.classList.add('sticky');
      }
    } else {
      if (title.classList.contains('sticky')) {
        title.classList.remove('sticky');
      }
    }
  
    // variable for the bottom edge of the Title Backgorund Image
    const imageBottom = backgroundImage.getBoundingClientRect().bottom;
    // Trigger 2: hide title when it's no longer above the background image
    if (imageBottom <= 0) {
      mainTitle.classList.remove("sticky"); 
    } 
  
  
  });
}

//=== Funciton to Header & load Header-Burger Functions====//
function initHeader(){
  const burger = document.getElementById('burger');
  const menuDropdown = document.getElementById('menuDropdown');

  burger.addEventListener('click', () => {
    const isOpen = menuDropdown.classList.toggle('open');
    burger.setAttribute('aria-expanded', isOpen);
    menuDropdown.setAttribute('aria-hidden', !isOpen);
  });
}


//=== laods HTML by file name and injects it into index ====//
async function loadHTML(id, url) {
const res = await fetch(url);
const html = await res.text();
document.getElementById(id).innerHTML = html;

  //load functions for each page
  if (url === 'landing_page.html' && typeof initLandingPage === 'function') {
    initLandingPage();
  }
  if (url === 'header.html' && typeof initHeader === 'function') {
    initHeader();
  }
  if (url === 'blog.html' && typeof loadPosts() === 'function') {
    loadPosts();
  }

}


//=== Funciton to load Blog Elements and order them ====//
async function loadPosts() {
  const response = await fetch("blog/blog_metadata.json");
  const posts = await response.json();

  // Sort by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Featured (first one)
  const newest = posts[0];
  document.querySelector(".blog-new").innerHTML = `
    <img src="${newest.image}" alt="${newest.title}">
    <div class="blog-new-content">
      <h2>${newest.title}</h2>
      <p>${newest.summary}</p>
      <button class="wave-button" onclick="location.href='${newest.link}'">
          <div class="text">Mehr</div>
          <div class="wave"></div>
      </button>
    </div>
  `;

  // Older ones (next 6)
  const blogRest = document.querySelector(".blog-rest");
  blogRest.innerHTML = posts.slice(1, 7).map(post => `
    <div class="blog-card">
      <img src="${post.image}" alt="${post.title}">
      <div class="blog-card-content">
        <h3>${post.title}</h3>
      </div>
    </div>
  `).join("");
}




