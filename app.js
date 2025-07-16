// Acceso a la cámara trasera
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const resetBtn = document.getElementById('reset');
const dimensionsDiv = document.getElementById('dimensions');
const percentageDiv = document.getElementById('percentage');
const threejsContainer = document.getElementById('threejs-container');
const viewsList = document.getElementById('views-list');

let views = [];
const steps = [
    'Coloca una referencia de tamaño conocida (por ejemplo, una tarjeta de crédito o regla) junto al objeto y captura la vista FRONTAL.',
    'Gira el objeto y captura la vista TRASERA.',
    'Gira el objeto y captura la vista LATERAL IZQUIERDA.',
    'Gira el objeto y captura la vista LATERAL DERECHA.'
];
let currentStep = 0;
let referenceSizeCm = 8.5; // ancho de una tarjeta de crédito estándar
let pxPerCm = null;
const stepInstructions = document.getElementById('step-instructions');

const cameraErrorDiv = document.getElementById('camera-error');


const activateCameraBtn = document.getElementById('activate-camera');
const cameraActivateContainer = document.getElementById('camera-activate-container');

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
    updateStepInstructions();
    startCamera();
});

function updateStepInstructions() {
    if (currentStep < steps.length) {
        stepInstructions.textContent = steps[currentStep];
    } else {
        stepInstructions.textContent = '¡Listo! Procesando el volumen estimado...';
    }
}

captureBtn.addEventListener('click', () => {
    if (currentStep >= steps.length) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // En la primera vista, pedir al usuario que marque la referencia
    if (currentStep === 0) {
        // Simulación: pedir al usuario el tamaño de la referencia en la imagen
        let px = prompt('¿Cuántos píxeles mide la referencia (tarjeta/regla) en la imagen? (usa una app de medición o estima el ancho en la foto)');
        px = parseFloat(px);
        if (!px || px <= 0) {
            alert('Debes indicar el tamaño en píxeles de la referencia.');
            return;
        }
        pxPerCm = px / referenceSizeCm;
    }
    // Simulación de detección de objeto y cálculo de dimensiones
    const simulated = simulateObjectDetection(canvas.width, canvas.height);
    views.push(simulated);
    updateViewsList();
    currentStep++;
    updateStepInstructions();
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
    // Simula un objeto de tamaño aleatorio dentro del área de la imagen
    const objWidth = Math.floor(width * (0.3 + Math.random() * 0.4));
    const objHeight = Math.floor(height * (0.3 + Math.random() * 0.4));
    const objDepth = Math.floor((objWidth + objHeight) / 4 + Math.random() * 30);
    return {
        width: objWidth,
        height: objHeight,
        depth: objDepth
    };
}

function showResults(views) {
    if (views.length < 4 || !pxPerCm) {
        clearResults();
        return;
    }
    // Tomar el máximo de cada dimensión como aproximación del volumen total
    const maxWidthPx = Math.max(...views.map(v => v.width));
    const maxHeightPx = Math.max(...views.map(v => v.height));
    const maxDepthPx = Math.max(...views.map(v => v.depth));
    // Convertir a cm
    const widthCm = (maxWidthPx / pxPerCm).toFixed(1);
    const heightCm = (maxHeightPx / pxPerCm).toFixed(1);
    const depthCm = (maxDepthPx / pxPerCm).toFixed(1);
    const volumeCm3 = (widthCm * heightCm * depthCm).toFixed(0);
    const volumeM3 = (volumeCm3 / 1e6).toFixed(4);
    dimensionsDiv.textContent = `Medidas estimadas: Largo: ${widthCm} cm, Alto: ${heightCm} cm, Ancho: ${depthCm} cm`;
    percentageDiv.textContent = `Volumen estimado: ${volumeCm3} cm³ (${volumeM3} m³)`;
    render3DObject(maxWidthPx, maxHeightPx, maxDepthPx, 400, true);
}

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
