const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => res.status(200).send('OK'));

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return 'Unknown';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getYouTubeId(url) {
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
    /(?:https?:\/\/)?youtu\.be\/([^?]+)/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^/?]+)/
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}
function getVimeoId(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
const VID_EXTS = ['.mp4', '.webm', '.ogv', '.mov', '.avi', '.mkv'];

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

app.get('/api/fetch-info', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

    const pathname = parsed.pathname.toLowerCase();
    const ext = pathname.substring(pathname.lastIndexOf('.'));

    if (IMG_EXTS.includes(ext)) {
      let size = null;
      try {
        const head = await axios.head(url, { headers, timeout: 5000 });
        size = parseInt(head.headers['content-length'], 10) || null;
      } catch (e) {}
      return res.json({ type: 'image', title: '', description: '', imageUrl: url, size, sizeFormatted: size ? formatBytes(size) : null });
    }

    if (VID_EXTS.includes(ext)) {
      let size = null;
      try {
        const head = await axios.head(url, { headers, timeout: 5000 });
        size = parseInt(head.headers['content-length'], 10) || null;
      } catch (e) {}
      return res.json({ type: 'video', title: '', description: '', videoUrl: url, size, sizeFormatted: size ? formatBytes(size) : null, platform: 'direct' });
    }

    const ytId = getYouTubeId(url);
    if (ytId) {
      let title = '', embedHtml = `<iframe src="https://www.youtube.com/embed/${ytId}" allowfullscreen></iframe>`, thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      try {
        const { data } = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { timeout: 5000 });
        title = data.title || '';
        embedHtml = data.html || embedHtml;
        thumbnail = data.thumbnail_url || thumbnail;
      } catch (e) {}
      return res.json({ type: 'video', title, description: '', platform: 'youtube', videoId: ytId, thumbnail, embedHtml });
    }

    const vimeoId = getVimeoId(url);
    if (vimeoId) {
      let title = '', description = '', embedHtml = `<iframe src="https://player.vimeo.com/video/${vimeoId}" allowfullscreen></iframe>`, thumbnail = '';
      try {
        const { data } = await axios.get(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`, { timeout: 5000 });
        title = data.title || '';
        description = data.description || '';
        embedHtml = data.html || embedHtml;
        thumbnail = data.thumbnail_url || '';
      } catch (e) {}
      return res.json({ type: 'video', title, description, platform: 'vimeo', videoId: vimeoId, thumbnail, embedHtml });
    }

    // Generic page
    let html = '';
    try {
      const response = await axios.get(url, { headers, timeout: 8000, maxRedirects: 5 });
      html = response.data;
    } catch (e) {
      return res.json({ type: 'link', title: '', description: '', imageUrl: '' });
    }

    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogVideo = $('meta[property="og:video"]').attr('content') || '';

    if (ogVideo && VID_EXTS.some(ext => ogVideo.toLowerCase().endsWith(ext))) {
      let size = null;
      try {
        const head = await axios.head(ogVideo, { headers, timeout: 5000 });
        size = parseInt(head.headers['content-length'], 10) || null;
      } catch (e) {}
      return res.json({ type: 'video', title, description, videoUrl: ogVideo, size, sizeFormatted: size ? formatBytes(size) : null, platform: 'direct' });
    }

    return res.json({ type: 'link', title, description, imageUrl: ogImage });
  } catch (err) {
    console.error(err.message);
    return res.json({ type: 'link', title: '', description: '', imageUrl: '' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
