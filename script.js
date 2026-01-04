
//=== Funciton to  MenuBar & load Header-Burger Functions====//
function initMenuBar(){
  const burgerBtn = document.getElementById('burger');
  const menuDropdown = document.getElementById('menuDropdown');
  const menuOverlay = document.getElementById('menuOverlay');
  const logoBtn = document.getElementById('logoScrollTop'); // New reference

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


//=== laods HTML by file name and injects it into index ====//
async function loadHTML(id, url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const container = document.getElementById(id);
    container.innerHTML = html;

    // Small delay to ensure the browser has painted the new HTML
    setTimeout(() => {
      if (url.includes('menu_bar.html')) initMenuBar?.();
      if (url.includes('blog.html')) loadPosts?.();
    }, 0);
    
  } catch (err) {
    console.error("Failed to load page part:", url, err);
  }
}


//=== Function to load Blog Elements into the Grid ===//
async function loadPosts() {
  const response = await fetch("blog/blog_metadata.json");
  const posts = await response.json();

  // Sort by date (newest first)
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  const grid = document.querySelector(".blog-grid");
  grid.innerHTML = ""; // clear previous content

  let rowIndex = 0;

  for (let i = 0; i < posts.length; ) {
    rowIndex++;
    const row = document.createElement("div");
    row.classList.add("blog-row");

    // Pattern logic (repeats every 4 rows)
    const pattern = rowIndex % 4;

    if (pattern === 1) {
      // Row 1: 2/3 + 1/3
      appendPost(row, posts[i++], "two-third");
      if (posts[i]) appendPost(row, posts[i++], "one-third");
    } else if (pattern === 2) {
      // Row 2: 1/3 + 1/3 + 1/3
      for (let j = 0; j < 3 && posts[i]; j++) appendPost(row, posts[i++], "one-third");
    } else if (pattern === 3) {
      // Row 3: 1/3 + 2/3
      if (posts[i]) appendPost(row, posts[i++], "one-third");
      if (posts[i]) appendPost(row, posts[i++], "two-third");
    } else {
      // Row 4: 1/3 + 1/3 + 1/3
      for (let j = 0; j < 3 && posts[i]; j++) appendPost(row, posts[i++], "one-third");
    }

    grid.appendChild(row);
  }
}

// Helper to create post elements
function appendPost(row, post, sizeClass) {
  const postDiv = document.createElement("div");
  postDiv.classList.add("blog-post", sizeClass);
  postDiv.innerHTML = `
    <a href="${post.link}">
      <img src="${post.image}" alt="${post.title}">
      <div class="overlay">${post.title}</div>
    </a>
  `;
  row.appendChild(postDiv);
}





