import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EQUIP_BY_ID, type Accent } from "./data";

export type PlantHandle = {
  resize: () => void;
  dispose: () => void;
  flyTo: (zone: string) => void;
  frame: (id: string) => void;
  select: (id: string | null) => void;
  setExplode: (which: "pvt" | "ro", on: boolean) => void;
};

type Hooks = {
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
};

type Flow = {
  curve: THREE.CatmullRomCurve3;
  beads: THREE.Mesh[];
  speed: number;
  phase: number;
};

type Slide = {
  obj: THREE.Object3D;
  base: THREE.Vector3;
  extra: THREE.Vector3;
};

const ACCENT: Record<Accent, number> = {
  water: 0x3aa0ff,
  thermal: 0xe36a24,
  brine: 0x2ea66a,
  control: 0x9b8cff,
  electric: 0xe4d3a1,
};

const SHOTS: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [36, 24, 40], target: [4, 1.2, 2] },
  well: { pos: [-6, 8, 24], target: [-18, 1.1, 13] },
  pvt: { pos: [8, 10, 16], target: [-6, 1.4, -1] },
  ro: { pos: [30, 8, 24], target: [17, 1.2, 13] },
  potable: { pos: [38, 9, 16], target: [26, 1.6, 5] },
  csp: { pos: [10, 12, 0], target: [4, 1.6, -16] },
  brine: { pos: [16, 11, 36], target: [12, 0.5, 22] },
  control: { pos: [8, 7, 28], target: [-6, 1.4, 18.5] },
};

const UP = new THREE.Vector3(0, 1, 0);

