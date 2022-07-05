const stats = new Stats()
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  precision: 'lowp'
})
const camera = new THREE.PerspectiveCamera(
  90,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

const orbitControls = new THREE.OrbitControls(camera, renderer.domElement)

init()

function init () {
  stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
  document.body.appendChild(stats.dom)

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  window.addEventListener('resize', onWindowResize)
}

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x79a6ff)

const geometry = new THREE.PlaneGeometry(128, 128, 128 - 1, 128 - 1)
geometry.rotateX(-Math.PI / 2)

const material = new THREE.MeshNormalMaterial({ flatShading: true })
const chunk = new THREE.Mesh(geometry, material)
scene.add(chunk)

let maxh = 0
makeChunk(0, 0)
function makeChunk (x0, y0) {
  const vertices = chunk.geometry.attributes.position.array
  maxh = 8
  noise.seed(0)
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = 3 * (y * 128 + x)
      const r = Math.abs(noise.simplex2((x0 + x) / 48, (y0 + y) / 48)) < 0.2
      const h =
        noise.simplex2((x0 + x) / 4, (y0 + y) / 4) +
        noise.simplex2((x0 + x) / 128, (y0 + y) / 128) * 4 +
        Math.max(0, noise.simplex2((x0 + x) / 1024, (y0 + y) / 1024) * 32)
      vertices[i + 1] = Math.max(0, h)
      if (r && vertices[i + 1] < 3) {
        vertices[i + 1] *= 0.2
      }
      maxh = Math.max(maxh, vertices[i + 1])
    }
  }
  chunk.geometry.attributes.position.needsUpdate = true
}

camera.position.y = 8
camera.position.z = -64
camera.lookAt(0, 0, 0)
orbitControls.update()

let xxx = 0

function animate () {
  requestAnimationFrame(animate)

  makeChunk(0, xxx)
  xxx += 3
  camera.position.y = Math.ceil(maxh + 1)
  // camera.lookAt(0, 0, 0);
  orbitControls.update()
  renderer.render(scene, camera)

  stats.update()
}

animate()

function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()

  renderer.setSize(window.innerWidth, window.innerHeight)
}
