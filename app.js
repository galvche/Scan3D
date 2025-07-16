// Acceso a la cámara trasera
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const captureBtn = document.getElementById('capture');
const resetBtn = document.getElementById('reset');
const dimensionsDiv = document.getElementById('dimensions');
const percentageDiv = document.getElementById('percentage');
const threejsContainer = document.getElementById('threejs-container');
const viewsList = document.getElementById('views-list');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressLabel = document.getElementById('progress-label');
const loadingSpinner = document.getElementById('loading-spinner');
const banner = document.getElementById('banner');
const cameraErrorDiv = document.getElementById('camera-error');
const activateCameraBtn = document.getElementById('activate-camera');
const cameraActivateContainer = document.getElementById('camera-activate-container');
const cameraSelect = document.getElementById('camera-select');
const cameraHelp = document.getElementById('camera-help');

let views = [];
const steps = [
    'Captura la vista FRONTAL del objeto.',
    'Captura la vista TRASERA del objeto.',
    'Captura la vista LATERAL IZQUIERDA.',
    'Captura la vista LATERAL DERECHA.'
];
let mode = 'reference'; // 'reference', 'object', 'done'
let refRect = null; // {x, y, w, h} en referencia
let dragHandle = null;
let isDragging = false;
let dragOffset = {x:0, y:0};
let objRects = [];
let currentStep = 0;
let pxPerCm = null;
let markingReference = false;
let refPoints = [];

function drawOverlayBox() {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const margin = Math.max(overlay.width, overlay.height) * 0.025; // 2.5%

    if (mode === 'reference') {
        if (!refRect) {
            const w = overlay.width * 0.5;
            const h = overlay.height * 0.18;
            refRect = {x: (overlay.width - w) / 2, y: (overlay.height - h) / 2, w, h};
        }
        refRect.x = Math.max(margin, refRect.x);
        refRect.y = Math.max(margin, refRect.y);
        refRect.w = Math.min(refRect.w, overlay.width - refRect.x - margin);
        refRect.h = Math.min(refRect.h, overlay.height - refRect.y - margin);

        ctx.strokeStyle = '#00eaff';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.strokeRect(refRect.x, refRect.y, refRect.w, refRect.h);
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffd700';
        [
            [refRect.x, refRect.y],
            [refRect.x + refRect.w, refRect.y],
            [refRect.x, refRect.y + refRect.h],
            [refRect.x + refRect.w, refRect.y + refRect.h]
        ].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, 2 * Math.PI);
            ctx.fill();
        });
    } else if (mode === 'object') {
        let rect = objRects[currentStep] || {x: overlay.width * 0.2, y: overlay.height * 0.2, w: overlay.width * 0.6, h: overlay.height * 0.6};
        rect.x = Math.max(margin, rect.x);
        rect.y = Math.max(margin, rect.y);
        rect.w = Math.min(rect.w, overlay.width - rect.x - margin);
        rect.h = Math.min(rect.h, overlay.height - rect.y - margin);
        objRects[currentStep] = rect;

        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.setLineDash([16, 10]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.setLineDash([]);

        ctx.fillStyle = '#00eaff';
        [
            [rect.x, rect.y],
            [rect.x + rect.w, rect.y],
            [rect.x, rect.y + rect.h],
            [rect.x + rect.w, rect.y + rect.h]
        ].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

async function getBackCameraStream() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        let backCamera = videoDevices.find(dev => dev.label.toLowerCase().includes('back')) || videoDevices[0];
        return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: backCamera.deviceId ? { exact: backCamera.deviceId } : undefined },
            audio: false
        });
    } catch {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
}

async function startCamera(deviceId) {
    try {
        let constraints = deviceId ? { video: { deviceId: { exact: deviceId } }, audio: false } : { video: { facingMode: { exact: "environment" } }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        cameraErrorDiv.style.display = 'none';
        video.style.display = '';
        captureBtn.style.display = '';
        resetBtn.style.display = '';
        cameraActivateContainer.style.display = 'none';
        video.onloadedmetadata = () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            drawOverlayBox();
        };
        video.onplay = () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            drawOverlayBox();
        };
    } catch (err) {
        cameraErrorDiv.textContent = 'No se pudo acceder a la cámara. Revisa los permisos del navegador o prueba con otro navegador.';
        cameraErrorDiv.style.display = 'block';
    }
}

async function getCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
}

// Inicializar selector de cámara
getCameras().then(cameras => {
    if (cameras.length > 1) {
        cameraSelect.innerHTML = '';
        cameras.forEach((cam, i) => {
            const label = cam.label || `Cámara ${i + 1}`;
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = label;
            cameraSelect.appendChild(opt);
        });
        cameraSelect.style.display = 'inline-block';
    } else {
        cameraSelect.style.display = 'none';
    }
});

