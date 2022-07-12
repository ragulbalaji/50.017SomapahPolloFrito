const STEPS_PER_FRAME = 5;
const GRAVITY = 30;
const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
const playerPosition = new THREE.Vector3(0, 2, 0);
const clock = new THREE.Clock();
const keyStates = {}; // to store key presses
let playerOnFloor = true;
let mouseLock = true;

const stats = new Stats();
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    precision: "lowp",
});
const camera = new THREE.PerspectiveCamera(
    90,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.rotation.order = "YXZ";

function getForwardVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();

    return playerDirection;
}

function getSideVector() {
    camera.getWorldDirection(playerDirection);
    playerDirection.y = 0;
    playerDirection.normalize();
    playerDirection.cross(camera.up);

    return playerDirection;
}

function controls(deltaTime) {
    let speedDelta = deltaTime * (playerOnFloor ? 25 : 15);

    // if shift is pressed then move at triple speed
    if (keyStates["ShiftLeft"] || keyStates["ShiftRight"]) {
        speedDelta *= 3;
    }
    if (keyStates["KeyW"] || keyStates["ArrowUp"]) {
        // forward
        playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    }
    if (keyStates["KeyS"] || keyStates["ArrowDown"]) {
        // backward
        playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    }
    if (keyStates["KeyA"] || keyStates["ArrowLeft"]) {
        // left
        playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    }
    if (keyStates["KeyD"] || keyStates["ArrowRight"]) {
        // right
        playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
    }
    if (keyStates["KeyQ"] || keyStates["KeyZ"]) {
        // fly up
        playerVelocity.y += speedDelta;
    }
    if (keyStates["KeyE"] || keyStates["KeyX"]) {
        // fly down
        playerVelocity.y -= speedDelta;
    }
    if (keyStates["KeyJ"]) {
        // yaw left
        camera.rotation.y += 0.01;
    }
    if (keyStates["KeyL"]) {
        // yaw right
        camera.rotation.y -= 0.01;
    }
    if (keyStates["KeyI"]) {
        // pitch up
        camera.rotation.x += 0.005;
    }
    if (keyStates["KeyK"]) {
        // pitch down
        camera.rotation.x -= 0.005;
    }
    if (playerOnFloor) {
        // jump
        if (keyStates["Space"]) {
            playerVelocity.y = 15;
        }
    }
}

function updatePlayer(deltaTime) {
    let damping = Math.exp(-4 * deltaTime) - 1;

    if (!playerOnFloor) {
        playerVelocity.y -= GRAVITY * deltaTime;
        // small air resistance
        damping *= 0.1;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);

    playerPosition.add(deltaPosition);

    camera.position.copy(playerPosition);
}

init();

function init() {
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    window.addEventListener("resize", onWindowResize);

    document.addEventListener("keydown", (event) => {
        keyStates[event.code] = true;
    });
    document.addEventListener("keyup", (event) => {
        keyStates[event.code] = false;
    });
    document.body.addEventListener("mousemove", (event) => {
        if (!mouseLock) {
            camera.rotation.y -= event.movementX / 200;
            camera.rotation.x -= event.movementY / 200;
        }
    });
    document.body.addEventListener("mousedown", (event) => {
        mouseLock = false;
    });
    document.body.addEventListener("mouseup", (event) => {
        mouseLock = true;
    });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x79a6ff);

const CHUNK_SIZE = 256;
const CHUNK_SCALE = 1;
const geometry = new THREE.PlaneGeometry(
    CHUNK_SIZE * CHUNK_SCALE,
    CHUNK_SIZE * CHUNK_SCALE,
    CHUNK_SIZE - 1,
    CHUNK_SIZE - 1
);
geometry.rotateX(-Math.PI / 2);

const material = new THREE.ShaderMaterial({
    vertexShader: `
  varying vec3 vPosition;
  varying vec2 vUV;
  varying float sea;
  void main() {
    vPosition = position;
    vUV = uv;
    // if (position.y < 0.1) {
    //   sea = 1.0;
    // } else {
    //   sea = 0.0;
    // }
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `,
    fragmentShader: `
  varying vec3 vPosition;
  varying vec2 vUV;
  varying float sea;
  float remap( float minval, float maxval, float curval )
  {
    return ( curval - minval ) / ( maxval - minval );
  }

  void main() {
    // float depth = vPosition.y / 16.0 + 0.1;
    // vec3 green = vec3(0.0, 0.0, 1.0);
    // vec3 blue = vec3(0.0, 1.0, 0.0);
    // vec3 white = vec3(1.0, 1.0, 1.0);

    // depth = clamp(depth, 0.0, 1.0);
    // if (depth < 0.5) {
    //   vec3 mixedColour = mix(green, blue, remap(0.0, 0.5, depth));
    //   gl_FragColor = vec4(mixedColour, 1.0);
    // } else {
    //   vec3 mixedColour = mix(blue, white, remap(0.5, 1.0, depth));
    //   gl_FragColor = vec4(mixedColour, 1.0);
    // }
    if (vUV.x > 0.8 && vUV.y > 0.8) {
      gl_FragColor = vec4(0.1, 0.2, 0.7 - vPosition.y, 1.0);
    } else {
      gl_FragColor = vec4(vUV.x, vUV.y, 0.0, 1.0);
    }
    
  }
  `,
});

