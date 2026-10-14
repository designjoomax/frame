(() => {
  const { frames: FRAME_LIST, maxBytes: MAX } = window.JOOMAX_CONFIG;
  const $ = (s) => document.querySelector(s);
  const MAXZ = 4, MIN_ZOOM = 0.2, PREVIEW_W = 640, BLUR_DEFAULT = 20, BLUR_MAX = 100;
  const HEIC_SRCS = ["js/vendor/heic2any.min.js", "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"];
  const state = { frames: [], current: 0, per: false, items: [] };
  const frameIdx = (it) => (state.per ? it.frameIdx : state.current);
  const frameOf = (it) => state.frames[frameIdx(it)].img;

  // ---------- Util ----------
  const loadImage = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("gagal load " + src));
    img.src = src;
  });
  const toBlob = (c, type, q) => new Promise((res, rej) => { try { c.toBlob(res, type, q); } catch (e) { rej(e); } });
  const fmt = (b) => (b / 1024 / 1024).toFixed(2) + " MB";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Skala zoom: -100 (kecil, 0.2x) .. 0 (pas memenuhi frame) .. +100 (besar, 4x)
  const fromZ = (z) => (z >= 0 ? Math.pow(MAXZ, z / 100) : Math.pow(MIN_ZOOM, -z / 100));
  const toZ = (f) => (f >= 1 ? (100 * Math.log(f)) / Math.log(MAXZ) : (-100 * Math.log(f)) / Math.log(MIN_ZOOM));
  const newCanvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

  // Frame contoh otomatis kalau file PNG belum ada
  function placeholderFrame(i) {
    const red = "#ff0022", dark = "#1f1f1f";
    const cfg = [[red, 70], [dark, 70], [red, 30], [dark, 110], [red, 50]][i % 5];
    const c = newCanvas(1080, 1080), g = c.getContext("2d");
    g.strokeStyle = cfg[0]; g.lineWidth = cfg[1] * 2;
    g.strokeRect(0, 0, 1080, 1080);
    g.fillStyle = cfg[0]; g.fillRect(340, 990, 400, 90);
    g.fillStyle = "#fff"; g.font = "bold 44px system-ui,sans-serif"; g.textAlign = "center";
    g.fillText("JOOMAX", 540, 1050);
    return c.toDataURL("image/png");
  }

  // ---------- Frame ----------
  // Frame yang sudah disematkan (js/frames-data.js) dipakai lebih dulu, sehingga jalan tanpa server
  const FRAME_DATA = window.JOOMAX_FRAME_DATA || {};
  const frameSrc = (src) => FRAME_DATA[src.split("/").pop()] || src;
  async function loadFrames() {
    state.frames = await Promise.all(FRAME_LIST.map(async (f, i) => {
      try { const src = frameSrc(f.src); return { name: f.name, img: await loadImage(src), src }; }
      catch { console.warn("Frame tidak ditemukan, pakai contoh:", f.src);
        const src = placeholderFrame(i); return { name: f.name, img: await loadImage(src), src }; }
    }));
    // Frame dari file:// membuat canvas "tainted" sehingga download diblokir browser. Beri peringatan jelas.
    const bad = state.frames.some((f) => { try { const g = newCanvas(1, 1).getContext("2d"); g.drawImage(f.img, 0, 0, 1, 1); g.getImageData(0, 0, 1, 1); return false; } catch { return true; } });
    if (bad) { const w = $("#warn"); w.hidden = false;
      w.textContent = "Download diblokir browser karena frame dibaca dari file lokal. Solusi tanpa server: buka tools/embed-frames.html, pilih frame1-5.png, lalu simpan hasilnya sebagai js/frames-data.js. Atau jalankan lewat server / GitHub Pages."; }
    const box = $("#frames");
    state.frames.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "frame"; b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", i === state.current);
      b.innerHTML = `<img alt="" src="${f.src}"><span>${f.name}</span>`;
      b.onclick = () => { state.current = i;
        box.querySelectorAll(".frame").forEach((x, j) => x.setAttribute("aria-checked", j === i));
        state.items.forEach((it) => (it.frameIdx = i)); syncPickers();
        state.items.forEach(refresh); };
      box.appendChild(b);
    });
  }

  // ---------- Blur ----------
  // Safari lama tidak punya ctx.filter, jadi ada cadangan: box blur 3x (hasilnya mendekati Gaussian)
  const HAS_FILTER = (() => { const g = newCanvas(1, 1).getContext("2d"); g.filter = "blur(2px)"; return g.filter === "blur(2px)"; })();
  function boxLine(src, dst, start, stride, n, r) {
    for (let c = 0; c < 4; c++) {
      const s0 = start + c, at = (i) => src[s0 + clamp(i, 0, n - 1) * stride];
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += at(i);
      for (let i = 0; i < n; i++) { dst[s0 + i * stride] = sum / (2 * r + 1); sum += at(i + r + 1) - at(i - r); }
    }
  }
  function blurData(img, sigma) {
    const { width: w, height: h, data } = img, r = Math.max(1, Math.round(sigma));
    const tmp = new Uint8ClampedArray(data.length);
    for (let p = 0; p < 3; p++) {
      for (let y = 0; y < h; y++) boxLine(data, tmp, y * w * 4, 4, w, r);
      for (let x = 0; x < w; x++) boxLine(tmp, data, x * 4, w * 4, h, r);
    }
  }
  // Layer blur: foto yang sama, ukuran "cover", diperbesar sedikit supaya tepinya tidak pudar
  function blurLayer(it, W, H, sigma, cache) {
    const key = [W, H, sigma.toFixed(2)].join();
    if (cache && it.bk === key) return it.bc;
    const bw = it.bitmap.width, bh = it.bitmap.height, m = Math.ceil(sigma * 2.5);
    const s = Math.max((W + 2 * m) / bw, (H + 2 * m) / bh), w = bw * s, h = bh * s;
    const c = newCanvas(W, H), g = c.getContext("2d");
    if (sigma < 0.3 || HAS_FILTER) {
      if (sigma >= 0.3) g.filter = `blur(${sigma}px)`;
      g.drawImage(it.bitmap, (W - w) / 2, (H - h) / 2, w, h);
    } else {
      const k = Math.max(1, Math.floor(sigma / 2)), sw = Math.ceil(W / k), sh = Math.ceil(H / k);
      const sc = newCanvas(sw, sh), sg = sc.getContext("2d");
      sg.drawImage(it.bitmap, (sw - w / k) / 2, (sh - h / k) / 2, w / k, h / k);
      const id = sg.getImageData(0, 0, sw, sh); blurData(id, sigma / k); sg.putImageData(id, 0, 0);
      g.imageSmoothingQuality = "high"; g.drawImage(sc, 0, 0, W, H);
    }
    if (cache) { it.bk = key; it.bc = c; }
    return c;
  }

  // ---------- Gambar ----------
  // Transform foto: zoom (relatif terhadap "cover"), ox/oy (geser, pecahan dari lebar/tinggi frame)
  function geom(it, W, H) {
    const bw = it.bitmap.width, bh = it.bitmap.height;
    const s0 = Math.max(W / bw, H / bh);
    return { bw, bh, s0, minZ: Math.min(W / bw, H / bh) / s0 };
  }
  function fit(it) {
    const f = frameOf(it), W = f.naturalWidth, H = f.naturalHeight;
    const { bw, bh, s0, minZ } = geom(it, W, H);
    it.zoom = clamp(it.zoom, MIN_ZOOM, MAXZ);
    const mx = Math.abs(bw * s0 * it.zoom - W) / 2 / W, my = Math.abs(bh * s0 * it.zoom - H) / 2 / H;
    it.ox = clamp(it.ox, -mx, mx); it.oy = clamp(it.oy, -my, my);
    return minZ;
  }
  // Urutan layer (bawah -> atas): background putih, foto blur, foto A, frame
  function draw(g, it, frame, W, H, cache) {
    const { bw, bh, s0 } = geom(it, W, H);
    const w = bw * s0 * it.zoom, h = bh * s0 * it.zoom;
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    if (it.blur) g.drawImage(blurLayer(it, W, H, it.radius * W / frame.naturalWidth, cache), 0, 0);
    g.drawImage(it.bitmap, (W - w) / 2 + it.ox * W, (H - h) / 2 + it.oy * H, w, h);
    g.drawImage(frame, 0, 0, W, H);
  }

  // PNG dulu. Kalau > 2MB -> JPEG (kualitas terbaik yang muat), kalau masih besar -> kecilkan dimensi
  async function exportUnder(canvas) {
    if (canvas.width * canvas.height <= 12e6) {
      const png = await toBlob(canvas, "image/png");
      if (png && png.size <= MAX) return { blob: png, ext: "png", compressed: false };
    }
    let c = canvas, scale = 1;
    for (let step = 0; step < 10; step++) {
      let lo = 0.5, hi = 0.95, best = null;
      for (let i = 0; i < 6; i++) {
        const q = (lo + hi) / 2, jb = await toBlob(c, "image/jpeg", q);
        if (jb && jb.size <= MAX) { best = jb; lo = q; } else hi = q;
      }
      if (best) return { blob: best, ext: "jpg", compressed: true };
      scale *= 0.85;
      c = newCanvas(Math.round(canvas.width * scale), Math.round(canvas.height * scale));
      c.getContext("2d").drawImage(canvas, 0, 0, c.width, c.height);
    }
    const last = await toBlob(c, "image/jpeg", 0.5);
    if (!last) throw new Error("export gagal");
    return { blob: last, ext: "jpg", compressed: true };
  }

  // Satu proses export per versi edit; download memakai proses yang sama (tidak dobel)
  function ensureExport(it) {
    if (it.job && it.job.v === it.v) return it.job.p;
    const v = it.v, p = exportNow(it, v);
    it.job = { v, p };
    return p;
  }
  async function exportNow(it, v) {
    it.meta.textContent = "Memproses...";
    try {
      await new Promise((r) => setTimeout(r, 20)); // beri waktu UI untuk update
      const f = frameOf(it), c = newCanvas(f.naturalWidth, f.naturalHeight);
      draw(c.getContext("2d"), it, f, c.width, c.height, false);
      const out = await exportUnder(c);
      if (v === it.v) it.meta.textContent = `${fmt(out.blob.size)} · ${out.ext.toUpperCase()}${out.compressed ? " (dikompres)" : ""}`;
      return out;
    } catch (err) {
      console.error(err);
      if (v === it.v) it.meta.textContent = err && err.name === "SecurityError"
        ? "Diblokir browser: buka lewat http://localhost atau GitHub Pages, bukan file://"
        : "Gagal memproses, coba lagi";
      throw err;
    }
  }
  function save(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function download(it) {
    const out = await ensureExport(it);
    save(out.blob, `${it.name}-joomax.${out.ext}`);
  }

  // ZIP tanpa library (mode "store": gambar sudah terkompres, jadi tidak perlu dikompres lagi)
  const CRC = (() => { const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t; })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function makeZip(files) {
    const enc = new TextEncoder(), now = new Date(), parts = [], central = [];
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    let offset = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4],
       [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([o, v, n]) => (n === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
      parts.push(lh, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4],
       [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, offset, 4]]
        .forEach(([o, v, n]) => (n === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
      central.push(ch, name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, p) => a + (p.byteLength ?? p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end], { type: "application/zip" });
  }

  // HEIC (foto iPhone): dibaca langsung kalau browser bisa, kalau tidak dikonversi dengan heic2any
  const isHeic = (f) => /image\/hei[cf]/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);
  const isImage = (f) => f.type.startsWith("image/") || isHeic(f);
  let heicLib;
  function loadHeic() {
    return (heicLib ||= (async () => {
      for (const src of HEIC_SRCS) {
        try {
          await new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = rej; document.head.appendChild(el); });
          if (window.heic2any) return window.heic2any;
        } catch { /* coba sumber berikutnya */ }
      }
      throw new Error("heic2any tidak bisa dimuat");
    })());
  }
  const openBitmap = (b) => createImageBitmap(b, { imageOrientation: "from-image" }).catch(() => createImageBitmap(b));
  async function decode(f) {
    if (!isHeic(f)) return openBitmap(f);
    try { return await openBitmap(f); } catch { /* lanjut konversi */ }
    const conv = await (await loadHeic())({ blob: f, toType: "image/jpeg", quality: 0.92 });
    return openBitmap(Array.isArray(conv) ? conv[0] : conv);
  }
  async function safeDownload(it, btn) {
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Menyiapkan...";
    try { await download(it); } catch { /* pesan error sudah tampil di kartu */ }
    btn.disabled = false; btn.textContent = label;
  }

  // ---------- Kartu foto ----------
  function syncPickers() {
    state.items.forEach((it) => {
      it.fpick.hidden = !state.per;
      [...it.fpick.children].forEach((b, j) => b.setAttribute("aria-checked", j === it.frameIdx));
    });
  }

  function refresh(it) {
    fit(it); const f = frameOf(it);
    const cv = it.canvas, W = PREVIEW_W, H = Math.round(PREVIEW_W * f.naturalHeight / f.naturalWidth);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    draw(cv.getContext("2d"), it, f, W, H, true);
    const z = toZ(it.zoom);
    Object.assign(it.slider, { min: -100, max: 100, step: 1, value: z });
    if (document.activeElement !== it.zNum) it.zNum.value = Math.round(z);
    it.v++;
    clearTimeout(it.timer);
    it.meta.textContent = "Memproses...";
    it.timer = setTimeout(() => ensureExport(it).catch(() => {}), 600);
  }

  function addCard(it) {
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = `<div class="stage" tabindex="0" aria-label="Area foto: geser dengan drag atau panah, zoom dengan + dan -"><canvas></canvas></div>
      <div class="zoom"><button class="ico" type="button" data-z="-" aria-label="Zoom out">−</button>
      <input type="range" class="zr" aria-label="Zoom, -100 sampai 100"><button class="ico" type="button" data-z="+" aria-label="Zoom in">+</button>
      <input type="text" class="zn" inputmode="decimal" aria-label="Nilai zoom (-100 sampai 100)" title="Zoom: -100 sampai 100">
      <button class="ico" type="button" data-r aria-label="Reset posisi dan zoom" title="Reset posisi dan zoom">↺</button></div>
      <label class="chk"><input type="checkbox" class="bl-on"> Gaussian blur (background)</label>
      <div class="blurctl" hidden><input type="range" class="bl-r" min="0" max="${BLUR_MAX}" step="1" aria-label="Radius blur">
      <input type="text" class="bl-n" inputmode="decimal" aria-label="Radius blur dalam px"><span>px</span>
      <button class="pill" type="button" data-rec title="Radius 20 px">Rekomendasi</button></div>
      <div class="fpick" role="radiogroup" aria-label="Frame untuk foto ini" hidden></div>
      <div class="name"></div><div class="meta"></div>
      <div class="acts"><button class="btn dl" type="button">Download</button><button class="btn ghost rm" type="button">Hapus</button></div>`;
    d.querySelector(".name").textContent = it.name;
    const stage = d.querySelector(".stage");
    const rng = d.querySelector(".bl-r"), num = d.querySelector(".bl-n"), ctl = d.querySelector(".blurctl");
    Object.assign(it, { el: d, canvas: d.querySelector("canvas"), slider: d.querySelector(".zr"), zNum: d.querySelector(".zn"), meta: d.querySelector(".meta") });
    rng.value = num.value = it.radius;
    const rec = d.querySelector("[data-rec]"), syncRec = () => rec.classList.toggle("on", it.radius === BLUR_DEFAULT);
    syncRec();
    it.fpick = d.querySelector(".fpick");
    state.frames.forEach((f, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "fp"; b.title = f.name; b.setAttribute("role", "radio");
      b.innerHTML = `<img alt="${f.name}" src="${f.src}">`;
      b.onclick = () => { it.frameIdx = i; syncPickers(); refresh(it); };
      it.fpick.appendChild(b);
    });

    // geser & zoom
    const ptrs = new Map(); let last = 0;
    const dist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    stage.addEventListener("pointerdown", (e) => { stage.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = ptrs.size === 2 ? dist() : 0; });
    stage.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const r = stage.getBoundingClientRect();
      if (ptrs.size === 1) { it.ox += (e.clientX - p.x) / r.width; it.oy += (e.clientY - p.y) / r.height; }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const n = dist(); if (last) it.zoom *= n / last; last = n; }
      refresh(it);
    });
    const end = (e) => { ptrs.delete(e.pointerId); last = 0; };
    stage.addEventListener("pointerup", end); stage.addEventListener("pointercancel", end);
    stage.addEventListener("wheel", (e) => { e.preventDefault(); it.zoom *= Math.exp(-e.deltaY * 0.0015); refresh(it); }, { passive: false });
    stage.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [-.02, 0], ArrowRight: [.02, 0], ArrowUp: [0, -.02], ArrowDown: [0, .02] }[e.key];
      if (k) { it.ox += k[0]; it.oy += k[1]; }
      else if (e.key === "+" || e.key === "=") it.zoom *= 1.1;
      else if (e.key === "-") it.zoom /= 1.1;
      else return;
      e.preventDefault(); refresh(it);
    });
    it.slider.oninput = () => { it.zoom = fromZ(+it.slider.value); refresh(it); };
    it.zNum.oninput = () => { const n = parseFloat(it.zNum.value.replace(",", ".")); if (isFinite(n)) { it.zoom = fromZ(clamp(n, -100, 100)); refresh(it); } };
    it.zNum.onchange = () => { it.zNum.value = Math.round(toZ(it.zoom)); };
    it.zNum.onkeydown = (e) => { if (e.key === "Enter") it.zNum.blur(); };
    d.querySelectorAll("[data-z]").forEach((b) => b.onclick = () => { it.zoom *= b.dataset.z === "+" ? 1.15 : 1 / 1.15; refresh(it); });
    d.querySelector("[data-r]").onclick = () => { Object.assign(it, { zoom: 1, ox: 0, oy: 0 }); refresh(it); };

    // blur: nyalakan, geser slider, atau ketik angka langsung (mis. 99 atau 99%)
    d.querySelector(".bl-on").onchange = (e) => { it.blur = e.target.checked; ctl.hidden = !it.blur; refresh(it); };
    rng.oninput = () => { it.radius = +rng.value; num.value = it.radius; syncRec(); refresh(it); };
    num.oninput = () => {
      const n = parseFloat(num.value.replace(",", "."));
      if (!isFinite(n)) return;
      it.radius = clamp(n, 0, BLUR_MAX); rng.value = it.radius; syncRec(); refresh(it);
    };
    num.onchange = () => { num.value = it.radius; };
    num.onkeydown = (e) => { if (e.key === "Enter") num.blur(); };
    rec.onclick = () => { it.radius = BLUR_DEFAULT; rng.value = num.value = BLUR_DEFAULT; syncRec(); refresh(it); };

    d.querySelector(".dl").onclick = (e) => safeDownload(it, e.currentTarget);
    d.querySelector(".rm").onclick = () => { clearTimeout(it.timer); d.remove();
      state.items = state.items.filter((x) => x !== it); toggleUI(); };
    $("#results").appendChild(d);
  }

  function toggleUI() {
    $("#empty").hidden = state.items.length > 0;
    $("#hint").hidden = state.items.length === 0;
    $("#bulk").hidden = state.items.length < 2;
  }

  async function addFiles(files) {
    await ready;
    const list = [...files].filter(isImage), status = $("#status");
    for (const [n, f] of list.entries()) {
      try {
        if (isHeic(f)) status.textContent = `Mengonversi HEIC (${n + 1}/${list.length})...`;
        const bitmap = await decode(f);
        const it = { name: f.name.replace(/\.[^.]+$/, ""), bitmap, zoom: 1, ox: 0, oy: 0, v: 0, blur: false, radius: BLUR_DEFAULT, frameIdx: state.current };
        state.items.push(it); addCard(it); syncPickers(); refresh(it); toggleUI();
      } catch (err) { console.error(err); alert("Tidak bisa membaca file: " + f.name); }
    }
    status.textContent = "";
  }

  // ---------- Event ----------
  const input = $("#file"), drop = $("#drop");
  input.onchange = () => { const picked = [...input.files]; input.value = ""; addFiles(picked); };
  ["dragenter", "dragover"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (ev) => addFiles([...ev.dataTransfer.files]));
  $("#perFrame").onchange = (e) => {
    state.per = e.target.checked; $("#perHint").hidden = !state.per;
    syncPickers(); state.items.forEach(refresh);
  };
  async function bulk(btn, work) {
    const label = btn.textContent;
    document.querySelectorAll("#bulk .btn").forEach((b) => (b.disabled = true));
    try { await work((t) => (btn.textContent = t)); }
    catch (err) { console.error(err); alert("Gagal menyiapkan file. Coba lagi atau download satuan."); }
    btn.textContent = label;
    document.querySelectorAll("#bulk .btn").forEach((b) => (b.disabled = false));
  }
  $("#dlEach").onclick = (e) => bulk(e.currentTarget, async (say) => {
    for (const [i, it] of state.items.entries()) { say(`Menyiapkan ${i + 1}/${state.items.length}...`); await download(it); await new Promise((r) => setTimeout(r, 300)); }
  });
  $("#dlZip").onclick = (e) => bulk(e.currentTarget, async (say) => {
    const files = [], used = new Set();
    for (const [i, it] of state.items.entries()) {
      say(`Menyiapkan ${i + 1}/${state.items.length}...`);
      const out = await ensureExport(it), base = `${it.name}-joomax`;
      let name = `${base}.${out.ext}`, k = 2;
      while (used.has(name)) name = `${base}-${k++}.${out.ext}`;
      used.add(name); files.push({ name, blob: out.blob });
    }
    say("Membuat ZIP...");
    save(await makeZip(files), "joomax-frames.zip");
  });

  const ready = loadFrames();
})();