cameraSelect.addEventListener('change', () => {
    startCamera(cameraSelect.value);
});

activateCameraBtn.addEventListener('click', () => {
    currentStep = 0;
    views = [];
    pxPerCm = null;
    refRect = null;
    objRects = [];
    mode = 'reference';
    updateBanner('<b>Paso 1: Referencia de escala</b><br>' +
        '<span style="font-size:1.5em;">💳</span><br>' +
        'Ajusta el rectángulo azul para que encierre tu tarjeta de crédito, DNI o regla (8.5cm de ancho recomendado).<br>' +
        '<span style="color:#ffd700;">Esto servirá para calcular las medidas reales del objeto.</span><br>' +
        '<span style="font-size:0.95em; color:#aaa;">Puedes mover y redimensionar el rectángulo con el dedo o ratón.</span>');
    startCamera();
    video.onloadedmetadata = () => {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        drawOverlayBox();
        overlay.style.pointerEvents = 'auto';
    };
    captureBtn.textContent = 'Capturar referencia';
    captureBtn.disabled = false;
});

function updateProgressBar() {
    const totalSteps = 1 + steps.length; // referencia + vistas
    const current = mode === 'reference' ? 1 : (mode === 'object' ? currentStep + 2 : totalSteps);
    const percent = Math.round((current / totalSteps) * 100);
    progressBarFill.style.width = percent + '%';
    progressLabel.textContent = `Paso ${current}/${totalSteps}`;
}

function updateBanner(msg) {
    updateProgressBar();
    if (msg) {
        banner.innerHTML = msg;
        return;
    }
    if (currentStep < steps.length) {
        const viewName = steps[currentStep].replace('Captura la ', '').replace(' del objeto.', '');
        banner.innerHTML = `<b>Paso 2: Escaneo del objeto</b><br><span style="font-size:1.3em;">📦</span><br>Vista <b>${viewName}</b><br>${steps[currentStep]}`;
    } else {
        banner.innerHTML = '<b>¡Medición completada!</b><br>Puede ver sus vistas capturadas y las dimensiones medidas.';
    }
}

function measureDimensions(rect) {
    if (!pxPerCm) return null;
    const widthCm = rect.w / pxPerCm;
    const heightCm = rect.h / pxPerCm;
    return {widthCm, heightCm};
}

captureBtn.addEventListener('click', () => {
    if (mode === 'reference') {
        // Calcular pxPerCm usando la tarjeta estándar: 8.5 cm de ancho
        const standardWidthCm = 8.5;
        pxPerCm = refRect.w / standardWidthCm;
        mode = 'object';
        updateBanner();
        captureBtn.textContent = 'Capturar vista';
        objRects[currentStep] = null;
        drawOverlayBox();
    } else if (mode === 'object') {
        // Capturar vista
        if (!objRects[currentStep]) {
            alert('Por favor, ajuste el rectángulo antes de capturar.');
            return;
        }
        // Guardar imagen de la cámara recortada a la selección
        const ctx = canvas.getContext('2d');
        canvas.width = objRects[currentStep].w;
        canvas.height = objRects[currentStep].h;
        ctx.drawImage(video,
            objRects[currentStep].x, objRects[currentStep].y,
            objRects[currentStep].w, objRects[currentStep].h,
            0, 0,
            objRects[currentStep].w, objRects[currentStep].h);
        const imgDataUrl = canvas.toDataURL('image/png');
        views[currentStep] = {
            img: imgDataUrl,
            dims: measureDimensions(objRects[currentStep]),
            rect: {...objRects[currentStep]}
        };
        currentStep++;
        if (currentStep >= steps.length) {
            mode = 'done';
            captureBtn.disabled = true;
            resetBtn.style.display = '';
            updateBanner();
            showCapturedViews();
        } else {
            objRects[currentStep] = null;
            updateBanner();
            drawOverlayBox();
        }
    }
});

resetBtn.addEventListener('click', () => {
    currentStep = 0;
    views = [];
    pxPerCm = null;
    refRect = null;
    objRects = [];
    mode = 'reference';
    updateBanner('<b>Paso 1: Referencia de escala</b><br>' +
        '<span style="font-size:1.5em;">💳</span><br>' +
        'Ajusta el rectángulo azul para que encierre tu tarjeta de crédito, DNI o regla (8.5cm de ancho recomendado).<br>' +
        '<span style="color:#ffd700;">Esto servirá para calcular las medidas reales del objeto.</span><br>' +
        '<span style="font-size:0.95em; color:#aaa;">Puedes mover y redimensionar el rectángulo con el dedo o ratón.</span>');
    captureBtn.textContent = 'Capturar referencia';
    captureBtn.disabled = false;
    drawOverlayBox();
});

