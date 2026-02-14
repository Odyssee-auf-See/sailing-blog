# Sailing Blog - Restructured Project

## New Project Structure

This project has been restructured following modern web development best practices.

### Folder Organization

```
new_blog/
├── index.html                          # Main entry point
├── css/
│   └── styles.css                     # All styles with updated asset paths
├── js/
│   └── script.js                      # All JavaScript with updated paths
├── assets/                            # All static assets
│   ├── images/
│   │   ├── backgrounds/               # Landing page backgrounds
│   │   │   └── background.jpg         (Copy from old: landing_page/background.jpg)
│   │   ├── blog/                      # Blog post images
│   │   │   └── blog_1.jpg - blog_15.jpg  (Copy from old: blog/images/)
│   │   └── profiles/                  # About section images
│   │       └── ueber_uns_image.jpg    (Copy from old: ueber_uns/ueber_uns_image.jpg)
│   └── svgs/                          # All vector graphics organized by type
│       ├── logos/                     # Logo files
│       │   ├── landing_page_logo.svg  (Rename: Logo.svg from landing_page/)
│       │   ├── menu_bar_logo.svg      (Rename: Logo.svg from menu_bar/)
│       │   └── footer_logo.svg        (Rename: Logo.svg from footer/)
│       ├── decorations/               # Decorative SVGs
│       │   ├── lea.svg                (Rename: Lea.svg from ueber_uns/)
│       │   ├── vito.svg               (Rename: Vito.svg from ueber_uns/)
│       │   ├── ueber_uns_blase_links.svg
│       │   ├── ueber_uns_blase_rechts.svg
│       │   └── welle_footer.svg       (Rename: Welle_Footer.svg from footer/)
│       ├── values/                    # "Unsere Werte" SVGs
│       │   ├── boat_symbol.svg
│       │   ├── boat_bubble.svg
│       │   ├── whale_symbol.svg
│       │   ├── whale_bubble.svg
│       │   ├── vogel_symbol.svg
│       │   ├── vogel_bubble.svg
│       │   ├── konsum_symbol.svg
│       │   └── konsum_bubble.svg
│       └── ui/                        # UI icons
│           └── sonne_icon.svg
├── components/                        # Reusable HTML components
│   ├── header/
│   │   └── menu_bar.html
│   ├── footer/
│   │   └── Footer.html
│   ├── landing/
│   │   └── landing_page.html
│   ├── about/
│   │   └── ueber_uns.html
│   └── values/
│       └── unsere_werte.html
├── pages/                             # Full pages
│   └── blog/
│       ├── blog.html
│       ├── post-template.html
│       └── posts/
│           └── post-1/
│               ├── post-1.html
│               └── assets/
│                   └── images/
│                       ├── photo1.jpg (Copy from old: blog/posts/assets/post-1/photo1.jpg)
│                       ├── photo2.jpg
│                       ├── photo3.jpg
│                       ├── photo4.jpg
│                       ├── IMG_3433.jpg
│                       ├── IMG_3434.jpg
│                       ├── IMG_3435.jpg
│                       └── IMG_3438.jpg
├── data/
│   └── blog_metadata.json            # Blog posts metadata
└── README.md                          # This file
```

## File Migration Guide

### Step 1: Copy SVG Files

Copy all SVG files from the old structure to the new `assets/svgs/` folders, renaming them as indicated:

**From old `landing_page/`:**
- Copy `Logo.svg` → `assets/svgs/logos/landing_page_logo.svg`

**From old `menu_bar/`:**
- Copy `Logo.svg` → `assets/svgs/logos/menu_bar_logo.svg`

**From old `footer/`:**
- Copy `Logo.svg` → `assets/svgs/logos/footer_logo.svg`
- Copy `Welle_Footer.svg` → `assets/svgs/decorations/welle_footer.svg`

**From old `ueber_uns/`:**
- Copy `Lea.svg` → `assets/svgs/decorations/lea.svg`
- Copy `Vito.svg` → `assets/svgs/decorations/vito.svg`
- Copy `ueber_uns_blase_links.svg` → `assets/svgs/decorations/ueber_uns_blase_links.svg`
- Copy `ueber_uns_blase_rechts.svg` → `assets/svgs/decorations/ueber_uns_blase_rechts.svg`

**From old `unsere_werte/`:**
- Copy all `*_symbol.svg` files → `assets/svgs/values/`
- Copy all `*_bubble.svg` files → `assets/svgs/values/`

### Step 2: Copy Image Files

**Background images:**
- Copy `landing_page/background.jpg` → `assets/images/backgrounds/background.jpg`
- Copy `images/background_1.jpg`, `background_original.jpg`, `titlecolorimg.jpg` → `assets/images/backgrounds/`

**Blog images:**
- Copy all `blog/images/blog_*.jpg` files → `assets/images/blog/`

**Profile images:**
- Copy `ueber_uns/ueber_uns_image.jpg` → `assets/images/profiles/ueber_uns_image.jpg`

**Blog post assets:**
- Copy `blog/posts/assets/post-1/*` files → `pages/blog/posts/post-1/assets/images/`

### Step 3: Optional - Icons

- Copy `images/icons/sonne_icon.svg` → `assets/svgs/ui/sonne_icon.svg`

## Using PowerShell to Copy Files

If you prefer, I can provide PowerShell commands to automate the file copying process. Just let me know!

## Key Changes

### Updated Paths
All CSS and JavaScript paths have been updated to reflect the new structure:

- Asset paths now use `assets/` root folder
- Component paths use `components/` folder structure
- Blog metadata path updated to `data/blog_metadata.json`
- All relative paths in JavaScript updated accordingly

### Benefits of New Structure
✅ Cleaner organization
✅ Better separation of concerns
✅ Easier to scale (add more SVG categories, image types, etc.)
✅ Professional file structure
✅ Industry-standard approach
✅ All original files preserved in the `sailing-blog` folder

## Notes
- The original project remains untouched in `sailing-blog/` folder
- All paths have been updated to work with the new structure
- The project maintains full functionality while being better organized
