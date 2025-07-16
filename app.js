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
const banner = document.getElementById('banner');

const cameraErrorDiv = document.getElementById('camera-error');


const activateCameraBtn = document.getElementById('activate-camera');
const cameraActivateContainer = document.getElementById('camera-activate-container');

function drawOverlayBox() {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (mode === 'reference') {
        // Dibuja el rectángulo de referencia
        if (!refRect) {
            // Inicializar centrado
            const w = overlay.width * 0.5;
            const h = overlay.height * 0.18;
            refRect = {x: (overlay.width-w)/2, y: (overlay.height-h)/2, w, h};
        }
        ctx.strokeStyle = '#00eaff';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.strokeRect(refRect.x, refRect.y, refRect.w, refRect.h);
        ctx.setLineDash([]);
        // Esquinas para redimensionar
        ctx.fillStyle = '#ffd700';
        [
            [refRect.x, refRect.y],
            [refRect.x+refRect.w, refRect.y],
            [refRect.x, refRect.y+refRect.h],
            [refRect.x+refRect.w, refRect.y+refRect.h]
        ].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, 2*Math.PI);
            ctx.fill();
        });
    } else if (mode === 'object') {
        // Dibuja el rectángulo del objeto
        const rect = objRects[currentStep] || {x: overlay.width*0.2, y: overlay.height*0.2, w: overlay.width*0.6, h: overlay.height*0.6};
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.setLineDash([16, 10]);
        ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
        ctx.setLineDash([]);
        // Esquinas para redimensionar
        ctx.fillStyle = '#00eaff';
        [
            [rect.x, rect.y],
            [rect.x+rect.w, rect.y],
            [rect.x, rect.y+rect.h],
            [rect.x+rect.w, rect.y+rect.h]
        ].forEach(([x, y]) => {
            ctx.beginPath();
            ctx.arc(x, y, 12, 0, 2*Math.PI);
            ctx.fill();
        });
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        video.srcObject = stream;
        cameraErrorDiv.style.display = 'none';
        video.style.display = '';
        captureBtn.style.display = '';
        resetBtn.style.display = '';
        cameraActivateContainer.style.display = 'none';
        // Ajustar overlay al tamaño del video
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
        try {
            // Si no se puede acceder a la cámara trasera, usar la predeterminada
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            cameraErrorDiv.style.display = 'none';
            video.style.display = '';
            captureBtn.style.display = '';
            resetBtn.style.display = '';
            cameraActivateContainer.style.display = 'none';
        } catch (err2) {
            cameraErrorDiv.textContent = 'No se pudo acceder a la cámara. Revisa los permisos del navegador o prueba con otro navegador.';
            cameraErrorDiv.style.display = 'block';
        }
    }
}

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

function updateBanner(msg) {
    if (msg) {
        banner.innerHTML = msg;
        return;
    }
    if (currentStep < steps.length) {
        banner.textContent = steps[currentStep];
    } else {
        banner.textContent = '¡Listo! Procesando el volumen estimado...';
    }
}

