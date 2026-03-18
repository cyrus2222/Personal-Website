/* ══════════════════════════════════════════
   QR碼產生與解析工具 — script.js
   ══════════════════════════════════════════ */

// ── State ──
let qrCode = null;
let logoDataUrl = null;
let currentType = 'url';
let cameraStream = null;
let cameraReader = null;
let cameraActive = false;

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initTypeSelector();
    updateQR();
});

// ══════════════════════════════════
//  Tab Navigation
// ══════════════════════════════════
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab !== 'scan' && cameraActive) stopCamera();
        });
    });
}

// ══════════════════════════════════
//  Content Type Selector
// ══════════════════════════════════
function initTypeSelector() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.input-form').forEach(f => f.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
            document.getElementById('form-' + currentType).classList.add('active');
            updateQR();
        });
    });
}

// ══════════════════════════════════
//  Content Data Builders
// ══════════════════════════════════
function getContentData() {
    switch (currentType) {
        case 'url':
            return val('f-url');
        case 'text':
            return val('f-text');
        case 'wifi': {
            const ssid = val('f-wifi-ssid');
            const pass = val('f-wifi-pass');
            const enc = val('f-wifi-enc');
            if (!ssid) return '';
            return `WIFI:T:${enc};S:${escWifi(ssid)};P:${escWifi(pass)};;`;
        }
        case 'vcard': {
            const ln = val('f-vc-ln'), fn = val('f-vc-fn');
            if (!ln && !fn) return '';
            let v = 'BEGIN:VCARD\nVERSION:3.0\n';
            v += `N:${ln};${fn};;;\n`;
            v += `FN:${fn} ${ln}\n`;
            if (val('f-vc-org')) v += `ORG:${val('f-vc-org')}\n`;
            if (val('f-vc-email')) v += `EMAIL:${val('f-vc-email')}\n`;
            if (val('f-vc-tel')) v += `TEL:${val('f-vc-tel')}\n`;
            if (val('f-vc-addr')) v += `ADR:;;${val('f-vc-addr')};;;;\n`;
            if (val('f-vc-url')) v += `URL:${val('f-vc-url')}\n`;
            v += 'END:VCARD';
            return v;
        }
        case 'calendar': {
            const title = val('f-cal-title');
            if (!title) return '';
            const sd = val('f-cal-sd'), st = val('f-cal-st');
            const ed = val('f-cal-ed'), et = val('f-cal-et');
            let v = 'BEGIN:VEVENT\n';
            v += `SUMMARY:${title}\n`;
            if (sd) v += `DTSTART:${icalDate(sd, st)}\n`;
            if (ed) v += `DTEND:${icalDate(ed, et)}\n`;
            if (val('f-cal-loc')) v += `LOCATION:${val('f-cal-loc')}\n`;
            if (val('f-cal-desc')) v += `DESCRIPTION:${val('f-cal-desc')}\n`;
            v += 'END:VEVENT';
            return v;
        }
        case 'sms': {
            const tel = val('f-sms-tel'), msg = val('f-sms-msg');
            if (!tel) return '';
            return msg ? `SMSTO:${tel}:${msg}` : `SMSTO:${tel}`;
        }
        case 'phone':
            return val('f-phone') ? `tel:${val('f-phone')}` : '';
        case 'email': {
            const addr = val('f-email-addr');
            if (!addr) return '';
            const subj = val('f-email-subj');
            const body = val('f-email-body');
            let url = `mailto:${addr}`;
            const params = [];
            if (subj) params.push('subject=' + encodeURIComponent(subj));
            if (body) params.push('body=' + encodeURIComponent(body));
            if (params.length) url += '?' + params.join('&');
            return url;
        }
        default:
            return '';
    }
}

function val(id) { return document.getElementById(id).value.trim(); }

function escWifi(s) {
    return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/:/g, '\\:').replace(/"/g, '\\"');
}

