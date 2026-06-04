const fs = require('fs');
const path = require('path');

class Database {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'seen_posts.json');
    this.seenPosts = new Set();
    this.init();
  }

  init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (fs.existsSync(this.filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        this.seenPosts = new Set(data);
      } catch {
        this.seenPosts = new Set();
      }
    }
  }

  isNew(postId) {
    return !this.seenPosts.has(postId);
  }

  markSeen(postId) {
    this.seenPosts.add(postId);
    this.save();
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify([...this.seenPosts], null, 2));
  }
}

module.exports = Database;
