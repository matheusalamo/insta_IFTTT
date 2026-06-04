const axios = require('axios');

class DiscordNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  async sendPost(post) {
    const embed = {
      title: `@${post.username}`,
      url: post.url,
      color: 0xE1306C,
      description: post.caption ? post.caption.substring(0, 200) : '',
      fields: [
        { name: '❤️ Likes', value: `${post.likes}`, inline: true },
        { name: '💬 Comentários', value: `${post.comments}`, inline: true }
      ],
      image: { url: post.imageUrl },
      footer: { text: 'Instagram to Discord' },
      timestamp: new Date().toISOString()
    };

    try {
      await axios.post(this.webhookUrl, { embeds: [embed] });
      console.log(`[Discord] Post enviado: ${post.shortCode}`);
    } catch (err) {
      console.error(`[Discord] Erro ao enviar: ${err.message}`);
    }
  }
}

module.exports = DiscordNotifier;
