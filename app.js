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

// NUEVOS ELEMENTOS PARA CAPAS Y BOTÓN "SACAR"
const layersButton = document.createElement('button');
layersButton.id = 'layers-button';
layersButton.textContent = '+';
layersButton.title = 'Seleccionar capas';
layersButton.style.position = 'absolute';
layersButton.style.top = '10px';
layersButton.style.right = '80px';
layersButton.style.backgroundColor = '#007FFF'; // Azul Airbus
layersButton.style.color = 'white';
layersButton.style.border = 'none';
layersButton.style.borderRadius = '4px';
layersButton.style.width = '32px';
layersButton.style.height = '32px';
layersButton.style.cursor = 'pointer';
layersButton.style.fontSize = '24px';
layersButton.style.fontWeight = 'bold';
layersButton.style.zIndex = '1000';

const layersMenu = document.createElement('div');
layersMenu.id = 'layers-menu';
layersMenu.style.position = 'absolute';
layersMenu.style.top = '50px';
layersMenu.style.right = '80px';
layersMenu.style.backgroundColor = '#222';
layersMenu.style.border = '1px solid #007FFF';
layersMenu.style.borderRadius = '4px';
layersMenu.style.padding = '8px';
layersMenu.style.display = 'none';
layersMenu.style.zIndex = '1000';

// Ejemplo de capas - adaptar según su implementación real
const capas = ['Capa 1', 'Capa 2', 'Capa 3'];
const capasCheckboxes = [];

capas.forEach((capa, i) => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.color = 'white';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true; // Por defecto activadas
    checkbox.dataset.layerIndex = i;
    capasCheckboxes.push(checkbox);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(' ' + capa));
    layersMenu.appendChild(label);
});

document.body.appendChild(layersButton);
document.body.appendChild(layersMenu);

layersButton.addEventListener('click', () => {
    layersMenu.style.display = layersMenu.style.display === 'none' ? 'block' : 'none';
});

// Botón SACAR, abajo a la derecha
const sacarBtn = document.createElement('button');
sacarBtn.id = 'sacar-button';
sacarBtn.textContent = 'Sacar';
sacarBtn.style.position = 'fixed';
sacarBtn.style.bottom = '20px';
sacarBtn.style.right = '20px';
sacarBtn.style.backgroundColor = '#007FFF'; // Azul Airbus
sacarBtn.style.color = 'white';
sacarBtn.style.border = 'none';
sacarBtn.style.borderRadius = '8px';
sacarBtn.style.padding = '12px 24px';
sacarBtn.style.fontSize = '18px';
sacarBtn.style.fontWeight = 'bold';
sacarBtn.style.cursor = 'pointer';
sacarBtn.style.zIndex = '1000';

document.body.appendChild(sacarBtn);

// Aquí puede añadir la funcionalidad que quiera para el botón "Sacar"
sacarBtn.addEventListener('click', () => {
    alert('Funcionalidad de sacar aún no implementada, señor Stark.');
});

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
    if (mode === 'reference') refRect = rect; else objRects[currentStep] = rect;
    drawOverlayBox();
    updateDimensionsDisplay();
}

function pointerUp(event) {
    isDragging = false;
    dragHandle = null;
}

captureBtn.addEventListener('click', () => {
    if (mode === 'reference') {
        if (!refRect) {
            alert('Por favor, seleccione un área de referencia primero.');
            return;
        }
        // Pedir tamaño real para establecer pxPerCm
        let input = prompt('Ingrese la anchura real en cm del área seleccionada (referencia):');
        if (!input || isNaN(input) || input <= 0) {
            alert('Valor inválido.');
            return;
        }
        const refCm = parseFloat(input);
        pxPerCm = refRect.w / refCm;
        mode = 'object';
        currentStep = 0;
        views = [];
        objRects = [];
        alert(steps[currentStep]);
        drawOverlayBox();
        updateDimensionsDisplay();
        banner.textContent = steps[currentStep];
    } else if (mode === 'object') {
        if (!objRects[currentStep]) {
            alert('Por favor, seleccione un área para esta vista.');
            return;
        }
        // Capturar imagen dentro del rectángulo seleccionado
        const rect = objRects[currentStep];
        canvas.width = rect.w;
        canvas.height = rect.h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        const dataUrl = canvas.toDataURL('image/png');
        views[currentStep] = dataUrl;
        currentStep++;
        if (currentStep >= steps.length) {
            mode = 'done';
            banner.textContent = 'Captura completa. Gracias, señor Stark.';
            alert('Captura completa. Puede descargar o continuar con otro proceso.');
            // Aquí puede agregar la función para descargar o visualizar las capturas
        } else {
            banner.textContent = steps[currentStep];
            alert(steps[currentStep]);
            drawOverlayBox();
            updateDimensionsDisplay();
        }
    }
});

resetBtn.addEventListener('click', () => {
    if (mode === 'reference') {
        refRect = null;
        pxPerCm = null;
    } else if (mode === 'object') {
        objRects[currentStep] = null;
    }
    drawOverlayBox();
    updateDimensionsDisplay();
});

overlay.addEventListener('mousedown', pointerDown);
overlay.addEventListener('touchstart', pointerDown, { passive: false });
window.addEventListener('mousemove', pointerMove);
window.addEventListener('touchmove', pointerMove, { passive: false });
window.addEventListener('mouseup', pointerUp);
window.addEventListener('touchend', pointerUp);

activateCameraBtn.addEventListener('click', () => {
    const selectedDeviceId = cameraSelect.value;
    startCamera(selectedDeviceId);
});

// Llenar selector de cámaras si es posible
async function populateCameraSelect() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        cameraSelect.innerHTML = '';
        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Cámara ${cameraSelect.length + 1}`;
            cameraSelect.appendChild(option);
        });
        cameraSelect.style.display = videoDevices.length > 1 ? '' : 'none';
    } catch {
        cameraSelect.style.display = 'none';
    }
}

cameraSelect.addEventListener('change', () => {
    startCamera(cameraSelect.value);
});

// Al iniciar, pedir permisos y mostrar cámara
window.onload = async () => {
    await populateCameraSelect();
    cameraActivateContainer.style.display = '';
}
async function populateCameraSelect() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        cameraSelect.innerHTML = ''; // limpiar opciones
        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Cámara ${cameraSelect.length + 1}`;
            cameraSelect.appendChild(option);
        });
        if (videoDevices.length === 0) {
            cameraErrorDiv.textContent = 'No se encontraron cámaras disponibles.';
            cameraErrorDiv.style.display = 'block';
        } else {
            cameraErrorDiv.style.display = 'none';
        }
    } catch (err) {
        cameraErrorDiv.textContent = 'Error al enumerar cámaras: ' + err.message;
        cameraErrorDiv.style.display = 'block';
    }
}
;
