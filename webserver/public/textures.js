const texture_loader = new THREE.TextureLoader()

const TEXTURES = {
  tex_grass: texture_loader.load('assets/tex/grass.png'),
  tex_HandM: texture_loader.load('assets/tex/biome-lookup-discrete.png'),
  tex_sky: texture_loader.load('assets/tex/sky.jpg'),
  tex_test: texture_loader.load('assets/tex/texmap.png')
}
