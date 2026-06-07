(function() {
  const STORAGE_KEY = 'bookmarks_data';
  const DATA_SAVER_KEY = 'data_saver_enabled';

  const addBtn = document.getElementById('addBtn');
  const formContainer = document.getElementById('formContainer');
  const urlInput = document.getElementById('urlInput');
  const fetchBtn = document.getElementById('fetchBtn');
  const fetchStatus = document.getElementById('fetchStatus');
  const editFields = document.getElementById('editFields');
  const titleInput = document.getElementById('titleInput');
  const descInput = document.getElementById('descInput');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const bookmarksList = document.getElementById('bookmarksList');
  const dataSaverToggle = document.getElementById('dataSaverToggle');

  let bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let dataSaverEnabled = localStorage.getItem(DATA_SAVER_KEY) === 'true';
  dataSaverToggle.checked = dataSaverEnabled;
  let pendingBookmark = null;

  function saveBookmarks() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); }

  function renderBookmarks() {
    if (!bookmarks.length) {
      bookmarksList.innerHTML = '<p style="color: var(--text-secondary);">No bookmarks yet. Add one!</p>';
      return;
    }
    bookmarksList.innerHTML = bookmarks.map((bm, index) => {
      let mediaHtml = '', qualityHtml = '';
      if (bm.type === 'image') {
        mediaHtml = `<img src="${bm.imageUrl}" alt="${escapeHtml(bm.title)}" loading="lazy" />`;
        if (dataSaverEnabled && bm.sizeFormatted) mediaHtml += `<div class="size-info">📦 Size: ${bm.sizeFormatted}</div>`;
      } else if (bm.type === 'video') {
        if (bm.platform === 'youtube') {
          const videoId = bm.videoId;
          const quality = bm.quality || 'auto';
          mediaHtml = `<iframe src="https://www.youtube.com/embed/${videoId}?vq=${quality}" allowfullscreen></iframe>`;
          if (dataSaverEnabled) {
            qualityHtml = `<div class="quality-selector">
              <label>🎥 Quality:</label>
              <select data-index="${index}" class="quality-dropdown">
                <option value="auto" ${quality==='auto'?'selected':''}>Auto</option>
                <option value="small" ${quality==='small'?'selected':''}>144p</option>
                <option value="medium" ${quality==='medium'?'selected':''}>360p</option>
                <option value="large" ${quality==='large'?'selected':''}>480p</option>
                <option value="hd720" ${quality==='hd720'?'selected':''}>720p</option>
                <option value="hd1080" ${quality==='hd1080'?'selected':''}>1080p</option>
              </select></div>`;
          }
        } else if (bm.platform === 'vimeo') {
          mediaHtml = bm.embedHtml || `<iframe src="https://player.vimeo.com/video/${bm.videoId}" allowfullscreen></iframe>`;
        } else if (bm.platform === 'direct') {
          mediaHtml = `<video controls preload="none" src="${bm.videoUrl}"></video>`;
          if (dataSaverEnabled && bm.sizeFormatted) mediaHtml += `<div class="size-info">📦 Size: ${bm.sizeFormatted}</div>`;
        }
      } else if (bm.type === 'link') {
        mediaHtml = `<div class="link-preview">
          ${bm.imageUrl ? `<img src="${bm.imageUrl}" alt="preview" />` : ''}
          <a href="${bm.url}" target="_blank" rel="noopener">${bm.url}</a></div>`;
      }
      return `<div class="bookmark-card" data-index="${index}">
        <div class="card-header"><div class="card-title">${escapeHtml(bm.title || 'Untitled')}</div><button class="delete-btn" data-index="${index}">🗑️</button></div>
        ${bm.description ? `<div class="card-description">${escapeHtml(bm.description)}</div>` : ''}
        <div class="card-media">${mediaHtml}</div>${qualityHtml}</div>`;
    }).join('');

    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', e => deleteBookmark(parseInt(btn.dataset.index, 10))));
    document.querySelectorAll('.quality-dropdown').forEach(sel => sel.addEventListener('change', e => changeQuality(parseInt(sel.dataset.index, 10), sel.value)));
  }

  function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
  function deleteBookmark(i) { bookmarks.splice(i,1); saveBookmarks(); renderBookmarks(); }
  function changeQuality(i, q) { bookmarks[i].quality = q; saveBookmarks(); renderBookmarks(); }

  dataSaverToggle.addEventListener('change', e => {
    dataSaverEnabled = e.target.checked;
    localStorage.setItem(DATA_SAVER_KEY, dataSaverEnabled);
    renderBookmarks();
  });

  addBtn.addEventListener('click', () => {
    formContainer.classList.remove('hidden');
    urlInput.value = ''; titleInput.value = ''; descInput.value = '';
    editFields.classList.add('hidden'); fetchStatus.textContent = ''; pendingBookmark = null;
    urlInput.focus();
  });
  cancelBtn.addEventListener('click', () => { formContainer.classList.add('hidden'); pendingBookmark = null; });

  fetchBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) { fetchStatus.textContent = 'Please enter a valid URL.'; return; }
    fetchStatus.textContent = '⏳ Fetching info...'; fetchBtn.disabled = true;
    try {
      const res = await fetch(`/api/fetch-info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      pendingBookmark = {
        url, type: data.type, title: data.title || '', description: data.description || '',
        imageUrl: data.imageUrl || null, videoUrl: data.videoUrl || null,
        platform: data.platform || null, videoId: data.videoId || null,
        embedHtml: data.embedHtml || null, thumbnail: data.thumbnail || null,
        size: data.size || null, sizeFormatted: data.sizeFormatted || null, quality: 'auto'
      };
      titleInput.value = pendingBookmark.title; descInput.value = pendingBookmark.description;
      editFields.classList.remove('hidden'); fetchStatus.textContent = '✅ Info fetched. Edit if needed and save.';
    } catch (err) {
      fetchStatus.textContent = '❌ Failed to fetch info. You can still save manually.';
      pendingBookmark = { url, type:'link', title:'', description:'', imageUrl:null, videoUrl:null, platform:null, videoId:null, embedHtml:null, thumbnail:null, size:null, sizeFormatted:null, quality:'auto' };
      editFields.classList.remove('hidden');
    } finally { fetchBtn.disabled = false; }
  });

  saveBtn.addEventListener('click', () => {
    if (!pendingBookmark) return;
    pendingBookmark.title = titleInput.value.trim(); pendingBookmark.description = descInput.value.trim();
    bookmarks.push(pendingBookmark); saveBookmarks();
    formContainer.classList.add('hidden'); pendingBookmark = null; renderBookmarks();
  });

  renderBookmarks();
})();
