/// ////////////////////////////////////////////////////////////////////////////
// Constants

const WORLD_SEED = Math.round(Math.random() * 4206969)
const CHUNK_SIZE = 64
const CHUNK_SCALE = 1
const STEPS_PER_FRAME = 1
const GRAVITY = 30
const POINTER_SPEED = 2
const _PI_2 = Math.PI / 2
const PLAYER_SPEED_GROUND = 25
const PLAYER_SPEED_AIR = 8
const PLAYER_INIT_HEIGHT = 32

const clock = new THREE.Clock()
let playerOnFloor = false
const playerVelocity = new THREE.Vector3()
const playerDirection = new THREE.Vector3()
const playerPosition = new THREE.Vector3(0, PLAYER_INIT_HEIGHT, 0)
const eulerAngle = new THREE.Euler(0, 0, 0, 'YXZ')
let pointerLocked = false

const keyStates = new Map() // to store key presses
const loadedChunks = new Map() // to store currently loaded chunks

// references
const blocker = document.getElementById('blocker')
const instructions = document.getElementById('instructions')
const HUDposition = document.getElementById('HUDposition')
const currScore = 0
const currScoreHTML = document.getElementById('currScoreHTML')

const worldOctree = new THREE.Octree()
const playerCollider = new THREE.Capsule( new THREE.Vector3( 0, PLAYER_INIT_HEIGHT, 0 ), new THREE.Vector3( 0, PLAYER_INIT_HEIGHT, 0 ), 0.35 );

/// ////////////////////////////////////////////////////////////////////////////
// Set up renderer, scene and camera

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'lowp'
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
const scene = new THREE.Scene()
const SKY_COLOR = 0x79a6ff
scene.background = new THREE.Color(SKY_COLOR)
// scene.fog = new THREE.Fog(SKY_COLOR, 0, 400)
scene.fog = new THREE.FogExp2(SKY_COLOR, 0.004)
// scene.background = TEXTURES.tex_sky

const camera = new THREE.PerspectiveCamera(
  90,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)
camera.rotation.order = 'YXZ'
camera.position.x = playerPosition.x
camera.position.y = playerPosition.y
camera.position.z = playerPosition.z
camera.lookAt(16, 0, 0)

const stats = new Stats()

/// ////////////////////////////////////////////////////////////////////////////
// Controls

function getForwardVector () {
  camera.getWorldDirection(playerDirection)
  playerDirection.y = 0
  playerDirection.normalize()
  return playerDirection
}

function getSideVector () {
  camera.getWorldDirection(playerDirection)
  playerDirection.y = 0
  playerDirection.normalize()
  playerDirection.cross(camera.up)
  return playerDirection
}

function controls (deltaTime) {
  let speedDelta =
    deltaTime * (playerOnFloor ? PLAYER_SPEED_GROUND : PLAYER_SPEED_AIR)
  // if shift is pressed then move at one-third speed
  if (keyStates.ShiftLeft || keyStates.ShiftRight) speedDelta /= 3
  // move forward
  if (keyStates.KeyW || keyStates.ArrowUp) { playerVelocity.add(getForwardVector().multiplyScalar(speedDelta)) }
  // move backward
  if (keyStates.KeyS || keyStates.ArrowDown) { playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta)) }
  // move left
  if (keyStates.KeyA || keyStates.ArrowLeft) { playerVelocity.add(getSideVector().multiplyScalar(-speedDelta)) }
  // move right
  if (keyStates.KeyD || keyStates.ArrowRight) { playerVelocity.add(getSideVector().multiplyScalar(speedDelta)) }
  // fly up
  if (keyStates.KeyQ || keyStates.KeyZ) playerVelocity.y += speedDelta
  // fly down
  if (keyStates.KeyE || keyStates.KeyX) playerVelocity.y -= speedDelta
  // jump if player on floor
  if (playerOnFloor && keyStates.Space) playerVelocity.y = 15
}

function playerCollisions () {
  // const landHeight = getLandHeight()
  // playerOnFloor = false
  // playerOnFloor = landHeight >= camera.position.y
  // const normal = new THREE.Vector3(0, 1, 0)
  // // const normal = new THREE.Vector3(0, camera.position.y - landHeight, 0)
  // if (!playerOnFloor) {
  //   playerVelocity.addScaledVector(normal, -normal.dot(playerVelocity))
  // }

  const result = worldOctree.capsuleIntersect( playerCollider );
  playerOnFloor = false;
  if ( result ) {
    // console.log("collision detected");
    playerOnFloor = result.normal.y > 0;
    if ( ! playerOnFloor ) {
      playerVelocity.addScaledVector( result.normal, - result.normal.dot( playerVelocity ) );
    }
    playerCollider.translate( result.normal.multiplyScalar( result.depth ) );
  }
}