function icalDate(date, time) {
    const d = date.replace(/-/g, '');
    if (time) return d + 'T' + time.replace(/:/g, '') + '00';
    return d;
}

// ══════════════════════════════════
//  QR Code Generation
// ══════════════════════════════════
function getQROptions() {
    const data = getContentData() || ' ';
    const size = parseInt(document.getElementById('s-size').value);
    const margin = parseInt(document.getElementById('s-margin').value);
    const fgColor = document.getElementById('s-fg').value;
    const bgColor = document.getElementById('s-bg').value;
    const transparent = document.getElementById('s-transparent').checked;
    const ec = document.getElementById('s-ec').value;
    const dotType = document.getElementById('s-dot').value;
    const csqType = document.getElementById('s-csq').value;
    const csqColor = document.getElementById('s-csq-color').value;
    const cdotType = document.getElementById('s-cdot').value;
    const cdotColor = document.getElementById('s-cdot-color').value;
    const logoSize = parseFloat(document.getElementById('s-logo-size').value);
    const logoMargin = parseInt(document.getElementById('s-logo-margin').value);

    const opts = {
        width: size,
        height: size,
        data: data,
        margin: margin,
        qrOptions: {
            errorCorrectionLevel: ec
        },
        dotsOptions: {
            color: fgColor,
            type: dotType
        },
        backgroundOptions: {
            color: transparent ? 'rgba(0,0,0,0)' : bgColor
        },
        cornersSquareOptions: {
            color: csqColor
        },
        cornersDotOptions: {
            color: cdotColor
        }
    };

    if (csqType) opts.cornersSquareOptions.type = csqType;
    if (cdotType) opts.cornersDotOptions.type = cdotType;

    if (logoDataUrl) {
        opts.image = logoDataUrl;
        opts.imageOptions = {
            crossOrigin: 'anonymous',
            margin: logoMargin,
            imageSize: logoSize,
            hideBackgroundDots: true
        };
    }

    return opts;
}

function updateQR() {
    const container = document.getElementById('qr-preview');
    const data = getContentData();

    if (!data || !data.trim()) {
        container.innerHTML = '<div class="qr-placeholder">請輸入內容</div>';
        qrCode = null;
        return;
    }

    const opts = getQROptions();

    if (!qrCode) {
        container.innerHTML = '';
        qrCode = new QRCodeStyling(opts);
        qrCode.append(container);
    } else {
        qrCode.update(opts);
    }
}

// ── Settings Handlers ──
function onSizeChange() {
    document.getElementById('v-size').textContent = document.getElementById('s-size').value;
    updateQR();
}

function onMarginChange() {
    document.getElementById('v-margin').textContent = document.getElementById('s-margin').value;
    updateQR();
}

function onLogoSizeChange() {
    document.getElementById('v-logo-size').textContent = document.getElementById('s-logo-size').value;
    updateQR();
}

function onLogoMarginChange() {
    document.getElementById('v-logo-margin').textContent = document.getElementById('s-logo-margin').value;
    updateQR();
}

function onLogoChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        logoDataUrl = e.target.result;
        document.getElementById('s-ec').value = 'H';
        updateQR();
        toast('Logo 已載入，容錯率已自動提高至 H', 'success');
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    logoDataUrl = null;
    document.getElementById('s-logo').value = '';
    updateQR();
    toast('Logo 已移除', 'success');
}

// ══════════════════════════════════
//  Download
// ══════════════════════════════════
function downloadQR(ext) {
    if (!qrCode) { toast('請先產生 QR 碼', 'warning'); return; }
    const name = document.getElementById('dl-filename').value.trim() || 'qrcode';
    qrCode.download({ name: name, extension: ext });
}