captureBtn.addEventListener('click', () => {
    if (mode === 'reference') {
        // Calcular px/cm usando el ancho del rectángulo (asume 8.5cm)
        pxPerCm = refRect.w / 8.5;
        mode = 'object';
        currentStep = 0;
        updateBanner('<b>Paso 2: Escaneo del objeto</b><br>' +
          '<span style="font-size:1.3em;">📦</span><br>' +
          'Ajusta el rectángulo dorado para que encierre el objeto desde la vista <b>frontal</b> y pulsa "Capturar vista".<br>' +
          '<span style="font-size:0.95em; color:#aaa;">Puedes mover y redimensionar el rectángulo con el dedo o ratón.</span>');
        captureBtn.textContent = 'Capturar vista';
        drawOverlayBox();
        return;
    }
    if (mode === 'object') {
        if (currentStep >= steps.length) {
            mode = 'done';
            showResults(views);
            return;
        }
        // Captura la vista y el rectángulo del objeto
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Guardar el rectángulo actual
        const rect = objRects[currentStep] || {x: overlay.width*0.2, y: overlay.height*0.2, w: overlay.width*0.6, h: overlay.height*0.6};
        views.push({
            width: rect.w,
            height: rect.h,
            depth: rect.w // Para demo, usar w como profundidad
        });
        currentStep++;
        if (currentStep < steps.length) {
            let viewName = steps[currentStep].replace('Captura la ', '').replace(' del objeto.', '');
            updateBanner('<b>Paso 2: Escaneo del objeto</b><br>' +
              '<span style="font-size:1.3em;">📦</span><br>' +
              'Ajusta el rectángulo dorado para la vista <b>' + viewName + '</b> y pulsa "Capturar vista".<br>' +
              '<span style="font-size:0.95em; color:#aaa;">Puedes mover y redimensionar el rectángulo con el dedo o ratón.</span>');
            drawOverlayBox();
        } else {
            mode = 'done';
            updateBanner('<b>¡Escaneo completo!</b><br>Procesando medidas y volumen...');
            showResults(views);
        }
    }
});
// Overlay interactivo para mover/redimensionar el rectángulo
overlay.addEventListener('mousedown', function(e) {
    if (mode !== 'reference' && mode !== 'object') return;
    const rect = overlay.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (overlay.width / rect.width);
    const my = (e.clientY - rect.top) * (overlay.height / rect.height);
    let r = (mode === 'reference') ? refRect : (objRects[currentStep] || {x: overlay.width*0.2, y: overlay.height*0.2, w: overlay.width*0.6, h: overlay.height*0.6});
    // ¿Click en handle?
    const handles = [
        [r.x, r.y],
        [r.x+r.w, r.y],
        [r.x, r.y+r.h],
        [r.x+r.w, r.y+r.h]
    ];
    for (let i=0; i<handles.length; i++) {
        const [hx, hy] = handles[i];
        if (Math.abs(mx-hx)<18 && Math.abs(my-hy)<18) {
            dragHandle = i;
            isDragging = true;
            return;
        }
    }
    // ¿Click dentro del rectángulo?
    if (mx > r.x && mx < r.x+r.w && my > r.y && my < r.y+r.h) {
        dragHandle = 'move';
        isDragging = true;
        dragOffset = {x: mx - r.x, y: my - r.y};
    }
});
overlay.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    const rect = overlay.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (overlay.width / rect.width);
    const my = (e.clientY - rect.top) * (overlay.height / rect.height);
    let r = (mode === 'reference') ? refRect : (objRects[currentStep] || {x: overlay.width*0.2, y: overlay.height*0.2, w: overlay.width*0.6, h: overlay.height*0.6});
    if (dragHandle === 'move') {
        r.x = mx - dragOffset.x;
        r.y = my - dragOffset.y;
    } else if (typeof dragHandle === 'number') {
        // Redimensionar según handle
        switch(dragHandle) {
            case 0: // top-left
                r.w += r.x - mx; r.h += r.y - my; r.x = mx; r.y = my; break;
            case 1: // top-right
                r.w = mx - r.x; r.h += r.y - my; r.y = my; break;
            case 2: // bottom-left
                r.w += r.x - mx; r.x = mx; r.h = my - r.y; break;
            case 3: // bottom-right
                r.w = mx - r.x; r.h = my - r.y; break;
        }
        // Mínimo tamaño
        r.w = Math.max(30, r.w); r.h = Math.max(20, r.h);
    }
    if (mode === 'reference') refRect = r;
    else objRects[currentStep] = r;
    drawOverlayBox();
});
overlay.addEventListener('mouseup', function() { isDragging = false; dragHandle = null; });
overlay.addEventListener('mouseleave', function() { isDragging = false; dragHandle = null; });

resetBtn.addEventListener('click', () => {
    views = [];
    updateViewsList();
    clearResults();
});

function updateViewsList() {
    if (views.length === 0) {
        viewsList.textContent = 'No hay vistas capturadas.';
    } else {
        viewsList.innerHTML = 'Vistas capturadas: ' + views.map((v, i) => `Vista ${i+1}`).join(', ');
    }
}

