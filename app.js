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

activateCameraBtn.addEventListener('click', startCamera);

captureBtn.addEventListener('click', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Simulación de detección de objeto y cálculo de dimensiones
    const simulated = simulateObjectDetection(canvas.width, canvas.height);
    views.push(simulated);
    updateViewsList();
    showResults(views);
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
    if (views.length === 0) {
        clearResults();
        return;
    }
    // Tomar el máximo de cada dimensión como aproximación del volumen total
    const maxWidth = Math.max(...views.map(v => v.width));
    const maxHeight = Math.max(...views.map(v => v.height));
    const maxDepth = Math.max(...views.map(v => v.depth));
    dimensionsDiv.textContent = `Medidas estimadas: Largo: ${maxWidth} px, Alto: ${maxHeight} px, Ancho: ${maxDepth} px`;
    // Supongamos que el cubo tiene 400x400x400 px
    const cubeSize = 400;
    const objVolume = maxWidth * maxHeight * maxDepth;
    const cubeVolume = Math.pow(cubeSize, 3);
    const percent = ((objVolume / cubeVolume) * 100).toFixed(2);
    percentageDiv.textContent = `Porcentaje de ocupación: ${percent}%`;
    render3DObject(maxWidth, maxHeight, maxDepth, cubeSize);
}

function render3DObject(objWidth, objHeight, objDepth, cubeSize) {
    // Limpiar el contenedor
    threejsContainer.innerHTML = '';
    // Crear escena Three.js
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(400, 400);
    threejsContainer.appendChild(renderer.domElement);

    // Cubo transparente
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x0078d7, wireframe: true, opacity: 0.3, transparent: true });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    scene.add(cube);

    // Objeto
    const objGeometry = new THREE.BoxGeometry(objWidth, objHeight, objDepth);
    const objMaterial = new THREE.MeshBasicMaterial({ color: 0xffa500, opacity: 0.8, transparent: true });
    const object = new THREE.Mesh(objGeometry, objMaterial);
    object.position.set(0, 0, 0);
    scene.add(object);

    camera.position.z = cubeSize * 1.5;
    camera.position.y = cubeSize * 0.3;
    camera.lookAt(0, 0, 0);

    // Luz
    const light = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(light);

    // Control simple de rotación
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