// ══════════════════════════════════
//  Scanning — Camera
// ══════════════════════════════════
async function toggleCamera() {
    if (cameraActive) { stopCamera(); return; }
    const video = document.getElementById('camera-video');
    const btn = document.getElementById('btn-camera');
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });
        video.srcObject = cameraStream;
        video.style.display = 'block';
        await video.play();
        cameraActive = true;
        btn.textContent = '⏹ 停止掃描';
        scanCameraFrame();
    } catch (err) {
        toast('無法開啟相機：' + err.message, 'warning');
    }
}

function stopCamera() {
    cameraActive = false;
    const video = document.getElementById('camera-video');
    const btn = document.getElementById('btn-camera');
    if (cameraStream) {
        cameraStream.getTracks().forEach(t => t.stop());
        cameraStream = null;
    }
    video.style.display = 'none';
    video.srcObject = null;
    btn.textContent = '📷 開啟相機掃描';
}

function scanCameraFrame() {
    if (!cameraActive) return;
    const video = document.getElementById('camera-video');
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        requestAnimationFrame(scanCameraFrame);
        return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, canvas.width, canvas.height);
    if (result && result.data) {
        showScanResult(result.data);
        stopCamera();
        return;
    }
    requestAnimationFrame(scanCameraFrame);
}

// ══════════════════════════════════
//  Scanning — File
// ══════════════════════════════════
function scanFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    decodeFromBlob(file);
}

// ══════════════════════════════════
//  Scanning — Clipboard
// ══════════════════════════════════
async function scanClipboard() {
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const blob = await item.getType(type);
                    decodeFromBlob(blob);
                    return;
                }
            }
        }
        toast('剪貼簿中沒有圖片', 'warning');
    } catch (err) {
        toast('讀取剪貼簿失敗：' + err.message, 'warning');
    }
}

// ══════════════════════════════════
//  Scanning — Shared Decoder
// ══════════════════════════════════
function decodeFromBlob(blob) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            // Try zxing first
            try {
                const zxReader = new ZXing.BrowserQRCodeReader();
                zxReader.decodeFromImageElement(img).then(result => {
                    showScanResult(result.text);
                }).catch(() => {
                    tryJsQR(img);
                });
            } catch {
                tryJsQR(img);
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(blob);
}

function tryJsQR(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, canvas.width, canvas.height);
    if (result && result.data) {
        showScanResult(result.data);
    } else {
        toast('未偵測到 QR 碼', 'warning');
    }
}

// ══════════════════════════════════
//  Scan Result Display
// ══════════════════════════════════
function showScanResult(text) {
    const box = document.getElementById('scan-result');
    const input = document.getElementById('decoded-text');
    const linkBtn = document.getElementById('btn-open-link');
    input.value = text;
    box.classList.add('show');
    linkBtn.style.display = isURL(text) ? 'inline-block' : 'none';
    toast('QR 碼解析成功！', 'success');
}

function copyDecoded() {
    const text = document.getElementById('decoded-text').value;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => toast('已複製', 'success'));
}

function openDecoded() {
    const text = document.getElementById('decoded-text').value;
    if (text) window.open(text, '_blank');
}

function useAsContent() {
    const text = document.getElementById('decoded-text').value;
    if (!text) return;
    // Switch to generate tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="generate"]').classList.add('active');
    document.getElementById('tab-generate').classList.add('active');

    if (isURL(text)) {
        selectType('url');
        document.getElementById('f-url').value = text;
    } else {
        selectType('text');
        document.getElementById('f-text').value = text;
    }
    updateQR();
}

function selectType(type) {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.input-form').forEach(f => f.classList.remove('active'));
    document.querySelector(`.type-btn[data-type="${type}"]`).classList.add('active');
    document.getElementById('form-' + type).classList.add('active');
    currentType = type;
}

// ══════════════════════════════════
//  Utilities
// ══════════════════════════════════
function isURL(str) {
    try { const u = new URL(str); return u.protocol === 'http:' || u.protocol === 'https:'; }
    catch { return false; }
}

function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = type + ' show';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.className = ''; }, 2500);
}
