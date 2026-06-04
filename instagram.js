const puppeteer = require('puppeteer-core');

class InstagramScraper {
  constructor(headless = true) {
    this.headless = headless;
  }

  async launchBrowser() {
    return puppeteer.launch({
      headless: this.headless ? 'new' : false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  async newPage(browser) {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });
    return page;
  }

  async scrapeProfile(username, maxPosts = 5) {
    const browser = await this.launchBrowser();
    try {
      const page = await this.newPage(browser);
      await page.goto(`https://www.instagram.com/${username}/`, {
        waitUntil: 'networkidle2', timeout: 30000
      });
      await page.waitForSelector('article a[href*="/p/"]', { timeout: 15000 }).catch(() => {});

      const shortCodes = await page.evaluate((max) => {
        const links = document.querySelectorAll('article a[href*="/p/"]');
        const seen = new Set();
        const codes = [];
        for (const link of links) {
          if (codes.length >= max) break;
          const m = link.getAttribute('href').match(/\/p\/([^/]+)/);
          if (m && !seen.has(m[1])) { seen.add(m[1]); codes.push(m[1]); }
        }
        return codes;
      }, maxPosts);

      const posts = [];
      for (const code of shortCodes) {
        const post = await this.scrapePost(browser, code, username);
        if (post) posts.push(post);
      }
      return posts;
    } finally {
      await browser.close();
    }
  }

  async scrapePost(browser, shortCode, username) {
    const page = await this.newPage(browser);
    try {
      await page.goto(`https://www.instagram.com/p/${shortCode}/`, {
        waitUntil: 'networkidle2', timeout: 30000
      });
      await page.waitForTimeout(2000);

      const data = await page.evaluate(() => {
        const getText = (sel) => {
          const el = document.querySelector(sel);
          return el ? el.textContent.trim() : '';
        };

        const ogImage = document.querySelector('meta[property="og:image"]');
        const image = ogImage ? ogImage.getAttribute('content') : '';

        const caption = getText('meta[property="og:description"]');

        let likes = 0;
        const likeEl = document.querySelector('section a[href$="/likes/"] span, section span');
        if (likeEl) {
          const t = likeEl.textContent.replace(/[^0-9]/g, '');
          likes = parseInt(t, 10) || 0;
        }

        let comments = 0;
        const commentTexts = document.querySelectorAll('ul li span');
        for (const el of commentTexts) {
          const t = el.textContent.toLowerCase();
          if (t.includes('comment') || t.includes('resposta') || t.includes('comentário')) {
            const n = t.replace(/[^0-9]/g, '');
            comments = parseInt(n, 10) || 0;
            break;
          }
        }

        return { image, caption, likes, comments };
      });

      const result = {
        shortCode,
        url: `https://www.instagram.com/p/${shortCode}/`,
        imageUrl: data.image,
        caption: data.caption,
        likes: data.likes,
        comments: data.comments,
        username
      };

      console.log(`  [Post] @${username} /p/${shortCode} — ${result.likes} likes, ${result.comments} comments`);
      return result;
    } catch (err) {
      console.error(`  [Post] Erro /p/${shortCode}: ${err.message}`);
      return {
        shortCode, url: `https://www.instagram.com/p/${shortCode}/`,
        imageUrl: '', caption: '', likes: 0, comments: 0, username
      };
    } finally {
      await page.close();
    }
  }

  extractUsername(profileUrl) {
    const match = profileUrl.match(/(?:instagram\.com\/)([^/?]+)/);
    return match ? match[1] : profileUrl;
  }

  async scrapeMultipleProfiles(profiles, maxPostsPerProfile = 5) {
    const allPosts = [];
    for (const profile of profiles) {
      const username = this.extractUsername(profile);
      console.log(`[Instagram] Scraping @${username}...`);
      try {
        const posts = await this.scrapeProfile(username, maxPostsPerProfile);
        allPosts.push(...posts);
        console.log(`[Instagram] @${username}: ${posts.length} posts encontrados`);
      } catch (err) {
        console.error(`[Instagram] Erro em @${username}: ${err.message}`);
      }
    }
    return allPosts;
  }
}

module.exports = InstagramScraper;
