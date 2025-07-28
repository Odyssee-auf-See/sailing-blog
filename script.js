
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
  

}

