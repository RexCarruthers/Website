// Interactive 3D overview of one hole, cut down from the golf-sim-oc app.
// Terrain + aerial photo, height-banded green and the tournament pins.
// Babylon.js is only fetched from the CDN when the viewer is opened.
(function () {
  "use strict";

  var root = document.getElementById("hole-viewer");
  var DATA = window.HOLE_VIEWER_DATA;
  if (!root || !DATA) return;

  var BABYLON_URLS = [
    "https://cdn.babylonjs.com/babylon.js",
    "https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js"
  ];
  var YD_TO_M = 0.9144;
  var M_TO_YD = 1 / YD_TO_M;

  var canvas = root.querySelector("canvas");
  var poster = root.querySelector(".hv-poster");
  var status = root.querySelector(".hv-status");
  var toolbar = root.querySelector(".hv-toolbar");
  var title = root.querySelector(".hv-title");

  title.textContent = DATA.course + " · Hole " + DATA.hole +
    (DATA.par ? " · Par " + DATA.par : "") + (DATA.yardage ? " · " + DATA.yardage + " yd" : "");

  poster.addEventListener("click", start);

  function setStatus(msg) {
    status.textContent = msg || "";
    status.hidden = !msg;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
  }

  function blobUrl(b64, type) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: type }));
  }

  // ---- TFW affine (world metres <-> aerial pixels) ----
  var T = DATA.tfw;
  var A = T[0], D = T[1], B = T[2], E = T[3], C = T[4], F = T[5], IMG_W = T[6], IMG_H = T[7];
  var DET = A * E - B * D;
  function worldToPixel(x, y) {
    return {
      col: (E * (x - C) - B * (y - F)) / DET,
      row: (-D * (x - C) + A * (y - F)) / DET
    };
  }
  function pixelToApp(col, row) {
    // TFW world (m) -> app XZ (yd); the GLB is 180 degrees from the TFW frame.
    return { x: -(A * col + B * row + C) * M_TO_YD, z: -(D * col + E * row + F) * M_TO_YD };
  }

  async function start() {
    poster.disabled = true;
    root.classList.add("hv-active");
    try {
      setStatus("Loading 3D engine…");
      if (!window.BABYLON) {
        for (var i = 0; i < BABYLON_URLS.length; i++) await loadScript(BABYLON_URLS[i]);
      }
      setStatus("Building hole…");
      await buildScene();
      setStatus("");
      poster.hidden = true;
      toolbar.hidden = false;
    } catch (e) {
      console.error(e);
      setStatus("Couldn't load the 3D view: " + e.message);
      poster.disabled = false;
    }
  }

  // Same import pipeline as the app: Z-up metres -> Y-up yards, baked into vertices.
  async function importGlb(scene, b64) {
    var url = blobUrl(b64, "model/gltf-binary");
    var result = await BABYLON.SceneLoader.ImportMeshAsync("", "", url, scene, null, ".glb");
    URL.revokeObjectURL(url);
    var meshes = result.meshes;
    var node = new BABYLON.TransformNode("bake", scene);
    meshes.forEach(function (m) { if (!m.parent) m.parent = node; });
    node.rotation.x = -Math.PI / 2;
    node.scaling = new BABYLON.Vector3(M_TO_YD, M_TO_YD, M_TO_YD);
    var main = meshes[0], most = 0;
    meshes.forEach(function (m) {
      var n = m.getTotalVertices ? m.getTotalVertices() : 0;
      if (n > 0) { m.computeWorldMatrix(true); m.bakeCurrentTransformIntoVertices(); }
      if (n > most) { most = n; main = m; }
    });
    meshes.forEach(function (m) {
      m.parent = null;
      m.position = BABYLON.Vector3.Zero();
      m.rotationQuaternion = null;
      m.rotation = BABYLON.Vector3.Zero();
      m.scaling = new BABYLON.Vector3(1, 1, 1);
      m.isPickable = false;
    });
    node.dispose();
    main.refreshBoundingInfo();
    main.isPickable = true;
    return main;
  }

  function surfaceY(scene, mesh, x, z) {
    var top = mesh.getBoundingInfo().boundingBox.maximumWorld.y + 50;
    var hit = scene.pickWithRay(
      new BABYLON.Ray(new BABYLON.Vector3(x, top, z), new BABYLON.Vector3(0, -1, 0), 1000),
      function (m) { return m === mesh; }
    );
    return hit && hit.hit ? hit.pickedPoint.y : null;
  }

  async function buildScene() {
    var engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    var scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0.09, 0.13, 0.1, 1);
    new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene).intensity = 0.9;

    var camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 4, 200, BABYLON.Vector3.Zero(), scene);
    camera.minZ = 0.5;
    camera.maxZ = 5000;

    // ---- terrain with aerial photo ----
    var terrain = await importGlb(scene, DATA.terrainGlb);
    var pos = terrain.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    var uvs = new Float32Array(pos.length / 3 * 2);
    for (var i = 0; i < pos.length / 3; i++) {
      var p = worldToPixel(-pos[i * 3] / M_TO_YD, -pos[i * 3 + 2] / M_TO_YD);
      uvs[i * 2] = p.col / IMG_W;
      uvs[i * 2 + 1] = 1 - p.row / IMG_H;
    }
    terrain.setVerticesData(BABYLON.VertexBuffer.UVKind, uvs);
    terrain.material = aerialMaterial(scene);

    // ---- green with elevation bands ----
    var green = await importGlb(scene, DATA.greenGlb);
    green.material = heightMaterial(scene, green, 0.03);   // finest step in the app

    // ---- pins ----
    var pin = makePin(scene);
    var rounds = Object.keys(DATA.pins || {}).sort();
    var pinSpots = {};
    rounds.forEach(function (r) {
      var pp = DATA.pins[r];
      var y = surfaceY(scene, green, pp.x, pp.z);
      if (y == null) y = surfaceY(scene, terrain, pp.x, pp.z) || 0;
      pinSpots[r] = new BABYLON.Vector3(pp.x, y, pp.z);
    });

    // ---- camera framing: behind the tee, looking at the middle of the hole ----
    var mid = pixelToApp(IMG_W / 2, IMG_H / 2);
    var endA = pixelToApp(IMG_W / 2, 0), endB = pixelToApp(IMG_W / 2, IMG_H);
    var gc = green.getBoundingInfo().boundingBox.centerWorld;
    var tee = BABYLON.Vector2.Distance(new BABYLON.Vector2(endA.x, endA.z), new BABYLON.Vector2(gc.x, gc.z)) >
              BABYLON.Vector2.Distance(new BABYLON.Vector2(endB.x, endB.z), new BABYLON.Vector2(gc.x, gc.z)) ? endA : endB;
    var midY = surfaceY(scene, terrain, mid.x, mid.z);
    var holeLen = Math.hypot(endA.x - endB.x, endA.z - endB.z);
    var home = {
      target: new BABYLON.Vector3(mid.x, midY == null ? gc.y : midY, mid.z),
      alpha: Math.atan2(tee.z - mid.z, tee.x - mid.x),
      beta: 0.95,
      radius: holeLen * 0.95
    };
    var greenView = {
      target: gc.clone(),
      alpha: home.alpha,
      beta: 0.9,
      radius: 45
    };

    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = holeLen * 2.5;
    camera.upperBetaLimit = 1.35;
    camera.wheelPrecision = 3;
    camera.pinchPrecision = 3;
    camera.panningSensibility = 40;
    camera.panningAxis = new BABYLON.Vector3(1, 0, 1);
    applyView(camera, home);
    camera.attachControl(canvas, true);

    // Only zoom with the wheel once the viewer has been clicked, so the page
    // still scrolls normally when the mouse passes over it.
    camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
    canvas.addEventListener("wheel", function (e) {
      if (document.activeElement !== canvas) return;
      e.preventDefault();
      camera.inertialRadiusOffset += -e.deltaY * camera.radius / 2500;
    }, { passive: false });
    canvas.addEventListener("pointerdown", function () { canvas.focus({ preventScroll: true }); });
    root.addEventListener("mouseleave", function () { canvas.blur(); });

    // Keep the flag a readable size at any zoom.
    scene.onBeforeRenderObservable.add(function () {
      var s = Math.max(1, Math.min(8, camera.radius / 35));
      pin.scaling.set(s, s, s);
    });

    // ---- toolbar ----
    var roundBox = toolbar.querySelector(".hv-rounds");
    function showRound(r) {
      pin.position.copyFrom(pinSpots[r]);
      pin.setEnabled(true);
      roundBox.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.dataset.round === r));
      });
    }
    rounds.forEach(function (r) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "R" + r;
      b.dataset.round = r;
      b.addEventListener("click", function () { showRound(r); });
      roundBox.appendChild(b);
    });
    if (rounds.length) showRound(rounds[0]); else pin.setEnabled(false);

    toolbar.querySelector(".hv-home").addEventListener("click", function () { flyTo(scene, camera, home); });
    toolbar.querySelector(".hv-green").addEventListener("click", function () { flyTo(scene, camera, greenView); });

    // ---- render only while on screen ----
    var onScreen = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; }).observe(root);
    }
    engine.runRenderLoop(function () { if (onScreen) scene.render(); });
    new ResizeObserver(function () { engine.resize(); }).observe(canvas);
  }

  function applyView(camera, v) {
    camera.target = v.target.clone();
    camera.alpha = v.alpha;
    camera.beta = v.beta;
    camera.radius = v.radius;
  }

  function flyTo(scene, camera, v) {
    var ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    // Take the short way round.
    var a = camera.alpha, t = v.alpha;
    while (t - a > Math.PI) t -= Math.PI * 2;
    while (t - a < -Math.PI) t += Math.PI * 2;
    [["target", camera.target.clone(), v.target], ["alpha", a, t], ["beta", camera.beta, v.beta], ["radius", camera.radius, v.radius]]
      .forEach(function (k) {
        BABYLON.Animation.CreateAndStartAnimation("fly-" + k[0], camera, k[0], 60, 54, k[1], k[2],
          BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT, ease);
      });
  }

  function aerialMaterial(scene) {
    BABYLON.Effect.ShadersStore.hvAerialVertexShader = [
      "precision highp float;",
      "attribute vec3 position; attribute vec3 normal; attribute vec2 uv;",
      "uniform mat4 world; uniform mat4 worldViewProjection;",
      "varying vec3 vNormal; varying vec2 vUV;",
      "void main() {",
      "  vNormal = normalize(mat3(world) * normal);",
      "  vUV = uv;",
      "  gl_Position = worldViewProjection * vec4(position, 1.0);",
      "}"
    ].join("\n");
    // Only the photographed rectangle is drawn, with rounded, darkened edges.
    BABYLON.Effect.ShadersStore.hvAerialFragmentShader = [
      "precision highp float;",
      "varying vec3 vNormal; varying vec2 vUV;",
      "uniform sampler2D aerialTex; uniform vec3 lightDir;",
      "void main() {",
      "  vec2 q = abs(vUV * 2.0 - 1.0) - (1.0 - 0.06);",
      "  float sdf = length(max(q, 0.0)) - 0.06;",
      "  if (sdf > 0.0) discard;",
      "  float light = 0.7 + 0.3 * max(dot(normalize(vNormal), normalize(lightDir)), 0.0);",
      "  float edge = min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y));",
      "  vec3 col = texture2D(aerialTex, vUV).rgb * light * mix(0.55, 1.0, smoothstep(0.0, 0.08, edge));",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");
    var mat = new BABYLON.ShaderMaterial("hvAerial", scene, { vertex: "hvAerial", fragment: "hvAerial" }, {
      attributes: ["position", "normal", "uv"],
      uniforms: ["world", "worldViewProjection", "lightDir"],
      samplers: ["aerialTex"]
    });
    var url = blobUrl(DATA.aerialJpg, "image/jpeg");
    var tex = new BABYLON.Texture(url, scene, false, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
      function () { URL.revokeObjectURL(url); }, null, null, false, ".jpg");
    tex.wrapU = tex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    tex.anisotropicFilteringLevel = 8;
    mat.setTexture("aerialTex", tex);
    mat.setVector3("lightDir", new BABYLON.Vector3(-0.5, 1.0, 0.3));
    mat.backFaceCulling = false;
    return mat;
  }

  // Elevation bands, same palette as the app's putting view.
  function heightMaterial(scene, mesh, step) {
    var bb = mesh.getBoundingInfo().boundingBox;
    var minY = bb.minimumWorld.y;
    var bands = Math.max(2, Math.ceil((bb.maximumWorld.y - minY) / step));
    BABYLON.Effect.ShadersStore.hvHeightVertexShader = [
      "precision highp float;",
      "attribute vec3 position; attribute vec3 normal;",
      "uniform mat4 world; uniform mat4 worldViewProjection;",
      "varying float vHeight; varying vec3 vNormal;",
      "void main() {",
      "  vHeight = (world * vec4(position, 1.0)).y;",
      "  vNormal = normalize(mat3(world) * normal);",
      "  gl_Position = worldViewProjection * vec4(position, 1.0);",
      "}"
    ].join("\n");
    BABYLON.Effect.ShadersStore.hvHeightFragmentShader = [
      "precision highp float;",
      "varying float vHeight; varying vec3 vNormal;",
      "uniform float minY; uniform float stepSize; uniform float numBands; uniform vec3 lightDir;",
      "void main() {",
      "  float band = clamp(floor((vHeight - minY) / stepSize), 0.0, numBands - 1.0);",
      "  float t = band / max(numBands - 1.0, 1.0);",
      "  vec3 col = vec3(0.04 + t * 0.32, 0.18 + t * 0.50, 0.03 + t * 0.08);",
      "  col *= 0.45 + 0.55 * max(dot(normalize(vNormal), normalize(lightDir)), 0.0);",
      "  gl_FragColor = vec4(col, 1.0);",
      "}"
    ].join("\n");
    var mat = new BABYLON.ShaderMaterial("hvHeight", scene, { vertex: "hvHeight", fragment: "hvHeight" }, {
      attributes: ["position", "normal"],
      uniforms: ["world", "worldViewProjection", "minY", "stepSize", "numBands", "lightDir"]
    });
    mat.setFloat("minY", minY);
    mat.setFloat("stepSize", step);
    mat.setFloat("numBands", bands);
    mat.setVector3("lightDir", new BABYLON.Vector3(-0.5, 1.0, 0.3));
    mat.backFaceCulling = false;
    mat.zOffset = -4;   // draw over the terrain where the two surfaces coincide
    return mat;
  }

  function makePin(scene) {
    var pin = new BABYLON.TransformNode("pin", scene);
    var white = new BABYLON.StandardMaterial("pinWhite", scene);
    white.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.92);
    white.emissiveColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    var red = new BABYLON.StandardMaterial("pinRed", scene);
    red.diffuseColor = new BABYLON.Color3(0.9, 0.2, 0.15);
    red.emissiveColor = new BABYLON.Color3(0.5, 0.08, 0.05);
    red.backFaceCulling = false;
    var dark = new BABYLON.StandardMaterial("cup", scene);
    dark.diffuseColor = BABYLON.Color3.Black();
    dark.zOffset = -8;

    // 4.25" cup, 7' flagstick (yards)
    var cup = BABYLON.MeshBuilder.CreateDisc("cup", { radius: 0.059, tessellation: 24 }, scene);
    cup.rotation.x = Math.PI / 2;
    cup.position.y = 0.01;
    cup.material = dark;
    var stick = BABYLON.MeshBuilder.CreateCylinder("stick", { height: 2.33, diameter: 0.03 }, scene);
    stick.position.y = 2.33 / 2;
    stick.material = white;
    var flag = BABYLON.MeshBuilder.CreatePlane("flag", { width: 0.6, height: 0.4 }, scene);
    flag.position.set(0.3, 2.33 - 0.2, 0);
    flag.material = red;
    flag.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    [cup, stick, flag].forEach(function (m) { m.parent = pin; m.isPickable = false; });
    return pin;
  }
})();