function clearResults() {
    dimensionsDiv.textContent = '';
    percentageDiv.textContent = '';
    threejsContainer.innerHTML = '';
}

function simulateObjectDetection(width, height) {
    // Simula un objeto centrado dentro del recuadro overlay
    const boxSize = Math.floor(Math.min(width, height) * 0.7);
    const objWidth = boxSize * (0.9 + Math.random() * 0.1); // 90-100% del recuadro
    const objHeight = boxSize * (0.9 + Math.random() * 0.1);
    const objDepth = boxSize * (0.7 + Math.random() * 0.2); // profundidad algo menor
    return {
        width: objWidth,
        height: objHeight,
        depth: objDepth
    };
}

function showResults(views) {
    if (views.length < 4) {
        clearResults();
        return;
    }
    // Tomar el máximo de cada dimensión como aproximación del volumen total
    const maxWidthPx = Math.max(...views.map(v => v.width));
    const maxHeightPx = Math.max(...views.map(v => v.height));
    const maxDepthPx = Math.max(...views.map(v => v.depth));
    let dimsText = `Medidas estimadas:<br><b>Largo:</b> ${maxWidthPx} px<br><b>Alto:</b> ${maxHeightPx} px<br><b>Ancho:</b> ${maxDepthPx} px`;
    let volText = '';
    if (pxPerCm) {
        const widthCm = (maxWidthPx / pxPerCm).toFixed(1);
        const heightCm = (maxHeightPx / pxPerCm).toFixed(1);
        const depthCm = (maxDepthPx / pxPerCm).toFixed(1);
        const volumeCm3 = (widthCm * heightCm * depthCm).toFixed(0);
        const volumeM3 = (volumeCm3 / 1e6).toFixed(4);
        dimsText = `Medidas estimadas:<br><b>Largo:</b> ${widthCm} cm<br><b>Alto:</b> ${heightCm} cm<br><b>Ancho:</b> ${depthCm} cm`;
        volText = `<b>Volumen estimado:</b> ${volumeCm3} cm³<br>(${volumeM3} m³)`;
    } else {
        const volumePx3 = maxWidthPx * maxHeightPx * maxDepthPx;
        volText = `<b>Volumen estimado:</b> ${volumePx3} px³ (estimación relativa)`;
    }
    dimensionsDiv.innerHTML = dimsText;
    percentageDiv.innerHTML = volText;
    render3DObject(maxWidthPx, maxHeightPx, maxDepthPx, 400, true);
}
// Redibujar overlay en cada frame de video
video.addEventListener('play', function() {
    function loop() {
        if (!video.paused && !video.ended) {
            drawOverlayBox();
            requestAnimationFrame(loop);
        }
    }
    loop();
});

function render3DObject(objWidth, objHeight, objDepth, cubeSize, darkMode = false) {
    threejsContainer.innerHTML = '';
    const scene = new THREE.Scene();
    if (darkMode) scene.background = new THREE.Color(0x181a20);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    threejsContainer.appendChild(renderer.domElement);

    // Cubo wireframe
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x0078d7, wireframe: true, opacity: 0.2, transparent: true });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    scene.add(cube);

    // Objeto: forma más realista (simulación: elipsoide dentro del cubo)
    const objGeometry = new THREE.SphereGeometry(Math.max(objWidth, objHeight, objDepth) / 2, 32, 32);
    const objMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffa500, roughness: 0.4, metalness: 0.2, opacity: 0.85, transparent: true });
    const object = new THREE.Mesh(objGeometry, objMaterial);
    object.scale.set(objWidth / cubeSize, objHeight / cubeSize, objDepth / cubeSize);
    scene.add(object);

    camera.position.set(0, cubeSize * 0.3, cubeSize * 1.7);
    camera.lookAt(0, 0, 0);

    // Luz
    const light = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(light);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(1, 2, 2);
    scene.add(dirLight);

    // Control de rotación
    let angle = 0;
    function animate() {
        requestAnimationFrame(animate);
        cube.rotation.y = angle;
        object.rotation.y = angle;
        angle += 0.01;
        renderer.render(scene, camera);
    }
    animate();
}
