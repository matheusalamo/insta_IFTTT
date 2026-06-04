const fs = require('fs');
const path = require('path');
const express = require('express');
const InstagramScraper = require('./instagram');
const DiscordNotifier = require('./discord');
const Database = require('./database');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const PORT = process.env.PORT || 10000;

function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

  cfg.discord_webhook_url = process.env.DISCORD_WEBHOOK_URL || cfg.discord_webhook_url;
  if (process.env.INSTAGRAM_PROFILES) {
    cfg.instagram_profiles = process.env.INSTAGRAM_PROFILES.split(',').map(s => s.trim());
  }
  if (process.env.POLLING_INTERVAL) {
    cfg.polling_interval_minutes = parseInt(process.env.POLLING_INTERVAL, 10);
  }
  if (process.env.MAX_POSTS_PER_CHECK) {
    cfg.max_posts_per_check = parseInt(process.env.MAX_POSTS_PER_CHECK, 10);
  }

  if (!cfg.discord_webhook_url || cfg.discord_webhook_url === '__DISCORD_WEBHOOK_URL__') {
    console.error('[Config] DISCORD_WEBHOOK_URL não configurada');
    process.exit(1);
  }

  return cfg;
}

let lastCheck = null;
let lastError = null;
let running = false;

async function processAccounts(config) {
  if (running) return;
  running = true;

  const scraper = new InstagramScraper(config.headless);
  const discord = new DiscordNotifier(config.discord_webhook_url);
  const db = new Database(config.data_dir || './data');

  console.log('[Sistema] Verificando novos posts...');
  try {
    const posts = await scraper.scrapeMultipleProfiles(
      config.instagram_profiles || [],
      config.max_posts_per_check || 5
    );

    let novos = 0;
    for (const post of posts) {
      if (db.isNew(post.shortCode)) {
        await discord.sendPost(post);
        db.markSeen(post.shortCode);
        novos++;
      }
    }
    lastCheck = new Date().toISOString();
    console.log(`[Sistema] OK. ${novos} novo(s) post(s) enviado(s).`);
  } catch (err) {
    lastError = err.message;
    console.error(`[Sistema] Erro: ${err.message}`);
  } finally {
    running = false;
  }
}

function startServer(config) {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      lastCheck,
      lastError,
      running,
      uptime: process.uptime()
    });
  });

  app.listen(PORT, () => {
    console.log(`[Server] Rodando na porta ${PORT}`);
  });
}

async function main() {
  const config = loadConfig();
  startServer(config);

  const isOnce = process.argv.includes('--once');

  if (isOnce) {
    await processAccounts(config);
  } else {
    setTimeout(() => processAccounts(config), 5000);
    setInterval(
      () => processAccounts(config),
      config.polling_interval_minutes * 60 * 1000
    );
  }
}

main().catch(console.error);
