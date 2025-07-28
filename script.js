
//=== Funciton to move the landing page title to the top of the screen ====//
function initLandingPage() {
  const title = document.getElementById('mainTitle');
  if (!title) {
    console.warn('mainTitle element not found!');
    return;
  }

  window.addEventListener('scroll', () => {
    const offset = window.scrollY;
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
  });
}


//=== laods HTML by file name and injects it into index ====//
async function loadHTML(id, url) {
const res = await fetch(url);
const html = await res.text();
document.getElementById(id).innerHTML = html;

if (url === 'landing_page.html') {
    // Wait a tick to ensure elements are in DOM
    setTimeout(() => {
    if (typeof initLandingPage === 'function') {
        initLandingPage();
    }
    }, 0);
}
}