function updatePlayer (deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime
    // small air resistance
    damping *= 0.1
  }

  playerVelocity.addScaledVector(playerVelocity, damping)
  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime)
  playerCollider.translate( deltaPosition );

  playerCollisions()

  playerPosition.add(deltaPosition)
  camera.position.copy(playerCollider.end)
}

function onPointerLockChange () {
  if (document.pointerLockElement === document.body) {
    instructions.style.display = 'none'
    blocker.style.display = 'none'
    pointerLocked = true
  } else {
    pointerLocked = false
    blocker.style.display = 'block'
    instructions.style.display = ''
  }
}

function onMouseMovement (e) {
  if (!pointerLocked) return

  const movementX = e.movementX || e.mozMovementX || e.webkitMovementX || 0
  const movementY = e.movementY || e.mozMovementY || e.webkitMovementY || 0

  eulerAngle.setFromQuaternion(camera.quaternion)

  eulerAngle.y -= movementX * 0.002 * POINTER_SPEED
  eulerAngle.x -= movementY * 0.002 * POINTER_SPEED

  const minPolarAngle = 0
  const maxPolarAngle = Math.PI

  eulerAngle.x = Math.max(
    _PI_2 - maxPolarAngle,
    Math.min(_PI_2 - minPolarAngle, eulerAngle.x)
  )

  camera.quaternion.setFromEuler(eulerAngle)
}

/// ////////////////////////////////////////////////////////////////////////////
// Helpers

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function getChunk (x, z) {
  const chunkX = Math.floor(x / CHUNK_SIZE + 0.5)
  const chunkZ = Math.floor(z / CHUNK_SIZE + 0.5)
  const chunkName = `${chunkX}$$${chunkZ}`
  // console.log(loadedChunks.get(chunkName).geometry.attributes.position.array)
  return loadedChunks.get(chunkName)
}

function getLandHeight () {
  // get camera position
  const player_min = camera.position.clone()
  const player_max = camera.position.clone()
  const delta = 1.5
  player_min.add(new THREE.Vector3(-delta, -105, -delta))
  player_max.add(new THREE.Vector3(delta, 5, delta))

  // get player bounding box
  const playerBoundingBox = new THREE.Box3(player_min, player_max)
  // console.log(playerBoundingBox)
  // get chunk below player
  const chunkBelowPlayer = getChunk(camera.position.x, camera.position.z)
  // get vertices of chunk contained by player bounding box
  const chunkVertices = chunkBelowPlayer.geometry.attributes.position.array

  let y_max = 0

  for (let i = 0; i < chunkVertices.length / 3; i++) {
    const _x = chunkVertices[i * 3]
    const _y = chunkVertices[i * 3 + 1]
    const _z = chunkVertices[i * 3 + 2]

    if (_x >= -delta && _x <= delta && _z >= -delta && _z <= delta) {
      // console.log("check " + _x + _y + _z);
      y_max = Math.max(y_max, _y)
    }

    // if (playerBoundingBox.containsPoint(new THREE.Vector3(_x, _y, _z))) {
    //   console.log("containsPoint");
    // }
  }
  // console.log(y_max)
  return y_max
}

/// ////////////////////////////////////////////////////////////////////////////
// Initialize

init()

function init () {
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom)

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize)

  instructions.addEventListener('click', function () {
    document.body.requestPointerLock =
      document.body.requestPointerLock ||
      document.body.mozRequestPointerLock ||
      document.body.webkitRequestPointerLock
    document.body.requestPointerLock()
  })

  document.body.addEventListener('mousemove', onMouseMovement)
  document.addEventListener('pointerlockchange', onPointerLockChange)

  document.addEventListener('keydown', (e) => {
    keyStates[e.code] = true
  })
  document.addEventListener('keyup', (e) => {
    keyStates[e.code] = false
  })
}

/// ////////////////////////////////////////////////////////////////////////////
// Geometry

const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
scene.add(ambientLight)
const directionalLight = new THREE.DirectionalLight(0xfdfbd3, 0.8)
directionalLight.castShadow = true
directionalLight.position.set(100, 100, 0)
scene.add(directionalLight)

let maxh = 0

