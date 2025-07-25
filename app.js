// Acceso a la cámara trasera
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const captureBtn = document.getElementById('capture');
const resetBtn = document.getElementById('reset');
const dimensionsDiv = document.getElementById('dimensions');
const percentageDiv = document.getElementById('percentage');
const banner = document.getElementById('banner');
const cameraErrorDiv = document.getElementById('camera-error');
const cameraActivateContainer = document.getElementById('camera-activate-container');

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
            updateDimensionsDisplay();
        };
        video.onplay = () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            drawOverlayBox();
            updateDimensionsDisplay();
        };
    } catch (err) {
        cameraErrorDiv.textContent = 'No se pudo acceder a la cámara. Revisa los permisos del navegador o prueba con otro navegador.';
        cameraErrorDiv.style.display = 'block';
    }
}

function updateDimensionsDisplay() {
    let rect = (mode === 'reference') ? refRect : objRects[currentStep];
    if (!rect) {
        dimensionsDiv.textContent = 'Área no seleccionada';
        percentageDiv.textContent = '';
        return;
    }
    const dims = measureDimensions(rect);
    if (!dims) {
        dimensionsDiv.textContent = 'Dimensiones desconocidas';
        percentageDiv.textContent = '';
        return;
    }
    dimensionsDiv.textContent = `Ancho: ${dims.widthCm.toFixed(2)} cm, Alto: ${dims.heightCm.toFixed(2)} cm`;

    // Mostrar porcentaje del área respecto al total del video
    const areaSelected = rect.w * rect.h;
    const areaTotal = overlay.width * overlay.height;
    const percent = (areaSelected / areaTotal) * 100;
    percentageDiv.textContent = `Área seleccionada: ${percent.toFixed(1)}% del total`;
}

function measureDimensions(rect) {
    if (!rect || !pxPerCm) return null;
    return {
        widthCm: rect.w / pxPerCm,
        heightCm: rect.h / pxPerCm
    };
}

function canvasCoordinates(event) {
    const rect = overlay.getBoundingClientRect();
    let x, y;
    if (event.touches) {
        x = event.touches[0].clientX - rect.left;
        y = event.touches[0].clientY - rect.top;
    } else {
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
    }
    return { x, y };
}

function getHandleUnderPoint(rect, x, y) {
    const handles = [
        {name: 'tl', x: rect.x, y: rect.y},
        {name: 'tr', x: rect.x + rect.w, y: rect.y},
        {name: 'bl', x: rect.x, y: rect.y + rect.h},
        {name: 'br', x: rect.x + rect.w, y: rect.y + rect.h},
    ];
    for (let h of handles) {
        if (Math.abs(x - h.x) < 15 && Math.abs(y - h.y) < 15) return h.name;
    }
    return null;
}

function pointerDown(event) {
    event.preventDefault();
    const {x, y} = canvasCoordinates(event);
    let rect = (mode === 'reference') ? refRect : objRects[currentStep];
    if (!rect) return;
    let handle = getHandleUnderPoint(rect, x, y);
    if (handle) {
        dragHandle = handle;
        isDragging = true;
    } else if (x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h) {
        dragHandle = 'move';
        isDragging = true;
        dragOffset.x = x - rect.x;
        dragOffset.y = y - rect.y;
    }
}

function pointerMove(event) {
    if (!isDragging) return;
    event.preventDefault();
    const {x, y} = canvasCoordinates(event);
    let rect = (mode === 'reference') ? refRect : objRects[currentStep];
    if (!rect) return;
    switch (dragHandle) {
        case 'tl':
            rect.w += rect.x - x;
            rect.h += rect.y - y;
            rect.x = x;
            rect.y = y;
            break;
        case 'tr':
            rect.w = x - rect.x;
            rect.h += rect.y - y;
            rect.y = y;
            break;
        case 'bl':
            rect.w += rect.x - x;
            rect.x = x;
            rect.h = y - rect.y;
            break;
        case 'br':
            rect.w = x - rect.x;
            rect.h = y - rect.y;
            break;
        case 'move':
            rect.x = x - dragOffset.x;
            rect.y = y - dragOffset.y;
            break;
    }
    if (mode === 'reference') {
        refRect = rect;
    } else {
        objRects[currentStep] = rect;
    }
    drawOverlayBox();
    updateDimensionsDisplay();
}

function pointerUp(event) {
    if (isDragging) {
        isDragging = false;
        dragHandle = null;
    }
}

function captureImage() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (mode === 'reference') {
        // Calcular pxPerCm usando el área de referencia y tamaño real
        const realHeightCm = 3.0; // Ejemplo, debe ajustarse a la etiqueta real
        pxPerCm = refRect.h / realHeightCm;
        banner.textContent = `Referencia establecida. ${pxPerCm.toFixed(2)} px/cm. Proceda a capturar la vista ${steps[currentStep]}`;
        mode = 'object';
        drawOverlayBox();
    } else if (mode === 'object') {
        // Guardar rectángulo
        banner.textContent = `Vista "${steps[currentStep]}" capturada.`;
        currentStep++;
        if (currentStep >= steps.length) {
            banner.textContent = 'Captura completada.';
            mode = 'done';
            captureBtn.style.display = 'none';
            resetBtn.style.display = 'none';
        } else {
            banner.textContent = `Proceda a capturar la vista ${steps[currentStep]}.`;
        }
        drawOverlayBox();
    }
    updateDimensionsDisplay();
}

function resetAll() {
    refRect = null;
    objRects = [];
    currentStep = 0;
    mode = 'reference';
    pxPerCm = null;
    banner.textContent = 'Seleccione el área de referencia y presione capturar.';
    captureBtn.style.display = '';
    resetBtn.style.display = '';
    drawOverlayBox();
    updateDimensionsDisplay();
}

overlay.addEventListener('pointerdown', pointerDown);
overlay.addEventListener('pointermove', pointerMove);
overlay.addEventListener('pointerup', pointerUp);
overlay.addEventListener('pointerleave', pointerUp);

captureBtn.addEventListener('click', captureImage);
resetBtn.addEventListener('click', resetAll);

startCamera();
