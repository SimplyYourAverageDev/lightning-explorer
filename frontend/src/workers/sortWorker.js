// Sort worker: offloads sorting off the main thread.
// Receives: { files, sortBy, sortOrder }
// Sends back: { ok: true, files }

self.onmessage = (e) => {
  try {
    const { files, sortBy, sortOrder } = e.data || {};
    if (!Array.isArray(files) || files.length === 0) {
      self.postMessage({ ok: true, files: files || [] });
      return;
    }

    const order = sortOrder === 'desc' ? -1 : 1;

    const getExt = (f) => {
      if (f.isDir) return 'folder';
      if (f.extension) return String(f.extension).toLowerCase();
      const name = f.name || '';
      const idx = name.lastIndexOf('.');
      return idx !== -1 ? name.slice(idx + 1).toLowerCase() : '';
    };

    const toTs = (m) => (typeof m === 'number' ? m : Date.parse(m) || 0);

    const out = files.slice().sort((a, b) => {
      switch (sortBy) {
        case 'size': {
          const as = a.isDir ? 0 : (a.size || 0);
          const bs = b.isDir ? 0 : (b.size || 0);
          return as === bs ? 0 : (as < bs ? -order : order);
        }
        case 'type': {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          const ta = getExt(a);
          const tb = getExt(b);
          if (ta === tb) return 0;
          return ta < tb ? -order : order;
        }
        case 'modified': {
          const am = toTs(a.modTime);
          const bm = toTs(b.modTime);
          if (am === bm) return 0;
          return am < bm ? -order : order;
        }
        case 'name':
        default: {
          const an = String(a.name || '').toLowerCase();
          const bn = String(b.name || '').toLowerCase();
          if (an === bn) return 0;
          return an < bn ? -order : order;
        }
      }
    });

    self.postMessage({ ok: true, files: out });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};

