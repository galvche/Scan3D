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
    // Dibuja un recuadro central para guiar al usuario
    const boxSize = Math.floor(Math.min(overlay.width, overlay.height) * 0.7);
    const x = (overlay.width - boxSize) / 2;
    const y = (overlay.height - boxSize) / 2;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 10]);
    ctx.strokeRect(x, y, boxSize, boxSize);
    ctx.setLineDash([]);
    // Si está marcando referencia, dibuja los puntos
    if (markingReference && refPoints.length > 0) {
        ctx.fillStyle = '#ff4c4c';
        refPoints.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
            ctx.fill();
        });
        if (refPoints.length === 2) {
            ctx.strokeStyle = '#ff4c4c';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(refPoints[0].x, refPoints[0].y);
            ctx.lineTo(refPoints[1].x, refPoints[1].y);
            ctx.stroke();
        }
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
    markingReference = false;
    refPoints = [];
    updateBanner();
    startCamera();
});

function updateBanner(msg) {
    if (msg) {
        banner.textContent = msg;
        return;
    }
    if (currentStep < steps.length) {
        banner.textContent = steps[currentStep];
    } else {
        banner.textContent = '¡Listo! Procesando el volumen estimado...';
    }
}

captureBtn.addEventListener('click', () => {
    if (currentStep >= steps.length) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (currentStep === 0 && !pxPerCm) {
        // Pedir al usuario que marque la referencia
        markingReference = true;
        refPoints = [];
        updateBanner('Marca los extremos de la referencia (por ejemplo, una tarjeta) tocando sobre la imagen.');
        drawOverlayBox();
        overlay.style.pointerEvents = 'auto';
        overlay.onclick = function(e) {
            const rect = overlay.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (overlay.width / rect.width);
            const y = (e.clientY - rect.top) * (overlay.height / rect.height);
            refPoints.push({x, y});
            drawOverlayBox();
            if (refPoints.length === 2) {
                overlay.style.pointerEvents = 'none';
                markingReference = false;
                // Calcular distancia en píxeles
                const dx = refPoints[0].x - refPoints[1].x;
                const dy = refPoints[0].y - refPoints[1].y;
                const distPx = Math.sqrt(dx*dx + dy*dy);
                // Asumimos tarjeta de crédito estándar (8.5cm)
                pxPerCm = distPx / 8.5;
                updateBanner();
                // Simulación de detección de objeto y cálculo de dimensiones
                const simulated = simulateObjectDetection(canvas.width, canvas.height);
                views.push(simulated);
                updateViewsList();
                currentStep++;
                updateBanner();
                if (currentStep === steps.length) {
                    showResults(views);
                }
            }
        };
        return;
    }
    // Simulación de detección de objeto y cálculo de dimensiones
    const simulated = simulateObjectDetection(canvas.width, canvas.height);
    views.push(simulated);
    updateViewsList();
    currentStep++;
    updateBanner();
    if (currentStep === steps.length) {
        showResults(views);
    }
});

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
    let dimsText = `Medidas estimadas: Largo: ${maxWidthPx} px, Alto: ${maxHeightPx} px, Ancho: ${maxDepthPx} px`;
    let volText = '';
    if (pxPerCm) {
        const widthCm = (maxWidthPx / pxPerCm).toFixed(1);
        const heightCm = (maxHeightPx / pxPerCm).toFixed(1);
        const depthCm = (maxDepthPx / pxPerCm).toFixed(1);
        const volumeCm3 = (widthCm * heightCm * depthCm).toFixed(0);
        const volumeM3 = (volumeCm3 / 1e6).toFixed(4);
        dimsText = `Medidas estimadas: Largo: ${widthCm} cm, Alto: ${heightCm} cm, Ancho: ${depthCm} cm`;
        volText = `Volumen estimado: ${volumeCm3} cm³ (${volumeM3} m³)`;
    } else {
        const volumePx3 = maxWidthPx * maxHeightPx * maxDepthPx;
        volText = `Volumen estimado: ${volumePx3} px³ (estimación relativa)`;
    }
    dimensionsDiv.textContent = dimsText;
    percentageDiv.textContent = volText;
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