function showCapturedViews() {
    viewsList.innerHTML = '';
    views.forEach((view, i) => {
        const div = document.createElement('div');
        div.className = 'view-item';
        div.innerHTML = `
            <img src="${view.img}" alt="Vista ${i + 1}" width="160" style="border:1px solid #666; border-radius:8px;">
            <div>Dimensiones aprox: ${view.dims.widthCm.toFixed(1)}cm x ${view.dims.heightCm.toFixed(1)}cm</div>
        `;
        viewsList.appendChild(div);
    });
    viewsList.style.display = 'flex';
    threejsContainer.style.display = 'block';
}

// Manejo de interacción para mover y redimensionar rectángulos
overlay.addEventListener('mousedown', startDrag);
overlay.addEventListener('touchstart', startDrag);

overlay.addEventListener('mousemove', onDrag);
overlay.addEventListener('touchmove', onDrag);

overlay.addEventListener('mouseup', endDrag);
overlay.addEventListener('mouseleave', endDrag);
overlay.addEventListener('touchend', endDrag);
overlay.addEventListener('touchcancel', endDrag);

function getMousePos(evt) {
    const rect = overlay.getBoundingClientRect();
    if (evt.touches) {
        return {
            x: evt.touches[0].clientX - rect.left,
            y: evt.touches[0].clientY - rect.top
        };
    } else {
        return {
            x: evt.clientX - rect.left,
            y: evt.clientY - rect.top
        };
    }
}

function isOnHandle(pos, rect) {
    const handles = [
        {name: 'tl', x: rect.x, y: rect.y},
        {name: 'tr', x: rect.x + rect.w, y: rect.y},
        {name: 'bl', x: rect.x, y: rect.y + rect.h},
        {name: 'br', x: rect.x + rect.w, y: rect.y + rect.h}
    ];
    for (const handle of handles) {
        const dx = pos.x - handle.x;
        const dy = pos.y - handle.y;
        if (Math.sqrt(dx*dx + dy*dy) < 15) return handle.name;
    }
    return null;
}

function startDrag(evt) {
    evt.preventDefault();
    const pos = getMousePos(evt);
    let rect = (mode === 'reference') ? refRect : objRects[currentStep];
    if (!rect) return;

    const handle = isOnHandle(pos, rect);
    if (handle) {
        dragHandle = handle;
        isDragging = true;
        dragOffset.x = pos.x;
        dragOffset.y = pos.y;
    } else if (pos.x > rect.x && pos.x < rect.x + rect.w && pos.y > rect.y && pos.y < rect.y + rect.h) {
        dragHandle = 'move';
        isDragging = true;
        dragOffset.x = pos.x - rect.x;
        dragOffset.y = pos.y - rect.y;
    }
}

function onDrag(evt) {
    if (!isDragging) return;
    evt.preventDefault();
    const pos = getMousePos(evt);
    let rect = (mode === 'reference') ? refRect : objRects[currentStep];
    if (!rect) return;

    const minSize = 30;
    const maxX = overlay.width;
    const maxY = overlay.height;

    switch (dragHandle) {
        case 'move':
            let newX = pos.x - dragOffset.x;
            let newY = pos.y - dragOffset.y;
            newX = Math.min(Math.max(0, newX), maxX - rect.w);
            newY = Math.min(Math.max(0, newY), maxY - rect.h);
            rect.x = newX;
            rect.y = newY;
            break;
        case 'tl':
            const newWtl = rect.w + (rect.x - pos.x);
            const newHtl = rect.h + (rect.y - pos.y);
            if (newWtl >= minSize) {
                rect.x = pos.x;
                rect.w = newWtl;
            }
            if (newHtl >= minSize) {
                rect.y = pos.y;
                rect.h = newHtl;
            }
            break;
        case 'tr':
            const newWtr = pos.x - rect.x;
            const newHtr = rect.h + (rect.y - pos.y);
            if (newWtr >= minSize) rect.w = newWtr;
            if (newHtr >= minSize) {
                rect.y = pos.y;
                rect.h = newHtr;
            }
            break;
        case 'bl':
            const newWbl = rect.w + (rect.x - pos.x);
            const newHbl = pos.y - rect.y;
            if (newWbl >= minSize) {
                rect.x = pos.x;
                rect.w = newWbl;
            }
            if (newHbl >= minSize) rect.h = newHbl;
            break;
        case 'br':
            const newWbr = pos.x - rect.x;
            const newHbr = pos.y - rect.y;
            if (newWbr >= minSize) rect.w = newWbr;
            if (newHbr >= minSize) rect.h = newHbr;
            break;
    }
    drawOverlayBox();
}

function endDrag(evt) {
    if (isDragging) {
        isDragging = false;
        dragHandle = null;
    }
}

updateBanner('<b>Pulse "Activar Cámara" para comenzar.</b>');

