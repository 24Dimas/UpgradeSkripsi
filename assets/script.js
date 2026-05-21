/* ============================================================
   Si-Reino · Form Registrasi v8
   Multi-step controller compatible with V7 visual.
   ============================================================ */
(function () {
  'use strict';

  const TOTAL_STEPS = 4;
  const DRAFT_KEY = 'sireino_form_draft_v1';
  const DRAFT_DEBOUNCE_MS = 800;
  const MAX_FILE_SIZE_MB = 20;

  const STEP_FIELDS = {
    1: ['nama', 'alamat', 'rukun_tetangga_rt', 'rukun_warga_rw',
        'kecamatan', 'kabupaten', 'pekerjaan', 'email', 'nomor_hp'],
    2: ['atasnama', 'fakultas', 'nama_lembaga', 'nomor_surat', 'tgl_surat', 'perihal'],
    3: ['proposal', 'bidang', 'opsi_anggota', 'tanggal_mulai', 'tanggal_selesai', 'penanggung_jawab'],
    4: ['attach']
  };

  let currentStep = 1;
  let formStarted = false;
  let draftTimer = null;

  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ========== HELPERS ==========
  function setError(id, hasError, msg) {
    const el = $(id);
    if (!el) return;
    const box = el.closest('.input-box') || el.closest('.field');
    if (!box) return;
    if (hasError) {
      box.classList.add('error', 'has-error');
      el.classList.add('is-invalid');
    } else {
      box.classList.remove('error', 'has-error');
      el.classList.remove('is-invalid');
    }
    if (msg) {
      const errEl = box.querySelector('.error-text');
      if (errEl) errEl.textContent = msg;
    }
  }

  function getVal(id) { const el = $(id); return el ? (el.value || '').trim() : ''; }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatTanggalReview(str) {
    if (!str) return '—';
    const d = new Date(str + 'T00:00:00');
    if (isNaN(d)) return str;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function smoothScroll() {
    const c = document.querySelector('.container');
    if (c) {
      const y = c.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }

  // ========== MODAL HELPERS (V7 style: display flex/none) ==========
  function openModal(id) { const m = $(id); if (m) m.style.display = 'flex'; }
  function closeModal(id) { const m = $(id); if (m) m.style.display = 'none'; }

  // ========== STEPPER ==========
  function showStep(n) {
    if (n < 1 || n > TOTAL_STEPS) return;
    currentStep = n;

    $$('.step-pane').forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.pane) === n);
    });

    $$('.stepper-item').forEach(item => {
      const step = parseInt(item.dataset.step);
      item.classList.remove('active', 'done');
      if (step === n) item.classList.add('active');
      else if (step < n) item.classList.add('done');
    });

    $$('.stepper-bar').forEach((bar, i) => {
      bar.classList.toggle('done', i < n - 1);
    });

    const btnPrev = $('btnPrev'), btnNext = $('btnNext'), btnSubmit = $('btnSubmit');
    btnPrev.style.display = n === 1 ? 'none' : 'inline-flex';
    if (n === TOTAL_STEPS) {
      btnNext.style.display = 'none';
      btnSubmit.style.display = 'inline-flex';
    } else {
      btnNext.style.display = 'inline-flex';
      btnSubmit.style.display = 'none';
    }

    $('globalError').classList.remove('is-visible');
    if (n === TOTAL_STEPS) renderReview();
    smoothScroll();
  }

  function validateStep(n) {
    let firstError = null, hasErr = false;
    const ids = STEP_FIELDS[n] || [];

    ids.forEach(id => {
      const el = $(id);
      if (!el || el.type === 'file') return;
      el.value = el.value.replace(/\s+/g, ' ').trim();

      if (id === 'nomor_hp') {
        const c = el.value.replace(/[\s\-]/g, '');
        if (!c) {
          setError(id, true, 'Wajib diisi');
          if (!firstError) firstError = el; hasErr = true;
        } else if (c[0] !== '0') {
          setError(id, true, 'Nomor HP harus dimulai angka 0');
          if (!firstError) firstError = el; hasErr = true;
        } else if (!/^\d{10,13}$/.test(c)) {
          setError(id, true, 'Nomor HP harus 10–13 digit');
          if (!firstError) firstError = el; hasErr = true;
        } else setError(id, false);
        return;
      }
      if (id === 'rukun_tetangga_rt' || id === 'rukun_warga_rw') {
        if (!/^\d{3}$/.test(el.value)) { setError(id, true); if (!firstError) firstError = el; hasErr = true; }
        else setError(id, false);
        return;
      }
      if (el.type === 'email') {
        if (!el.value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) { setError(id, true, 'Email tidak valid'); if (!firstError) firstError = el; hasErr = true; }
        else setError(id, false);
        return;
      }
      if (!el.value.trim()) { setError(id, true); if (!firstError) firstError = el; hasErr = true; }
      else setError(id, false);
    });

    if (n === 3) {
      const opdInputs = $$('.opd-input');
      const opdW = $('opd-wrapper');
      if (!opdInputs.some(i => i.value.trim()) || !opdInputs.length) {
        opdW.classList.add('error', 'has-error');
        if (!firstError) firstError = opdInputs[0] || opdW;
        hasErr = true;
      } else { opdW.classList.remove('error', 'has-error'); updateOPDHidden(); }

      if ($('opsi_anggota').value === 'ada') {
        const ai = $$('.anggota-input');
        const aw = $('anggota-wrapper');
        if (!ai.some(i => i.value.trim()) || !ai.length) {
          aw.classList.add('error', 'has-error');
          if (!firstError) firstError = ai[0] || $('opsi_anggota');
          hasErr = true;
        } else { aw.classList.remove('error', 'has-error'); updateAnggotaHidden(); }
      }
    }

    if (n === 4) {
      if (!$('attach').files[0]) {
        $('attach-wrapper').classList.add('error', 'has-error');
        if (!firstError) firstError = $('dropZone');
        hasErr = true;
      } else { $('attach-wrapper').classList.remove('error', 'has-error'); }
    }

    if (hasErr) {
      $('globalError').classList.add('is-visible');
      if (firstError) {
        try { firstError.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){}
        try { firstError.focus({ preventScroll: true }); } catch(e){}
      }
    } else $('globalError').classList.remove('is-visible');

    return !hasErr;
  }

  window.nextStep = function () { if (validateStep(currentStep) && currentStep < TOTAL_STEPS) showStep(currentStep + 1); };
  window.prevStep = function () { if (currentStep > 1) showStep(currentStep - 1); };
  window.goToStep = function (t) {
    t = parseInt(t);
    if (isNaN(t) || t === currentStep) return;
    if (t < currentStep) { showStep(t); return; }
    for (let i = currentStep; i < t; i++) { if (!validateStep(i)) return; }
    showStep(t);
  };

  // ========== OPD ==========
  window.tambahOPD = function () {
    const list = $('opd-list');
    const i = list.children.length + 1;
    const row = document.createElement('div');
    row.className = 'anggota-row';
    row.innerHTML = `
      <div class="anggota-nomor">${i}</div>
      <input type="text" class="form-control opd-input capitalize"
        placeholder="Nama OPD / Bidang ke-${i}"
        oninput="updateOPDHidden(); capitalizeInput(this); debouncedSaveDraft();">
      <button type="button" class="btn-hapus-anggota" onclick="hapusOPD(this)" title="Hapus">
        <i class="bi bi-trash3"></i>
      </button>
    `;
    list.appendChild(row);
    updateOPDHidden();
  };

  window.hapusOPD = function (btn) {
    btn.closest('.anggota-row').remove();
    $$('#opd-list .anggota-row').forEach((r, i) => {
      r.querySelector('.anggota-nomor').textContent = (i + 1);
      r.querySelector('input').placeholder = `Nama OPD / Bidang ke-${i + 1}`;
    });
    updateOPDHidden();
  };

  window.updateOPDHidden = function () {
    const filled = $$('.opd-input').filter(i => i.value.trim());
    $('lokasi').value = filled.length === 1 ? filled[0].value.trim()
      : filled.map((i, idx) => `${idx+1}. ${i.value.trim()}`).join(', ');
  };

  // ========== ANGGOTA ==========
  window.toggleAnggota = function () {
    const v = $('opsi_anggota').value;
    if (v === 'ada') {
      $('anggota-wrapper').style.display = 'block';
      $('anggota_peneliti').value = '';
      if (!$$('.anggota-input').length) tambahAnggota();
    } else if (v === '-') {
      $('anggota-wrapper').style.display = 'none';
      $('anggota_peneliti').value = '-';
      $('anggota-list').innerHTML = '';
    } else {
      $('anggota-wrapper').style.display = 'none';
      $('anggota_peneliti').value = '';
    }
  };

  window.tambahAnggota = function () {
    const list = $('anggota-list');
    const i = list.children.length + 1;
    const row = document.createElement('div');
    row.className = 'anggota-row';
    row.innerHTML = `
      <div class="anggota-nomor">${i}</div>
      <input type="text" class="form-control anggota-input capitalize"
        placeholder="Nama lengkap anggota ${i}"
        oninput="updateAnggotaHidden(); capitalizeInput(this); debouncedSaveDraft();">
      <button type="button" class="btn-hapus-anggota" onclick="hapusAnggota(this)" title="Hapus">
        <i class="bi bi-trash3"></i>
      </button>
    `;
    list.appendChild(row);
    updateAnggotaHidden();
  };

  window.hapusAnggota = function (btn) {
    btn.closest('.anggota-row').remove();
    $$('#anggota-list .anggota-row').forEach((r, i) => {
      r.querySelector('.anggota-nomor').textContent = (i + 1);
      r.querySelector('input').placeholder = `Nama lengkap anggota ${i + 1}`;
    });
    updateAnggotaHidden();
  };

  window.updateAnggotaHidden = function () {
    const filled = $$('.anggota-input').filter(i => i.value.trim());
    $('anggota_peneliti').value = filled.length === 1 ? filled[0].value.trim()
      : filled.map((i, idx) => `${idx+1}. ${i.value.trim()}`).join(', ');
  };

  window.capitalizeInput = function (el) {
    const s = el.selectionStart, e = el.selectionEnd;
    el.value = el.value.replace(/\b\w/g, c => c.toUpperCase());
    try { el.setSelectionRange(s, e); } catch(x) {}
  };
  window.onlyThreeDigits = function (el) { el.value = el.value.replace(/\D/g, '').slice(0, 3); };

  // ========== REVIEW ==========
  function renderReview() {
    updateOPDHidden(); updateAnggotaHidden();
    const grid = $('reviewGrid'); if (!grid) return;

    const periode = (getVal('tanggal_mulai') && getVal('tanggal_selesai'))
      ? `${formatTanggalReview($('tanggal_mulai').value)} – ${formatTanggalReview($('tanggal_selesai').value)}` : '—';
    const anggota = $('opsi_anggota').value === 'ada' ? ($('anggota_peneliti').value || '—') : 'Tidak ada';

    const sections = [
      { title:'Data Pemohon', icon:'bi-person-badge', step:1, full:true,
        items:[['Nama',getVal('nama')],
               ['Alamat',`${getVal('alamat')}, RT ${getVal('rukun_tetangga_rt')}/RW ${getVal('rukun_warga_rw')}, ${getVal('kecamatan')}, ${getVal('kabupaten')}`],
               ['Pekerjaan',getVal('pekerjaan')],['Email',getVal('email')],['No. HP',getVal('nomor_hp')]]},
      { title:'Data Surat', icon:'bi-envelope-paper', step:2, full:true,
        items:[['Jabatan PJ',getVal('atasnama')],['Fakultas',getVal('fakultas')],['Lembaga',getVal('nama_lembaga')],
               ['No. Surat',getVal('nomor_surat')],['Tgl. Surat',formatTanggalReview($('tgl_surat').value)],['Perihal',getVal('perihal')]]},
      { title:'Data Penelitian', icon:'bi-journal-text', step:3, full:true,
        items:[['Judul',getVal('proposal')],['OPD',$('lokasi').value],['Prodi',getVal('bidang')],
               ['Anggota',anggota],['Periode',periode],['PJ Surat',getVal('penanggung_jawab')]]}
    ];

    grid.innerHTML = sections.map(s => `
      <div class="review-card${s.full?' full':''}">
        <div class="review-card-head">
          <div class="review-card-title"><i class="bi ${s.icon}"></i><span>${s.title}</span></div>
          <button type="button" class="review-edit-btn" onclick="goToStep(${s.step})"><i class="bi bi-pencil"></i> Edit</button>
        </div>
        <dl class="review-list">
          ${s.items.map(([k,v])=>`<dt>${k}</dt><dd>${escapeHtml(v||'—')}</dd>`).join('')}
        </dl>
      </div>
    `).join('');
  }

  // ========== DROPZONE ==========
  function updateFilePreview(file) {
    const def = $('fileUploadDefault'), sel = $('fileUploadSelected'), zone = $('dropZone');
    if (!file) { def.style.display='flex'; sel.style.display='none'; zone.classList.remove('has-file'); return; }
    def.style.display='none'; sel.style.display='flex'; zone.classList.add('has-file');
    $('fileSelectedName').textContent = file.name;
    $('fileSelectedSize').textContent = formatFileSize(file.size);
  }

  window.clearSelectedFile = function (e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    $('attach').value = '';
    updateFilePreview(null);
    $('attach-wrapper').classList.remove('error','has-error');
  };

  function setupDropzone() {
    const zone = $('dropZone'), input = $('attach');
    if (!zone || !input) return;
    ['dragenter','dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); }));
    zone.addEventListener('drop', e => {
      const files = e.dataTransfer.files;
      if (files && files.length) {
        const ext = files[0].name.split('.').pop().toLowerCase();
        if (!['zip','rar'].includes(ext)) { showCustomAlert('Hanya file <strong>ZIP atau RAR</strong> yang diterima.','Format Salah','⛔'); return; }
        const dt = new DataTransfer(); dt.items.add(files[0]); input.files = dt.files;
        updateFilePreview(files[0]);
        $('attach-wrapper').classList.remove('error','has-error');
      }
    });
    input.addEventListener('change', () => {
      const f = input.files[0]; updateFilePreview(f);
      if (f) $('attach-wrapper').classList.remove('error','has-error');
    });
  }

  // ========== DRAFT ==========
  function saveDraft() {
    try {
      const data = {};
      $$('#uploadForm input, #uploadForm select').forEach(el => {
        if (el.type === 'file' || (el.type === 'hidden' && el.name === 'fileContent')) return;
        const k = el.id || el.name; if (k) data[k] = el.value;
      });
      data._opdList = $$('.opd-input').map(i => i.value);
      data._anggotaList = $$('.anggota-input').map(i => i.value);
      data._step = currentStep;
      data._savedAt = Date.now();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      const di = $('draftIndicator');
      if (di) { di.classList.add('show'); clearTimeout(saveDraft._t); saveDraft._t = setTimeout(()=>di.classList.remove('show'), 2000); }
    } catch(e) {}
  }

  window.debouncedSaveDraft = function () { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, DRAFT_DEBOUNCE_MS); };

  function hasDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (!d) return false;
      return Object.keys(d).some(k => !k.startsWith('_') && d[k] && typeof d[k]==='string' && d[k].trim());
    } catch(e) { return false; }
  }

  window.restoreDraft = function () {
    closeModal('customDraftRestore');
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY)); if (!d) return;
      if (Array.isArray(d._opdList) && d._opdList.length) {
        $('opd-list').innerHTML = '';
        d._opdList.forEach(() => tambahOPD());
        $$('.opd-input').forEach((inp,i) => { if (d._opdList[i] !== undefined) inp.value = d._opdList[i]; });
        updateOPDHidden();
      }
      Object.keys(d).forEach(k => {
        if (k.startsWith('_')) return;
        const el = $(k); if (el && el.type !== 'file') { el.value = d[k]; if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change')); }
      });
      if (Array.isArray(d._anggotaList) && d._anggotaList.length) {
        $('anggota-list').innerHTML = '';
        d._anggotaList.forEach(() => tambahAnggota());
        $$('.anggota-input').forEach((inp,i) => { if (d._anggotaList[i] !== undefined) inp.value = d._anggotaList[i]; });
        updateAnggotaHidden();
      }
      if ($('opsi_anggota').value === 'ada') $('anggota-wrapper').style.display = 'block';
      if (d._step >= 1 && d._step <= TOTAL_STEPS) showStep(d._step);
      formStarted = true;
    } catch(e) {}
  };

  window.discardDraft = function () { closeModal('customDraftRestore'); try { localStorage.removeItem(DRAFT_KEY); } catch(e) {} };
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch(e) {} }

  // ========== CUSTOM MODALS ==========
  window.showCustomAlert = function (msg, title, emoji) {
    $('customAlertMsg').innerHTML = msg;
    $('customAlertTitle').textContent = title || 'Perhatian';
    $('customAlertIconEmoji').textContent = emoji || '⚠️';
    openModal('customAlert');
  };
  window.closeCustomAlert = function () { closeModal('customAlert'); };
  window.konfirmasiReset = function () { openModal('customConfirmReset'); };
  window.closeCustomConfirmReset = function () { closeModal('customConfirmReset'); };
  window.konfirmasiKembali = function () { openModal('customConfirmKembali'); };
  window.closeCustomConfirmKembali = function () { closeModal('customConfirmKembali'); };

  window.doReset = function () {
    closeModal('customConfirmReset');
    $('uploadForm').reset();
    $('opd-list').innerHTML = ''; tambahOPD();
    $('opd-wrapper').classList.remove('error','has-error');
    $('anggota-list').innerHTML = '';
    $('anggota-wrapper').style.display = 'none';
    $('anggota-wrapper').classList.remove('error','has-error');
    $$('.input-box.error').forEach(e => e.classList.remove('error','has-error'));
    $$('.is-invalid').forEach(e => e.classList.remove('is-invalid'));
    $('globalError').classList.remove('is-visible');
    updateFilePreview(null);
    clearDraft(); formStarted = false;
    showStep(1);
    showToast('Formulir berhasil direset', 'info');
  };

  window.closeWelcomePopup = function () { closeModal('popupModal'); };

  // ========== TOAST ==========
  function showToast(msg, tone) {
    const t=$('toast'), i=$('toastIcon'), m=$('toastMsg');
    if (!t) return;
    m.textContent = msg;
    t.className = 'toast-notify show ' + (tone||'info');
    const icons = { success:'bi-check-circle-fill', error:'bi-x-circle-fill', info:'bi-info-circle-fill' };
    i.className = 'bi ' + (icons[tone]||icons.info);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ========== SUBMIT ==========
  window.showFileNotification = function () { if (!validateStep(4)) return; openModal('fileNotification'); };
  window.hideFileNotification = function () { closeModal('fileNotification'); };
  window.proceedToUpload = function () { closeModal('fileNotification'); uploadFile(); };

  function uploadFile() {
    const file = $('attach').files[0];
    if (!file) { showCustomAlert('Belum ada file yang dipilih.','File Belum Dipilih','📁'); return; }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['zip','rar'].includes(ext)) { showCustomAlert('Format file harus <strong>ZIP atau RAR</strong>.','Format Salah','⛔'); return; }
    if (file.size > MAX_FILE_SIZE_MB * 1048576) {
      showCustomAlert(`Ukuran file <strong>${formatFileSize(file.size)}</strong> melebihi batas <strong>${MAX_FILE_SIZE_MB} MB</strong>.`,'File Terlalu Besar','📏');
      return;
    }

    openModal('loadingModal');
    const fill = $('loadingProgressFill'), label = $('loadingProgressLabel'), tips = $('loadingTipsText');
    const steps = [{pct:15,l:'Membaca file...'},{pct:35,l:'Mengemas data...'},{pct:55,l:'Mengunggah...'},{pct:75,l:'Memproses di server...'},{pct:90,l:'Hampir selesai...'}];
    const tipsList = ['Proses pengiriman biasanya 10–30 detik.','Pastikan koneksi internet stabil.','Notifikasi akan dikirim ke email Anda.','Jangan refresh halaman.'];
    let si=0, ti=0;
    fill.style.width = '5%';

    const pt = setInterval(() => { if(si<steps.length){fill.style.width=steps[si].pct+'%';label.textContent=steps[si].l;si++;} }, 2200);
    const tt = setInterval(() => { ti=(ti+1)%tipsList.length; tips.style.opacity='0'; setTimeout(()=>{tips.textContent=tipsList[ti];tips.style.opacity='1';},250); }, 4500);

    const reader = new FileReader();
    reader.onerror = () => { clearInterval(pt); clearInterval(tt); closeModal('loadingModal'); showCustomAlert('Gagal membaca file.','Gagal','❌'); };
    reader.onload = function () {
      $('fileContent').value = reader.result;
      $('filename').value = file.name;

      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 60000);

      fetch($('uploadForm').action, { method:'POST', body:new FormData($('uploadForm')), signal:ctrl.signal })
        .then(r => { clearTimeout(tid); if(!r.ok) throw new Error('Server error'); return r.json(); })
        .then(() => {
          fill.style.width = '100%'; label.textContent = 'Berhasil! ✓';
          clearDraft(); formStarted = false;
          setTimeout(() => { closeModal('loadingModal'); $('notification').classList.remove('d-none'); }, 600);
        })
        .catch(err => {
          clearTimeout(tid); closeModal('loadingModal');
          if (err.name==='AbortError') showCustomAlert('Koneksi timeout (>60 detik).','Timeout','⏱️');
          else showCustomAlert('Gagal mengirim. Periksa koneksi internet.','Gagal','❌');
        })
        .finally(() => { clearInterval(pt); clearInterval(tt); });
    };
    reader.readAsDataURL(file);
  }

  // ========== REVISI MODE — auto-fill dari ref number ==========
  function checkRevisiMode() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('revisi');
    if (!ref || !/^KBP-\d+-\d+$/i.test(ref)) return false;

    // Show loading state
    showRevisiLoading();

    const cfg = window.SIREINO_CONFIG || {};
    if (!cfg.API_URL) return false;

    fetch(`${cfg.API_URL}?action=getDataByRef&ref=${encodeURIComponent(ref)}`)
      .then(r => r.json())
      .then(json => {
        if (!json.found) {
          hideRevisiLoading();
          showCustomAlert(
            json.error || 'Data revisi tidak ditemukan. Pastikan link revisi masih valid.',
            'Revisi Tidak Tersedia', '⚠️'
          );
          return;
        }
        // Auto-fill semua field
        fillFormFromData(json.data, ref);
        showRevisiBanner(ref);
        hideRevisiLoading();
      })
      .catch(err => {
        hideRevisiLoading();
        showCustomAlert('Gagal memuat data revisi. Periksa koneksi internet.', 'Gagal', '❌');
      });
    return true;
  }

  function fillFormFromData(d, ref) {
    // Simpan ref sebagai hidden input
    let hidden = document.querySelector('input[name="revisi_ref"]');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'revisi_ref';
      $('uploadForm').appendChild(hidden);
    }
    hidden.value = ref;

    // Fill simple fields
    const simpleFields = ['atasnama','fakultas','nama_lembaga','nomor_surat','tgl_surat','perihal',
                          'nama','alamat','rukun_tetangga_rt','rukun_warga_rw',
                          'kecamatan','kabupaten','pekerjaan','email','nomor_hp',
                          'proposal','bidang','tanggal_mulai','tanggal_selesai','penanggung_jawab'];
    simpleFields.forEach(id => {
      if (d[id]) {
        const el = $(id);
        if (el) el.value = d[id];
      }
    });

    // OPD list (parse from lokasi field: "1. ABC, 2. DEF, ..." or just "ABC")
    if (d.lokasi) {
      $('opd-list').innerHTML = '';
      const items = d.lokasi.split(/,\s*/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      items.forEach(() => tambahOPD());
      $$('.opd-input').forEach((inp, i) => { if (items[i]) inp.value = items[i]; });
      updateOPDHidden();
    }

    // Anggota list
    if (d.anggota_peneliti && d.anggota_peneliti !== '-') {
      $('opsi_anggota').value = 'ada';
      toggleAnggota();
      $('anggota-list').innerHTML = '';
      const items = d.anggota_peneliti.split(/,\s*/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      items.forEach(() => tambahAnggota());
      $$('.anggota-input').forEach((inp, i) => { if (items[i]) inp.value = items[i]; });
      updateAnggotaHidden();
    } else if (d.anggota_peneliti === '-') {
      $('opsi_anggota').value = '-';
      toggleAnggota();
    }

    // Update submit button text
    const sBtn = $('btnSubmit');
    if (sBtn) sBtn.innerHTML = '<i class="bi bi-send-fill"></i> Kirim Revisi';
  }

  function showRevisiBanner(ref) {
    const banner = document.createElement('div');
    banner.id = 'revisiBanner';
    banner.style.cssText = 'background:linear-gradient(135deg,#fff7ed,#fef3c7);border:1px solid #fbbf24;border-left:4px solid #d97706;border-radius:10px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:start;gap:12px;';
    banner.innerHTML = `
      <div style="font-size:24px;flex-shrink:0;">🔄</div>
      <div style="flex:1;font-size:13px;line-height:1.6;color:#7c2d12;">
        <strong style="display:block;margin-bottom:3px;color:#9a3412;font-size:13.5px;">Mode Revisi Pengajuan</strong>
        Anda sedang merevisi pengajuan dengan nomor referensi <strong>${ref}</strong>. Data sebelumnya telah diisi otomatis — periksa &amp; perbaiki yang perlu, lalu kirim.
      </div>
    `;
    const content = document.querySelector('.content');
    if (content) content.insertBefore(banner, content.firstChild);
  }

  function showRevisiLoading() {
    if ($('revisiLoadingOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'revisiLoadingOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,42,94,0.85);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:white;font-family:Plus Jakarta Sans,sans-serif;';
    ov.innerHTML = `
      <div style="width:48px;height:48px;border:4px solid rgba(255,255,255,0.2);border-top-color:#c8a951;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px;"></div>
      <div style="font-size:15px;font-weight:600;">Memuat data revisi...</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;">Mohon tunggu sebentar</div>
    `;
    document.body.appendChild(ov);
  }
  function hideRevisiLoading() {
    const ov = $('revisiLoadingOverlay');
    if (ov) ov.remove();
  }

  // ========== INIT ==========
  document.addEventListener('DOMContentLoaded', function () {
    // Set form action from config
    const cfg = window.SIREINO_CONFIG || {};
    if (cfg.API_URL) $('uploadForm').action = cfg.API_URL;

    tambahOPD();

    // Cek apakah ini mode revisi
    const isRevisi = checkRevisiMode();

    // Welcome popup hanya kalau BUKAN revisi
    if (!isRevisi) {
      openModal('popupModal');
    }

    setupDropzone();

    const today = new Date().toISOString().split('T')[0];
    $('tgl_surat').max = today;

    $('tanggal_mulai').addEventListener('change', () => {
      const s = new Date($('tanggal_mulai').value); if (isNaN(s)) return;
      const mx = new Date(s); mx.setMonth(mx.getMonth() + 6);
      $('tanggal_selesai').min = $('tanggal_mulai').value;
      $('tanggal_selesai').max = mx.toISOString().split('T')[0];
      $('tanggal_selesai').value = '';
    });
    $('tanggal_selesai').addEventListener('change', () => {
      const s = new Date($('tanggal_mulai').value); if (isNaN(s)) return;
      const lim = new Date(s); lim.setMonth(lim.getMonth() + 6);
      if (new Date($('tanggal_selesai').value) > lim) {
        showCustomAlert('Durasi maksimal <strong>6 bulan</strong>.','Tanggal Tidak Valid','📅');
        $('tanggal_selesai').value = '';
      }
    });

    // Live save + auto-capitalize + live error clear
    document.addEventListener('input', e => {
      if (!e.target.closest('#uploadForm') || e.target.type === 'file') return;
      formStarted = true; debouncedSaveDraft();
      if (e.target.classList.contains('capitalize')) capitalizeInput(e.target);
      const box = e.target.closest('.input-box');
      if (box && (box.classList.contains('error') || box.classList.contains('has-error'))) {
        if ((e.target.value||'').trim()) { box.classList.remove('error','has-error'); e.target.classList.remove('is-invalid'); }
      }
    });
    document.addEventListener('change', e => {
      if (!e.target.closest('#uploadForm') || e.target.type === 'file') return;
      formStarted = true; debouncedSaveDraft();
    });

    // Stepper click
    $$('.stepper-item').forEach(item => {
      item.addEventListener('click', () => { const t=parseInt(item.dataset.step); if(!isNaN(t)) goToStep(t); });
      item.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); const t=parseInt(item.dataset.step); if(!isNaN(t)) goToStep(t); }});
    });

    // Modal close on overlay click
    $$('.custom-modal-overlay, .popup-modal').forEach(o => {
      o.addEventListener('click', function(e) {
        if (e.target === this) {
          if (this.id === 'customDraftRestore') discardDraft();
          else this.style.display = 'none';
        }
      });
    });

    window.addEventListener('beforeunload', e => { if (formStarted) { e.preventDefault(); e.returnValue = ''; } });

    if (hasDraft()) setTimeout(() => openModal('customDraftRestore'), 400);

    showStep(1);
  });

})();