export function mountPlant(canvas: HTMLCanvasElement, hooks: Hooks): PlantHandle {
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const registry = new Map<string, THREE.Object3D>();
  const flows: Flow[] = [];
  const pvtLayers: { obj: THREE.Object3D; baseY: number; index: number }[] = [];
  const roParts: Slide[] = [];
  const labels: THREE.Sprite[] = [];
  let rotor: THREE.Object3D | null = null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x152033, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x152033);
  scene.fog = new THREE.Fog(0xc4b39a, 78, 190);
  scene.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(mobile ? 52 : 40, 1, 0.1, 400);
  camera.position.set(36, 24, 40);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(4, 1.2, 2);
  controls.enableDamping = !reduce;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minPolarAngle = 0.12;
  controls.minDistance = 3.2;
  controls.maxDistance = 88;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  textures.add(envTex);
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xc9daf0, 0x8d7758, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.7);
  sun.position.set(-38, 46, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  sun.shadow.camera.left = -48;
  sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48;
  sun.shadow.camera.bottom = -48;
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.045;
  sun.target.position.set(4, 0, 0);
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9eb6d4, 0.55);
  fill.position.set(22, 14, -28);
  scene.add(fill);

  const matSand = std(0xc6b59a, { roughness: 0.96, metalness: 0, envMapIntensity: 0.15 });
  const matConcrete = std(0x8b949c, { roughness: 0.9, metalness: 0.02, envMapIntensity: 0.2 });
  const matAsphalt = std(0x3c434a, { roughness: 0.92, metalness: 0.04 });
  const matSteel = std(0xc5ced4, { roughness: 0.38, metalness: 0.72, envMapIntensity: 0.75 });
  const matSteelDark = std(0x5d6770, { roughness: 0.46, metalness: 0.62, envMapIntensity: 0.55 });
  const matFrame = std(0x2f3840, { roughness: 0.55, metalness: 0.4 });
  const matWhite = std(0xf4f7f8, { roughness: 0.55, metalness: 0.08 });
  const matCopper = std(0xb87333, { roughness: 0.42, metalness: 0.7, envMapIntensity: 0.6 });
  const matInsulation = std(0xe3d7a1, { roughness: 0.85, metalness: 0.02 });
  const matLiner = std(0x2c332c, { roughness: 0.8, metalness: 0.05 });
  const matSalt = std(0xf3f1ea, { roughness: 0.9, metalness: 0, map: saltTexture() });
  const matTank = std(0xd5dee4, { roughness: 0.42, metalness: 0.35, envMapIntensity: 0.45 });
  const matBandWater = std(0x3aa0ff, { roughness: 0.4, metalness: 0.2, emissive: 0x1d4f86, emissiveIntensity: 0.18 });
  const matBandHeat = std(0xe36a24, { roughness: 0.45, metalness: 0.2, emissive: 0xe36a24, emissiveIntensity: 0.22 });
  const matBrine = std(0x1c8f62, {
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.78,
    envMapIntensity: 0.4,
  });
  const matGlass = std(0xc5e4f7, {
    roughness: 0.06,
    metalness: 0.05,
    transparent: true,
    opacity: 0.45,
    envMapIntensity: 0.6,
  });
  const matEva = std(0xf7f3ea, { roughness: 0.45, metalness: 0, transparent: true, opacity: 0.72 });
  const matCells = std(0x14375f, { roughness: 0.35, metalness: 0.15, map: cellTexture(), emissive: 0x0c2344, emissiveIntensity: 0.2 });
  const matPv = std(0x16325c, { roughness: 0.32, metalness: 0.2, map: cellTexture(), emissive: 0x0c2344, emissiveIntensity: 0.15 });
  const matReceiver = std(0xffb07a, { roughness: 0.35, metalness: 0.2, emissive: 0xe36a24, emissiveIntensity: 0.85 });
  const matMirror = std(0xe7eef3, { roughness: 0.12, metalness: 0.92, envMapIntensity: 1, side: THREE.DoubleSide });
  const matElectric = std(0xe4d3a1, { roughness: 0.4, metalness: 0.45, emissive: 0xe4d3a1, emissiveIntensity: 0.28 });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x9b8cff,
    emissive: 0x9b8cff,
    emissiveIntensity: 0.6,
    roughness: 0.35,
  });
  mats.add(beaconMat);

  function std(color: number, params: THREE.MeshStandardMaterialParameters) {
    const material = new THREE.MeshStandardMaterial({ color, ...params });
    mats.add(material);
    if (params.map) textures.add(params.map);
    return material;
  }

  function solid(geo: THREE.BufferGeometry, material: THREE.Material, cast = true) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    geos.add(geo);
    return mesh;
  }

  function box(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    cast = true,
  ) {
    const mesh = solid(new THREE.BoxGeometry(w, h, d), material, cast);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function cyl(
    parent: THREE.Object3D,
    radius: number,
    height: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    axis: "y" | "x" | "z" = "y",
    segments = 22,
  ) {
    const mesh = solid(new THREE.CylinderGeometry(radius, radius, height, segments), material);
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function own(id: string, obj: THREE.Object3D) {
    obj.userData.equipId = id;
    registry.set(id, obj);
    scene.add(obj);
    return obj;
  }

  function pad(x: number, z: number, w: number, d: number) {
    const mesh = box(scene, w, 0.08, d, matConcrete, x, 0.04, z, false);
    mesh.userData.block = true;
    return mesh;
  }

  function label(title: string, sub: string, x: number, y: number, z: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = "rgba(10, 16, 26, 0.8)";
    roundRect(ctx, 12, 36, 488, 96, 16);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.fillStyle = "#e7eef6";
    ctx.font = "600 40px sans-serif";
    ctx.fillText(title, 256, 82);
    ctx.fillStyle = "#9aabbe";
    ctx.font = "400 22px sans-serif";
    ctx.fillText(sub, 256, 114);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.add(tex);
    const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    mats.add(material);
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.center.set(0.5, 0);
    sprite.userData.skip = true;
    sprite.raycast = () => {};
    scene.add(sprite);
    labels.push(sprite);
  }

  buildSite();
  buildWell();
  buildPvt();
  buildRo();
  buildPotable();
  buildCsp();
  buildBrine();
  buildControl();
  buildFlows();
  buildLabels();

  const selectHelper = new THREE.BoxHelper(new THREE.Object3D(), ACCENT.water);
  selectHelper.visible = false;
  selectHelper.userData.skip = true;
  scene.add(selectHelper);
  const selectMat = selectHelper.material;
  if (!Array.isArray(selectMat)) mats.add(selectMat);

  let selected: THREE.Object3D | null = null;
  let pvtNow = 0;
  let pvtTarget = 0;
  let roNow = 0;
  let roTarget = 0;

  const fly = {
    on: false,
    t: 0,
    dur: 1.15,
    fromP: new THREE.Vector3(),
    toP: new THREE.Vector3(),
    fromT: new THREE.Vector3(),
    toT: new THREE.Vector3(),
  };

  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  let armed = false;
  let moved = false;
  let sx = 0;
  let sy = 0;

  function flyToVectors(pos: THREE.Vector3, target: THREE.Vector3, dur = 1.15) {
    fly.fromP.copy(camera.position);
    fly.toP.copy(pos);
    fly.fromT.copy(controls.target);
    fly.toT.copy(target);
    fly.t = 0;
    fly.dur = reduce ? 0.01 : dur;
    fly.on = true;
  }

  function flyTo(zone: string) {
    const shot = SHOTS[zone] ?? SHOTS.overview;
    flyToVectors(new THREE.Vector3(...shot.pos), new THREE.Vector3(...shot.target));
  }

  function frame(id: string) {
    const obj = registry.get(id);
    if (!obj) return;
    const box3 = new THREE.Box3().setFromObject(obj);
    if (box3.isEmpty()) return;
    const center = box3.getCenter(new THREE.Vector3());
    const sphere = box3.getBoundingSphere(new THREE.Sphere());
    const dist = THREE.MathUtils.clamp((sphere?.radius ?? 2) * 3.1, 4.5, 18);
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 0.01) dir.set(1, 0.7, 1);
    dir.normalize();
    const pos = center.clone().add(dir.multiplyScalar(dist));
    pos.y = Math.max(pos.y, center.y + 1.6);
    flyToVectors(pos, center, 0.9);
  }

  function select(id: string | null) {
    selected = id ? (registry.get(id) ?? null) : null;
    const accent = (id && EQUIP_BY_ID[id]?.accent) || "water";
    const line = selectHelper.material as THREE.LineBasicMaterial;
    line.color.setHex(ACCENT[accent]);
  }

  function setExplode(which: "pvt" | "ro", on: boolean) {
    if (which === "pvt") pvtTarget = on ? 1 : 0;
    else roTarget = on ? 1 : 0;
  }

  function ndc(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pick(event: PointerEvent): string | null {
    ndc(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const hit of hits) {
      if (hit.object.userData.skip) continue;
      const id = findEquip(hit.object);
      if (id) return id;
      if (hit.object.userData.block) return null;
    }
    return null;
  }

  function onDown(event: PointerEvent) {
    armed = true;
    moved = false;
    sx = event.clientX;
    sy = event.clientY;
  }
  function onMove(event: PointerEvent) {
    if (armed && Math.hypot(event.clientX - sx, event.clientY - sy) > 6) moved = true;
    if (event.target !== canvas) {
      if (!armed) hooks.onHover(null);
      return;
    }
    if (!armed) {
      const id = pick(event);
      hooks.onHover(id);
      canvas.style.cursor = id ? "pointer" : "grab";
    }
  }
  function onUp(event: PointerEvent) {
    if (!armed) return;
    armed = false;
    canvas.style.cursor = "grab";
    if (moved) return;
    hooks.onSelect(pick(event));
  }
  function onLeave() {
    hooks.onHover(null);
  }

  canvas.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  controls.addEventListener("start", () => {
    fly.on = false;
    canvas.style.cursor = "grabbing";
  });
  controls.addEventListener("end", () => {
    canvas.style.cursor = "grab";
  });

  const resizeObserver = new ResizeObserver(() => resize());
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  resize();
  controls.update();

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (fly.on) {
      fly.t += dt;
      const u = Math.min(1, fly.t / fly.dur);
      const k = 1 - (1 - u) ** 3;
      camera.position.lerpVectors(fly.fromP, fly.toP, k);
      controls.target.lerpVectors(fly.fromT, fly.toT, k);
      if (u >= 1) fly.on = false;
    }
    controls.enableDamping = !fly.on && !reduce;
    controls.update();

    const blend = 1 - Math.exp(-7 * dt);
    pvtNow += (pvtTarget - pvtNow) * blend;
    roNow += (roTarget - roNow) * blend;
    for (const layer of pvtLayers) {
      layer.obj.position.y = layer.baseY + layer.index * 0.09 * pvtNow;
    }
    for (const part of roParts) {
      part.obj.position.copy(part.base).addScaledVector(part.extra, roNow);
    }
    if (rotor) rotor.rotation.x += dt * (reduce ? 0.4 : 5.5);
    beaconMat.emissiveIntensity = 0.35 + Math.sin(now * 0.004) * 0.25;

    const travel = reduce ? 0.2 : 1;
    for (const flow of flows) {
      const count = flow.beads.length;
      for (let i = 0; i < count; i += 1) {
        const t = (now * 0.001 * flow.speed * travel + flow.phase + i / count) % 1;
        const point = flow.curve.getPointAt(t);
        const tangent = flow.curve.getTangentAt(t);
        const bead = flow.beads[i];
        bead.position.copy(point);
        if (tangent.lengthSq() > 0.5 && Math.abs(tangent.dot(UP)) < 0.98) {
          bead.quaternion.setFromUnitVectors(UP, tangent);
        }
      }
    }

    for (const sprite of labels) {
      const dist = Math.max(6, camera.position.distanceTo(sprite.position));
      const width = THREE.MathUtils.clamp(dist * 0.11, 2.6, 6.4);
      sprite.scale.set(width, width / 3.2, 1);
    }

    if (selected) {
      selectHelper.setFromObject(selected);
      selectHelper.visible = true;
    } else {
      selectHelper.visible = false;
    }
    renderer.render(scene, camera);
  });

  function resize() {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth || window.innerWidth;
    const height = parent?.clientHeight || window.innerHeight;
    const cap = width < 768 ? 1.25 : 1.6;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }

  function dispose() {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointerleave", onLeave);
    controls.dispose();
    geos.forEach((geo) => geo.dispose());
    mats.forEach((material) => material.dispose());
    textures.forEach((tex) => tex.dispose());
    renderer.dispose();
  }

  return { resize, dispose, flyTo, frame, select, setExplode };

  function buildSite() {
    const sandTex = sandTexture();
    matSand.map = sandTex;
    matSand.needsUpdate = true;
    const ground = solid(new THREE.CircleGeometry(120, 48), matSand, false);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    ground.userData.block = true;
    scene.add(ground);

    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 4;
    skyCanvas.height = 512;
    const sg = skyCanvas.getContext("2d");
    if (sg) {
      const grd = sg.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, "#152033");
      grd.addColorStop(0.45, "#2a3d58");
      grd.addColorStop(0.7, "#7a6150");
      grd.addColorStop(0.84, "#d2b48c");
      grd.addColorStop(1, "#e4d0b0");
      sg.fillStyle = grd;
      sg.fillRect(0, 0, 4, 512);
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    textures.add(skyTex);
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    mats.add(skyMat);
    const sky = solid(new THREE.SphereGeometry(180, 28, 16), skyMat, false);
    sky.userData.skip = true;
    scene.add(sky);

    for (const dune of [
      [-70, -20, 34, 7],
      [62, -36, 28, 6],
      [78, 24, 22, 4.5],
      [-54, 40, 26, 5],
    ] as const) {
      const mesh = solid(new THREE.SphereGeometry(dune[2], 18, 12), matSand, false);
      mesh.scale.y = 0.28;
      mesh.position.set(dune[0], dune[3] * 0.15, dune[1]);
      mesh.userData.skip = true;
      scene.add(mesh);
    }

    const roadH = box(scene, 70, 0.025, 1.7, matAsphalt, 2, 0.015, 7.15, false);
    roadH.userData.block = true;
    const roadV = box(scene, 1.7, 0.025, 54, matAsphalt, 7.6, 0.02, 2, false);
    roadV.userData.block = true;

    pad(-19, 13, 14, 8);
    pad(-13.5, -4.6, 16, 13);
    pad(-3.4, 4.6, 3.4, 2.8);
    pad(6, -0.6, 8, 6);
    pad(18.4, 12.2, 8.4, 5.4);
    pad(15.6, 16.7, 5.4, 2.4);
    pad(26.4, 5.4, 9, 8);
    pad(-8, -18, 22, 10);
    pad(17, -13.2, 14, 9);
    pad(12, 22.4, 28, 7.2);
    pad(-6, 18.6, 3.2, 2.6);

    buildFence();
    buildSign();
  }

  function buildFence() {
    const x0 = -32;
    const x1 = 34;
    const z0 = -28;
    const z1 = 30;
    const posts: [number, number][] = [];
    for (let x = x0; x <= x1; x += 4) {
      posts.push([x, z0], [x, z1]);
    }
    for (let z = z0 + 4; z <= z1 - 4; z += 4) {
      posts.push([x0, z], [x1, z]);
    }
    const geo = new THREE.BoxGeometry(0.08, 0.95, 0.08);
    geos.add(geo);
    const inst = new THREE.InstancedMesh(geo, matSteelDark, posts.length);
    const dummy = new THREE.Object3D();
    posts.forEach(([x, z], index) => {
      dummy.position.set(x, 0.48, z);
      dummy.updateMatrix();
      inst.setMatrixAt(index, dummy.matrix);
    });
    inst.castShadow = true;
    inst.userData.block = true;
    scene.add(inst);
    const rail = (x: number, y: number, z: number, w: number, d: number) => {
      const mesh = box(scene, w, 0.05, d, matSteelDark, x, y, z, false);
      mesh.userData.block = true;
    };
    rail(1, 0.78, z0, x1 - x0, 0.05);
    rail(1, 0.38, z0, x1 - x0, 0.05);
    rail(x0, 0.78, 1, 0.05, z1 - z0);
    rail(x0, 0.38, 1, 0.05, z1 - z0);
    rail(x1, 0.78, 1, 0.05, z1 - z0);
    rail(x1, 0.38, 1, 0.05, z1 - z0);
    rail(-16, 0.78, z1, 30, 0.05);
    rail(-16, 0.38, z1, 30, 0.05);
    rail(18, 0.78, z1, 30, 0.05);
    rail(18, 0.38, z1, 30, 0.05);
  }

  function buildSign() {
    const g = new THREE.Group();
    g.userData.block = true;
    box(g, 0.12, 1.5, 0.12, matSteelDark, -1.5, 0.75, 0);
    box(g, 0.12, 1.5, 0.12, matSteelDark, 1.5, 0.75, 0);
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#121a26";
      ctx.fillRect(0, 0, 1024, 384);
      ctx.fillStyle = "#3aa0ff";
      ctx.fillRect(0, 0, 1024, 8);
      ctx.fillStyle = "#e36a24";
      ctx.fillRect(0, 376, 1024, 8);
      ctx.fillStyle = "#e7eef6";
      ctx.font = "600 120px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("QATRATHERM", 512, 180);
      ctx.fillStyle = "#9aabbe";
      ctx.font = "400 42px sans-serif";
      ctx.fillText("Tendla  ·  El Meghaïer  ·  B.Yaakoub", 512, 260);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.add(tex);
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
    mats.add(face);
    const board = solid(new THREE.BoxGeometry(3.2, 1.15, 0.08), face);
    board.position.y = 1.35;
    g.add(board);
    g.position.set(-24, 0, 27.2);
    scene.add(g);
  }

  function buildWell() {
    const well = new THREE.Group();
    cyl(well, 0.7, 0.16, matConcrete, 0, 0.12, 0);
    cyl(well, 0.16, 1.15, matSteel, 0, 0.7, 0);
    cyl(well, 0.28, 0.06, matSteelDark, 0, 1.15, 0);
    const wheel = cyl(well, 0.22, 0.03, matSteel, 0.34, 0.95, 0, "z", 16);
    wheel.scale.set(1, 1, 1);
    box(well, 0.04, 0.4, 0.04, matSteelDark, 0.34, 0.95, 0, true);
    well.position.set(-24, 0, 12);
    own("eq-well", well);

    const filter = new THREE.Group();
    vessel(filter, 0.48, 1.55, matTank, matSteelDark);
    filter.position.set(-18.4, 0, 11.1);
    own("eq-filter", filter);

    const cart = new THREE.Group();
    cyl(cart, 0.22, 0.7, matSteel, 0, 0.55, 0);
    cyl(cart, 0.26, 0.08, matSteelDark, 0, 0.92, 0);
    box(cart, 0.7, 0.08, 0.5, matFrame, 0, 0.12, 0);
    cart.position.set(-18.2, 0, 14.2);
    own("eq-cartridge", cart);

    const dose = new THREE.Group();
    cyl(dose, 0.28, 0.55, matWhite, 0, 0.45, 0);
    box(dose, 0.34, 0.22, 0.28, matControlBox(), -0.45, 0.28, 0);
    cyl(dose, 0.05, 0.4, matSteelDark, -0.2, 0.4, 0, "x", 8);
    dose.position.set(-22.4, 0, 15.2);
    own("eq-dose", dose);

    const raw = new THREE.Group();
    cyl(raw, 0.62, 2.3, matTank, 0, 0.78, 0, "z");
    box(raw, 0.16, 0.45, 0.5, matSteelDark, -0.7, 0.28, 0);
    box(raw, 0.16, 0.45, 0.5, matSteelDark, 0.7, 0.28, 0);
    cyl(raw, 0.66, 0.08, matBandWater, 0, 0.78, 0, "z");
    raw.position.set(-11.2, 0, 12.4);
    own("eq-raw", raw);
  }

  function buildPvt() {
    const field = new THREE.Group();
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const panel = new THREE.Group();
        box(panel, 0.06, 0.5, 0.06, matFrame, -0.7, 0.25, 0.38);
        box(panel, 0.06, 0.5, 0.06, matFrame, 0.7, 0.25, 0.38);
        box(panel, 0.06, 0.95, 0.06, matFrame, -0.7, 0.48, -0.38);
        box(panel, 0.06, 0.95, 0.06, matFrame, 0.7, 0.48, -0.38);
        const face = solid(new THREE.BoxGeometry(1.7, 0.05, 1.02), matPv);
        face.position.set(0, 0.78, 0);
        face.rotation.x = 0.5;
        panel.add(face);
        const frame = solid(new THREE.BoxGeometry(1.78, 0.03, 1.1), matFrame);
        frame.position.set(0, 0.75, 0);
        frame.rotation.x = 0.5;
        panel.add(frame);
        panel.position.set(-18.6 + col * 3.2, 0, -8.4 + row * 3.55);
        field.add(panel);
      }
    }
    own("eq-pvfield", field);

    const stand = new THREE.Group();
    box(stand, 1.9, 0.9, 1.25, matConcrete, 0, 0.45, 0, false);
    box(stand, 1.7, 0.06, 0.08, matSteel, 0, 0.95, 0.5);
    box(stand, 1.7, 0.06, 0.08, matSteel, 0, 0.95, -0.5);
    box(stand, 0.08, 0.06, 1.05, matSteel, 0.82, 0.95, 0);
    box(stand, 0.08, 0.06, 1.05, matSteel, -0.82, 0.95, 0);
    const defs: { id: string; thick: number; build: (g: THREE.Group) => void }[] = [
      {
        id: "eq-insul",
        thick: 0.045,
        build: (g) => {
          box(g, 1.52, 0.045, 0.9, matInsulation, 0, 0, 0);
        },
      },
      {
        id: "eq-channels",
        thick: 0.04,
        build: (g) => {
          box(g, 1.5, 0.012, 0.88, matCopper, 0, -0.008, 0);
          for (let i = 0; i < 5; i += 1) {
            cyl(g, 0.014, 1.56, matBandHeat, 0, 0.01, -0.3 + i * 0.15, "x", 8);
          }
        },
      },
      {
        id: "eq-absorber",
        thick: 0.02,
        build: (g) => {
          box(g, 1.5, 0.02, 0.88, matCopper, 0, 0, 0);
        },
      },
      {
        id: "eq-back",
        thick: 0.012,
        build: (g) => {
          box(g, 1.48, 0.012, 0.86, matWhite, 0, 0, 0);
        },
      },
      {
        id: "eq-eva2",
        thick: 0.012,
        build: (g) => {
          box(g, 1.46, 0.012, 0.84, matEva, 0, 0, 0, false);
        },
      },
      {
        id: "eq-cells",
        thick: 0.012,
        build: (g) => {
          box(g, 1.42, 0.012, 0.8, matCells, 0, 0, 0);
        },
      },
      {
        id: "eq-eva1",
        thick: 0.012,
        build: (g) => {
          box(g, 1.46, 0.012, 0.84, matEva, 0, 0, 0, false);
        },
      },
      {
        id: "eq-glass",
        thick: 0.018,
        build: (g) => {
          const glass = box(g, 1.52, 0.018, 0.9, matGlass, 0, 0, 0, false);
          glass.castShadow = false;
        },
      },
    ];
    let cursor = 1.02;
    defs.forEach((def, index) => {
      const g = new THREE.Group();
      def.build(g);
      g.position.y = cursor + def.thick / 2;
      cursor += def.thick + 0.006;
      g.userData.equipId = def.id;
      registry.set(def.id, g);
      stand.add(g);
      pvtLayers.push({ obj: g, baseY: g.position.y, index });
    });
    stand.position.set(-3.4, 0, 4.6);
    scene.add(stand);

    const inverter = new THREE.Group();
    box(inverter, 1.35, 1.45, 0.62, matSteel, 0, 0.85, 0);
    box(inverter, 0.7, 0.42, 0.04, matFrame, 0, 1.05, 0.32);
    box(inverter, 1.35, 0.06, 0.64, matElectric, 0, 0.4, 0);
    inverter.position.set(3.6, 0, 0.4);
    own("eq-inverter", inverter);

    const buffer = new THREE.Group();
    vessel(buffer, 0.78, 2.15, matTank, matSteelDark);
    cyl(buffer, 0.8, 0.1, matBandHeat, 0, 1.3, 0);
    buffer.position.set(8.3, 0, -2.1);
    own("eq-tbuffer", buffer);

    const hex = new THREE.Group();
    box(hex, 0.7, 0.7, 1.15, matSteel, 0, 0.7, 0);
    cyl(hex, 0.08, 0.45, matBandWater, -0.45, 0.85, 0.2, "x", 8);
    cyl(hex, 0.08, 0.45, matBandHeat, -0.45, 0.55, -0.2, "x", 8);
    box(hex, 0.9, 0.08, 0.7, matFrame, 0, 0.12, 0);
    hex.position.set(11.3, 0, 5.3);
    own("eq-hex", hex);
  }

  function buildRo() {
    const pump = new THREE.Group();
    box(pump, 1.5, 0.12, 0.7, matFrame, 0, 0.1, 0);
    cyl(pump, 0.22, 0.7, matSteelDark, -0.35, 0.4, 0, "z");
    cyl(pump, 0.16, 0.55, matSteel, 0.35, 0.38, 0, "z");
    cyl(pump, 0.05, 0.35, matElectric, 0.02, 0.4, 0, "z", 8);
    pump.position.set(14.2, 0, 9.3);
    own("eq-hpp", pump);

    const skid = new THREE.Group();
    box(skid, 4.6, 0.08, 1.8, matFrame, 0, 0.12, 0);
    for (const x of [-2.1, 2.1]) {
      for (const z of [-0.8, 0.8]) {
        box(skid, 0.08, 1.7, 0.08, matSteelDark, x, 0.95, z);
      }
    }
    box(skid, 4.4, 0.06, 0.06, matSteel, 0, 1.7, -0.8);
    box(skid, 4.4, 0.06, 0.06, matSteel, 0, 1.7, 0.8);
    for (const y of [0.72, 1.28]) {
      for (const z of [-0.38, 0.38]) {
        cyl(skid, 0.16, 2.05, matWhite, 0, y, z, "z", 16);
        cyl(skid, 0.18, 0.06, matSteelDark, -0.95, y, z, "z", 12);
        cyl(skid, 0.18, 0.06, matSteelDark, 0.95, y, z, "z", 12);
      }
    }
    cyl(skid, 0.06, 4.2, matBandWater, 0, 1.55, 0.7, "z", 8);
    cyl(skid, 0.06, 4.2, matBrinePipe(), 0, 0.48, -0.7, "z", 8);
    skid.position.set(18.6, 0, 12);
    own("eq-roskid", skid);

    const vessel = new THREE.Group();
    box(vessel, 3.3, 0.1, 0.7, matFrame, 0, 0.2, 0);
    box(vessel, 0.12, 0.35, 0.4, matSteelDark, -0.8, 0.38, 0);
    box(vessel, 0.12, 0.35, 0.4, matSteelDark, 0.8, 0.38, 0);
    const shell = cyl(vessel, 0.24, 2.3, matWhite, 0, 0.78, 0, "z", 24);
    roParts.push(slide(shell, new THREE.Vector3()));
    const capN = cyl(vessel, 0.26, 0.12, matSteelDark, 0, 0.78, -1.2, "z", 16);
    roParts.push(slide(capN, new THREE.Vector3(0, 0, -0.55)));
    const capP = cyl(vessel, 0.26, 0.12, matSteelDark, 0, 0.78, 1.2, "z", 16);
    roParts.push(slide(capP, new THREE.Vector3(0, 0, 0.7)));
    const stripes = membraneTexture();
    const memMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.55, metalness: 0.05, color: 0xf7f7f5 });
    mats.add(memMat);
    textures.add(stripes);
    [-0.7, 0, 0.7].forEach((z, index) => {
      const element = cyl(vessel, 0.18, 0.62, memMat, 0, 0.78, z, "z", 18);
      roParts.push(slide(element, new THREE.Vector3(0, 0, 1.15 + index * 0.78)));
    });
    const tube = cyl(vessel, 0.035, 2.7, matBandWater, 0, 0.78, 0, "z", 8);
    roParts.push(slide(tube, new THREE.Vector3(0, 0, 0.35)));
    vessel.position.set(15.6, 0, 16.7);
    own("eq-rovessel", vessel);
  }

  function buildPotable() {
    const remin = new THREE.Group();
    vessel(remin, 0.4, 1.35, matTank, matSteelDark);
    remin.position.set(24.4, 0, 7.6);
    own("eq-remin", remin);

    const uv = new THREE.Group();
    cyl(uv, 0.16, 1.15, matSteel, 0, 0.7, 0, "z");
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0xd5e9ff,
      emissive: 0x9ec9ff,
      emissiveIntensity: 0.7,
      roughness: 0.3,
    });
    mats.add(glowMat);
    cyl(uv, 0.1, 0.08, glowMat, 0, 0.7, 0.5, "z", 12);
    box(uv, 0.7, 0.08, 0.4, matFrame, 0, 0.28, 0);
    uv.position.set(27.1, 0, 7.5);
    own("eq-uv", uv);

    const chlor = new THREE.Group();
    cyl(chlor, 0.22, 0.48, matWhite, 0, 0.4, 0);
    box(chlor, 0.3, 0.2, 0.24, matControlBox(), 0.4, 0.28, 0);
    chlor.position.set(24.3, 0, 4.5);
    own("eq-chlor", chlor);

    const tank = new THREE.Group();
    vessel(tank, 1.15, 2.45, matTank, matSteelDark);
    cyl(tank, 1.18, 0.1, matBandWater, 0, 1.5, 0);
    tank.position.set(28.4, 0, 3.3);
    own("eq-ptank", tank);
  }

  function buildCsp() {
    const field = new THREE.Group();
    [-16, -10, -4].forEach((x) => {
      [-21.2, -15.2].forEach((z) => {
        field.add(trough(x, z, 5.4));
      });
    });
    own("eq-troughs", field);

    const steam = new THREE.Group();
    vessel(steam, 0.62, 2.5, matTank, matSteelDark);
    cyl(steam, 0.64, 0.12, matBandHeat, 0, 1.7, 0);
    cyl(steam, 0.28, 0.9, matSteel, 0, 2.55, 0, "z");
    steam.position.set(12, 0, -16);
    own("eq-steam", steam);

    const turb = new THREE.Group();
    box(turb, 3.4, 0.22, 1.35, matConcrete, 0.3, 0.14, 0);
    cyl(turb, 0.4, 1.35, matSteel, -0.35, 0.85, 0, "z", 24);
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(-0.35, 0.85, 0);
    for (let i = 0; i < 8; i += 1) {
      const pivot = new THREE.Group();
      pivot.rotation.x = (i / 8) * Math.PI * 2;
      const blade = solid(new THREE.BoxGeometry(0.05, 0.32, 0.05), matSteelDark);
      blade.position.y = 0.2;
      pivot.add(blade);
      rotorGroup.add(pivot);
    }
    turb.add(rotorGroup);
    rotor = rotorGroup;
    cyl(turb, 0.3, 1.05, matSteelDark, 1.2, 0.82, 0, "z", 20);
    cyl(turb, 0.33, 0.08, matElectric, 0.55, 0.82, 0, "z", 16);
    turb.position.set(21, 0, -15);
    own("eq-turbine", turb);

    const cond = new THREE.Group();
    box(cond, 1.5, 0.85, 0.8, matSteel, 0, 0.7, 0);
    for (let i = 0; i < 6; i += 1) {
      box(cond, 0.025, 0.7, 0.7, matSteelDark, -0.55 + i * 0.22, 1.25, 0, false);
    }
    cond.position.set(20.4, 0, -10.6);
    own("eq-condenser", cond);

    const sw = new THREE.Group();
    box(sw, 2.3, 1.7, 0.7, matSteel, 0, 0.95, 0);
    box(sw, 2.3, 0.08, 0.72, matElectric, 0, 0.45, 0);
    box(sw, 0.4, 0.5, 0.04, matFrame, -0.6, 1.15, 0.36);
    box(sw, 0.4, 0.5, 0.04, matFrame, 0, 1.15, 0.36);
    box(sw, 0.4, 0.5, 0.04, matFrame, 0.6, 1.15, 0.36);
    sw.position.set(14.4, 0, -9.2);
    own("eq-switch", sw);
  }

  function buildBrine() {
    const basins = new THREE.Group();
    [2.2, 8.5, 14.8].forEach((x) => basins.add(basin(x, 0, 5.5, 4.3, false)));
    basins.position.set(0, 0, 22.4);
    own("eq-basins", basins);

    const crystal = basin(0, 0, 5.4, 4.6, true);
    crystal.position.set(22.2, 0, 22.4);
    own("eq-crystal", crystal);
  }

  function buildControl() {
    const plc = new THREE.Group();
    box(plc, 1.15, 1.75, 0.55, matSteel, 0, 0.95, 0);
    const screen = screenTexture();
    const screenMat = new THREE.MeshStandardMaterial({ map: screen, roughness: 0.4, metalness: 0.1, emissive: 0x241c40, emissiveIntensity: 0.35 });
    mats.add(screenMat);
    textures.add(screen);
    const display = solid(new THREE.BoxGeometry(0.72, 0.48, 0.03), screenMat);
    display.position.set(0, 1.15, 0.28);
    plc.add(display);
    const beacon = solid(new THREE.SphereGeometry(0.07, 12, 10), beaconMat, false);
    beacon.position.set(0.4, 1.9, 0);
    plc.add(beacon);
    plc.position.set(-6, 0, 18.6);
    own("eq-plc", plc);
  }

  function buildFlows() {
    flow(
      [
        [-24, 1.05, 12],
        [-24, 0.4, 12],
        [-19.2, 0.4, 11.2],
        [-19.2, 1.15, 11.2],
        [-18.2, 0.7, 13.5],
        [-14, 0.4, 12.6],
        [-11.2, 0.85, 12.4],
        [-11.2, 0.4, 7.2],
        [11.2, 0.4, 7.2],
        [11.3, 1.05, 5.7],
        [14.2, 0.55, 8.6],
        [16.6, 1.15, 11.6],
      ],
      0x3aa0ff,
      0.045,
      0.09,
      8,
    );
    flow(
      [
        [20.6, 1.25, 12.3],
        [22.4, 0.45, 9.4],
        [24.4, 1.05, 7.8],
        [26.5, 0.75, 7.5],
        [27.4, 0.45, 5.2],
        [28.4, 1.35, 4.1],
      ],
      0x3aa0ff,
      0.04,
      0.1,
      5,
    );
    flow(
      [
        [20.2, 0.55, 12.8],
        [20.2, 0.36, 18.8],
        [14.8, 0.36, 21.2],
        [8.5, 0.36, 22.3],
        [2.2, 0.36, 22.4],
      ],
      0x2ea66a,
      0.04,
      0.07,
      6,
    );
    flow(
      [
        [14.8, 0.42, 22.4],
        [18.4, 0.42, 22.4],
        [22.2, 0.42, 22.4],
      ],
      0x2ea66a,
      0.035,
      0.08,
      3,
    );
    flow(
      [
        [-10, 1.25, -2.2],
        [-10, 0.62, 1.2],
        [8.3, 0.62, -1.4],
        [8.3, 2.35, -2.1],
        [8.3, 0.62, 3.2],
        [11.3, 0.95, 5.1],
      ],
      0xe36a24,
      0.05,
      0.08,
      6,
    );
    flow(
      [
        [11.7, 0.55, 5.6],
        [5.4, 0.5, 6.5],
        [5.4, 0.5, 2.4],
        [-16.5, 0.5, 2.4],
        [-16.5, 1.15, -6.2],
      ],
      0xe36a24,
      0.035,
      0.075,
      5,
    );
    flow(
      [
        [-4, 1.55, -15.2],
        [8.2, 1.5, -16],
        [12, 2.55, -16],
        [17.2, 1.55, -15.2],
        [20.2, 1.05, -14.2],
        [20.4, 0.85, -11.2],
        [14.2, 0.55, -11.4],
        [12, 0.75, -14.4],
      ],
      0xf0a05a,
      0.055,
      0.085,
      7,
    );
    flow(
      [
        [3.6, 1.55, 0.5],
        [3.6, 2.45, 0.5],
        [14.4, 2.45, -8.8],
        [14.4, 1.6, -9.2],
      ],
      0xe4d3a1,
      0.03,
      0.16,
      4,
    );
    flow(
      [
        [22.1, 1.05, -15],
        [22.1, 2.5, -15],
        [15.6, 2.5, -9.2],
        [14.6, 1.7, -9.2],
      ],
      0xe4d3a1,
      0.03,
      0.16,
      4,
    );
    flow(
      [
        [-6, 1.85, 18.6],
        [-6, 2.95, 18.6],
        [-6, 2.95, 12],
        [-22, 2.95, 12],
        [-22, 1.25, 12],
      ],
      0x9b8cff,
      0.02,
      0.11,
      4,
    );
    flow(
      [
        [-6, 2.95, 14],
        [18.6, 2.95, 14],
        [18.6, 1.7, 12.6],
      ],
      0x9b8cff,
      0.018,
      0.12,
      3,
    );
    flow(
      [
        [-6, 2.95, 8],
        [-6, 2.95, -9.2],
        [14.2, 2.95, -9.2],
        [14.2, 1.85, -9.2],
      ],
      0x9b8cff,
      0.018,
      0.1,
      4,
    );
  }

  function buildLabels() {
    label("PRETREATMENT", "Groundwater", -20, 3.3, 13);
    label("PV / T FIELD", "Power and heat", -14, 3.5, -4.5);
    label("CUTAWAY", "Eight layers", -3.4, 2.6, 4.6);
    label("REVERSE OSMOSIS", "Desalination", 18.6, 3.4, 12);
    label("POTABLE", "Finished water", 26.6, 3.8, 5.2);
    label("CSP", "Steam cycle", -8, 3.6, -18);
    label("POWER BLOCK", "Turbine", 18, 3.6, -13);
    label("BRINE", "Lined basins", 12, 2.4, 22.4);
    label("SUPERVISION", "PLC", -6, 3.1, 18.6);
  }

  function flow(points: [number, number, number][], color: number, radius: number, speed: number, beads: number) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "centripetal",
      0.35,
    );
    const geo = new THREE.TubeGeometry(curve, Math.max(32, points.length * 10), radius, 6, false);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.22,
      roughness: 0.42,
      metalness: 0.18,
    });
    mats.add(material);
    const mesh = solid(geo, material, false);
    mesh.userData.skip = true;
    scene.add(mesh);
    const beadGeo = new THREE.ConeGeometry(radius * 1.7, radius * 6.5, 7);
    geos.add(beadGeo);
    const beadMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.75,
      roughness: 0.32,
    });
    mats.add(beadMat);
    const beadMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < beads; i += 1) {
      const bead = new THREE.Mesh(beadGeo, beadMat);
      bead.userData.skip = true;
      bead.castShadow = false;
      scene.add(bead);
      beadMeshes.push(bead);
    }
    flows.push({ curve, beads: beadMeshes, speed, phase: Math.random() * 0.2 });
  }

  function vessel(parent: THREE.Object3D, radius: number, height: number, body: THREE.Material, trim: THREE.Material) {
    cyl(parent, radius, height, body, 0, height / 2 + 0.08, 0);
    const top = solid(new THREE.SphereGeometry(radius, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), body);
    top.position.y = height + 0.08;
    parent.add(top);
    cyl(parent, radius + 0.02, 0.05, trim, 0, 0.2, 0);
    cyl(parent, radius * 0.55, 0.08, trim, 0, height + radius * 0.15, 0, "y", 12);
  }

  function trough(x: number, z: number, length: number) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    const rim = 1.05;
    const rimH = 0.62;
    const a = rimH / (rim * rim);
    const focus = 1 / (4 * a);
    const thick = 0.04;
    const steps = 14;
    shape.moveTo(-rim, a * rim * rim);
    for (let i = 1; i <= steps; i += 1) {
      const px = -rim + (2 * rim * i) / steps;
      shape.lineTo(px, a * px * px);
    }
    for (let i = steps; i >= 0; i -= 1) {
      const px = -rim + (2 * rim * i) / steps;
      shape.lineTo(px, a * px * px + thick);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -length / 2);
    const shell = solid(geo, matMirror, true);
    g.add(shell);
    cyl(g, 0.055, length * 0.92, matReceiver, 0, focus, 0, "z", 10);
    box(g, 0.08, 1.08, 0.08, matSteelDark, 0, -0.54, -length / 2 + 0.4);
    box(g, 0.08, 1.08, 0.08, matSteelDark, 0, -0.54, length / 2 - 0.4);
    g.position.set(x, 1.08, z);
    return g;
  }

  function basin(x: number, z: number, w: number, d: number, salt: boolean) {
    const g = new THREE.Group();
    const wall = 0.46;
    const t = 0.14;
    const bed = box(g, w, 0.08, d, matLiner, 0, 0.04, 0, false);
    bed.userData.skip = false;
    box(g, w + t, wall, t, matConcrete, 0, wall / 2, d / 2, false);
    box(g, w + t, wall, t, matConcrete, 0, wall / 2, -d / 2, false);
    box(g, t, wall, d, matConcrete, w / 2, wall / 2, 0, false);
    box(g, t, wall, d, matConcrete, -w / 2, wall / 2, 0, false);
    const water = box(g, w - 0.28, salt ? 0.1 : 0.2, d - 0.28, matBrine, 0, salt ? 0.14 : 0.18, 0, false);
    water.castShadow = false;
    if (salt) {
      const crust = box(g, w - 0.4, 0.05, d - 0.4, matSalt, 0, 0.24, 0, false);
      crust.castShadow = false;
    }
    g.position.set(x, 0, z);
    return g;
  }

  function slide(obj: THREE.Object3D, extra: THREE.Vector3): Slide {
    return { obj, base: obj.position.clone(), extra };
  }

  function matBrinePipe() {
    return std(0x2ea66a, { roughness: 0.4, metalness: 0.2, emissive: 0x145c38, emissiveIntensity: 0.2 });
  }

  function matControlBox() {
    return std(0x2a3142, { roughness: 0.5, metalness: 0.3, emissive: 0x9b8cff, emissiveIntensity: 0.15 });
  }

  function cellTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = "#102848";
    ctx.fillRect(0, 0, 256, 160);
    const cols = 6;
    const rows = 4;
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < rows; y += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#1a4e86" : "#163e6c";
        ctx.fillRect(6 + x * 41, 6 + y * 38, 36, 32);
        ctx.strokeStyle = "#d5dde6";
        ctx.lineWidth = 1;
        ctx.strokeRect(8 + x * 41, 8 + y * 38, 32, 28);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function saltTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 80; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.5})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 6, 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function sandTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = "#c6b59a";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i += 1) {
      const v = 150 + Math.random() * 70;
      ctx.fillStyle = `rgba(${v}, ${v - 18}, ${v - 45}, 0.28)`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 18);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.add(tex);
    return tex;
  }

  function membraneTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = "#f3f5f6";
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = "#b7c3cc";
    ctx.lineWidth = 2;
    for (let i = -4; i < 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 20, 64);
      ctx.lineTo(i * 20 + 48, 0);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function screenTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    ctx.fillStyle = "#141824";
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = "#9b8cff";
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 20, 70, 36);
    ctx.strokeRect(100, 20, 70, 36);
    ctx.strokeRect(184, 48, 52, 36);
    ctx.strokeRect(40, 90, 80, 40);
    ctx.beginPath();
    ctx.moveTo(86, 38);
    ctx.lineTo(100, 38);
    ctx.moveTo(170, 38);
    ctx.lineTo(184, 66);
    ctx.stroke();
    ctx.fillStyle = "#9aabbe";
    ctx.font = "16px sans-serif";
    ctx.fillText("QATRATHERM", 16, 150);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}

function findEquip(obj: THREE.Object3D | null): string | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (typeof cur.userData.equipId === "string") return cur.userData.equipId;
    cur = cur.parent;
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