function makeChunk (chunk, x0, z0) {
  x0 += 6969
  z0 += 6969
  const vertices = chunk.geometry.attributes.position.array
  const uv = chunk.geometry.attributes.uv.array

  maxh = 8
  noise.seed(WORLD_SEED)
  for (let y = 0; y < CHUNK_SIZE; y++) {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      const j = 2 * (y * CHUNK_SIZE + x)
      const temp = (noise.simplex2((x0 + x) / 512, (z0 + y) / 512) + 1) / 2
      let rain = (noise.simplex2((x0 + x) / 256, (z0 + y) / 256) + 1) / 2
      rain = Math.min(rain, 0.99 - temp)
      uv[j] = temp
      uv[j + 1] = rain

      const i = 3 * (y * CHUNK_SIZE + x)
      let h =
        noise.simplex2((x0 + x) / 4, (z0 + y) / 4) * (rain + 0.3) +
        noise.simplex2((x0 + x) / 128, (z0 + y) / 128) * 4 +
        Math.min(32, noise.simplex2((x0 + x) / 768, (z0 + y) / 768) * 32 + 16)

      const m = Math.abs(noise.perlin2((x0 + x) / 512, (z0 + y) / 512))
      const mt = Math.abs(noise.simplex2((x0 + x) / 512, (z0 + y) / 512) * 0.2)
      if (m < mt && h > 24) {
        h *= (1 + (mt - m) * h / 5)
      }

      vertices[i + 1] = Math.max(0, h)

      const r =
        Math.abs(noise.simplex2((x0 + x) / 96, (z0 + y) / 96)) <
        Math.min(0.2, Math.abs((3 - h) / 8))

      if (h < 0) {
        uv[j] = 1
        uv[j + 1] = 1
      }
      if (r && vertices[i + 1] < 3) {
        vertices[i + 1] *= 0.2
        uv[j] = 1
        uv[j + 1] = 1
      }
      maxh = Math.max(maxh, vertices[i + 1])
    }
  }

  chunk.geometry.attributes.position.needsUpdate = true
  chunk.geometry.attributes.uv.needsUpdate = true
}

/// ////////////////////////////////////////////////////////////////////////////
// Animate

function animate () {
  // Prevent user from moving when the pointer is not locked
  if (pointerLocked) {
    const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME

    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      controls(deltaTime)
      updatePlayer(deltaTime)

      // update position on FE
      // HUDposition.innerText = `pos=(${playerPosition.x.toFixed(
      //   1
      // )},${playerPosition.y.toFixed(1)},${playerPosition.z.toFixed(1)})`

      // // update score board on FE
      // currScoreHTML.innerText = currScore
    }
    // getLandHeight()

    HUDposition.innerText = loadedChunks.size
  }

  const chunkX = Math.floor(camera.position.x / CHUNK_SIZE + 0.5)
  const chunkZ = Math.floor(camera.position.z / CHUNK_SIZE + 0.5)
  let genCount = 0

  const currChunkNum = loadedChunks.size

  for (let xoffset = -1; xoffset <= 1 && genCount < 1; xoffset++) {
    for (let zoffset = -1; zoffset <= 1 && genCount < 1; zoffset++) {
      const chunkXX = chunkX + xoffset
      const chunkZZ = chunkZ + zoffset
      const chunkName = `${chunkXX}$$${chunkZZ}`

      if (!loadedChunks.has(chunkName)) {
        // console.log("Making new chunk", chunkName)
        const geometry = new THREE.PlaneGeometry(
          CHUNK_SIZE * CHUNK_SCALE,
          CHUNK_SIZE * CHUNK_SCALE,
          CHUNK_SIZE - 1,
          CHUNK_SIZE - 1
        )
        geometry.rotateX(-Math.PI / 2)

        const chunk = new THREE.Mesh(geometry, MATERIALS.phong_material)
        chunk.receiveShadow = true
        scene.add(chunk)
  
        chunk.position.x = chunkXX * CHUNK_SIZE
        chunk.position.z = chunkZZ * CHUNK_SIZE

        makeChunk(
          chunk,
          (chunkXX - 0.5) * CHUNK_SIZE,
          (chunkZZ - 0.5) * CHUNK_SIZE
        )

        loadedChunks.set(chunkName, chunk)
        genCount++
        // console.log(loadedChunks)
      }
    }
  }

  if (currChunkNum !== loadedChunks.size) {
    console.log("New Chunks loaded:", loadedChunks.size - currChunkNum)
    worldOctree.fromGraphNode(scene)
  }

  // Unload chunks
  if (loadedChunks.size > 64) {
    for (const [chunkName, chunk] of loadedChunks) {
      const dist = Math.pow(chunk.position.x - playerPosition.x, 2) + Math.pow(chunk.position.z - playerPosition.z, 2)
      if (dist > 160000) {
        chunk.geometry.dispose()
        scene.remove(chunk)
        loadedChunks.delete(chunkName)
      }
    }
  }

  renderer.render(scene, camera)

  stats.update()

  requestAnimationFrame(animate)
}

animate()