const phongmaterial = new THREE.ShaderMaterial({
    uniforms: {
        Ka: { value: new THREE.Vector3(0.4, 0.9, 0.3) },
        Kd: { value: new THREE.Vector3(0.4, 0.9, 0.3) },
        Ks: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
        LightIntensity: { value: new THREE.Vector4(0.5, 0.5, 0.5, 1.0) },
        LightPosition: { value: new THREE.Vector4(0.0, 2000.0, 0.0, 1.0) },
        Shininess: { value: 10.0 },
    },
    vertexShader: `
    varying vec3 Normal;
    varying vec3 Position;

    void main() {
      Normal = normalize(normalMatrix * normal);
      Position = vec3(modelViewMatrix * vec4(position, 1.0));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
    fragmentShader: `
    varying vec3 Normal;
    varying vec3 Position;

    uniform vec3 Ka;
    uniform vec3 Kd;
    uniform vec3 Ks;
    uniform vec4 LightPosition;
    uniform vec3 LightIntensity;
    uniform float Shininess;

    vec3 phong() {
      vec3 n = normalize(Normal);
      vec3 s = normalize(vec3(LightPosition) - Position);
      vec3 v = normalize(vec3(-Position));
      vec3 r = reflect(-s, n);

      vec3 ambient = Ka;
      vec3 diffuse = Kd * max(dot(s, n), 0.0);
      vec3 specular = Ks * pow(max(dot(r, v), 0.0), Shininess);

      return LightIntensity * (ambient + diffuse + specular);
    }

    void main() {
      gl_FragColor = vec4(phong(), 1.0);
    }
  `,
});

const material2 = new THREE.MeshNormalMaterial({ flatShading: true });
const chunk = new THREE.Mesh(geometry, material);
scene.add(chunk);

let maxh = 0;
makeChunk(0, 0);
function makeChunk(x0, y0) {
    const vertices = chunk.geometry.attributes.position.array;
    const uv = chunk.geometry.attributes.uv.array;
    maxh = 8;
    const seed = 1;
    noise.seed(seed);
    for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
            const j = 2 * (y * CHUNK_SIZE + x);
            const temp =
                (noise.simplex2((x0 + x) / 512, (y0 + y) / 512) + 1) / 2;
            let rain = (noise.simplex2((x0 + x) / 256, (y0 + y) / 256) + 1) / 2;
            rain = Math.min(rain, 1 - temp);
            uv[j] = temp;
            uv[j + 1] = rain;

            const i = 3 * (y * CHUNK_SIZE + x);
            const h =
                noise.simplex2((x0 + x) / 4, (y0 + y) / 4) * (rain + 0.3) +
                noise.simplex2((x0 + x) / 128, (y0 + y) / 128) * 4 +
                Math.max(
                    0,
                    noise.simplex2((x0 + x) / 1024, (y0 + y) / 1024) * 32
                );
            const r =
                Math.abs(noise.simplex2((x0 + x) / 96, (y0 + y) / 96)) <
                Math.min(0.2, Math.abs((3 - h) / 8));
            vertices[i + 1] = Math.max(0, h);
            if (h < 0) {
                uv[j] = 1;
                uv[j + 1] = 1;
            }
            if (r && vertices[i + 1] < 3) {
                vertices[i + 1] *= 0.2;
                uv[j] = 1;
                uv[j + 1] = 1;
            }
            maxh = Math.max(maxh, vertices[i + 1]);
        }
    }

    chunk.geometry.attributes.position.needsUpdate = true;
    chunk.geometry.attributes.uv.needsUpdate = true;
}

camera.position.y = 80;
camera.position.z = -100;
camera.lookAt(0, 0, 0);

let xxx = 0;

function animate() {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
        controls(deltaTime);
        updatePlayer(deltaTime);
    }

    makeChunk(0, xxx);
    // xxx += 1;

    renderer.render(scene, camera);

    stats.update();

    requestAnimationFrame(animate);
}

animate();

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}
