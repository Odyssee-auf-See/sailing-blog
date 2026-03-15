#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const METADATA_PATH = path.join(ROOT_DIR, 'data', 'blog_metadata.json');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.heic']);
const NATURAL_COLLATOR = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetSlug = readArgValue('--slug');

function readArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return '';
  return String(args[index + 1]).trim();
}

function normalizeToPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function toAltFromFilename(fileName) {
  return fileName
    .replace(path.extname(fileName), '')
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function listImageFiles(directoryAbsolutePath) {
  if (!fs.existsSync(directoryAbsolutePath)) return [];

  const entries = fs.readdirSync(directoryAbsolutePath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => NATURAL_COLLATOR.compare(a, b))
    .map((fileName) => {
      const fullPath = path.join(directoryAbsolutePath, fileName);
      const relativePath = path.relative(ROOT_DIR, fullPath);
      return {
        src: normalizeToPosix(relativePath),
        alt: toAltFromFilename(fileName),
      };
    });
}

function getAutoImageConfig(post) {
  const legacyBase = typeof post.imageFolder === 'string' ? post.imageFolder.trim() : '';
  const auto = post.autoImageFolders || {};
  const base = typeof auto.base === 'string' && auto.base.trim() ? auto.base.trim() : legacyBase;

  if (!base) return null;

  const heroFolder = typeof auto.hero === 'string' && auto.hero.trim() ? auto.hero.trim() : 'heroImages';
  const galleries = Array.isArray(auto.galleries) && auto.galleries.length > 0
    ? auto.galleries.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim())
    : ['gallery1', 'gallery2', 'gallery3', 'gallery4'];

  return { base, heroFolder, galleries };
}

function syncPostImages(post) {
  const config = getAutoImageConfig(post);
  if (!config) return { changed: false, reason: 'no-config' };

  const postBaseAbs = path.join(ROOT_DIR, config.base);
  const heroDirAbs = path.join(postBaseAbs, config.heroFolder);
  const heroImages = listImageFiles(heroDirAbs);

  let changed = false;
  const summary = {
    slug: post.slug || post.id || 'unknown',
    heroCount: 0,
    galleryCounts: [],
  };

  if (heroImages.length > 0) {
    post.heroImages = heroImages;
    summary.heroCount = heroImages.length;
    changed = true;
  }

  const sections = Array.isArray(post.sections) ? [...post.sections] : [];

  config.galleries.forEach((galleryFolderName, index) => {
    const galleryImages = listImageFiles(path.join(postBaseAbs, galleryFolderName));
    summary.galleryCounts.push(galleryImages.length);

    if (galleryImages.length === 0) return;

    if (!sections[index]) {
      sections[index] = {
        title: `Abschnitt ${index + 1}`,
        html: '',
        gallery: [],
      };
    }

    sections[index] = {
      ...sections[index],
      gallery: galleryImages,
    };

    changed = true;
  });

  if (changed) {
    post.sections = sections;

    if (!post.image) {
      const fallbackImage = post.heroImages?.[0]?.src || post.sections?.[0]?.gallery?.[0]?.src || '';
      if (fallbackImage) post.image = fallbackImage;
    }
  }

  return { changed, reason: 'synced', summary };
}

function main() {
  if (!fs.existsSync(METADATA_PATH)) {
    console.error(`[sync-blog-images] Metadata file not found: ${METADATA_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(METADATA_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const posts = Array.isArray(parsed.posts) ? parsed.posts : [];

  let changedPosts = 0;
  let touchedPosts = 0;

  posts.forEach((post) => {
    if (targetSlug && !(post.slug === targetSlug || post.id === targetSlug)) {
      return;
    }

    touchedPosts += 1;
    const result = syncPostImages(post);

    if (result.reason === 'no-config') {
      console.log(`[sync-blog-images] Skip ${post.slug || post.id || 'unknown'}: missing imageFolder/autoImageFolders.base`);
      return;
    }

    if (result.changed) {
      changedPosts += 1;
      const galleryInfo = result.summary.galleryCounts.map((count, i) => `g${i + 1}=${count}`).join(', ');
      console.log(`[sync-blog-images] Updated ${result.summary.slug}: hero=${result.summary.heroCount}, ${galleryInfo}`);
    } else {
      console.log(`[sync-blog-images] No images found for ${post.slug || post.id || 'unknown'} (kept existing metadata)`);
    }
  });

  if (targetSlug && touchedPosts === 0) {
    console.error(`[sync-blog-images] No post found for --slug ${targetSlug}`);
    process.exit(1);
  }

  if (!dryRun && changedPosts > 0) {
    fs.writeFileSync(METADATA_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
    console.log(`[sync-blog-images] Wrote ${changedPosts} post(s) to data/blog_metadata.json`);
  } else if (dryRun) {
    console.log(`[sync-blog-images] Dry run complete. ${changedPosts} post(s) would be updated.`);
  } else {
    console.log('[sync-blog-images] No changes written.');
  }
}

main();
