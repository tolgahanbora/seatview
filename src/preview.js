import { getHall } from './hall-state.js';

const NEAR = 0.12;
const colors = {
  seat: ['#421e22', '#5e262b', '#32171b', '#3d1a20', '#76363b', '#2b1518'],
  selected: ['#4f8e64', '#71ba86', '#264b34', '#386849', '#8bd49e', '#25412e'],
};

function pointsOnScreen(points) {
  const hall = getHall();
  return points.map(([u, v]) => [
    (u - 0.5) * hall.screen.width,
    hall.screen.bottom + (1 - v) * hall.screen.height,
    0,
  ]);
}

function makeScreen() {
  const hall = getHall();
  return [
    { fill: '#201d19', vertices: pointsOnScreen([[0, 0], [1, 0], [1, 1], [0, 1]]) },
    { fill: '#ddcdb0', vertices: pointsOnScreen([[.012, .025], [.988, .025], [.988, .975], [.012, .975]]) },
    { fill: '#edddbb', vertices: pointsOnScreen([[.012, .44], [.988, .58], [.988, .975], [.012, .975]]) },
    { fill: '#b89568', vertices: pointsOnScreen([[.012, .66], [.22, .55], [.37, .57], [.54, .69], [.72, .6], [.988, .64], [.988, .975], [.012, .975]]) },
    { fill: '#977350', vertices: pointsOnScreen([[.012, .89], [.28, .69], [.42, .65], [.63, .81], [.81, .84], [.988, .73], [.988, .975], [.012, .975]]) },
    { fill: '#e1bd83', vertices: pointsOnScreen([[.56, .975], [.7, .85], [.87, .79], [.988, .75], [.988, .975]]) },
  ];
}

function box(x, y, z, width, height, depth, palette) {
  const vertices = [
    [x, y, z], [x + width, y, z], [x + width, y + height, z], [x, y + height, z],
    [x, y, z + depth], [x + width, y, z + depth],
    [x + width, y + height, z + depth], [x, y + height, z + depth],
  ];
  const sides = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 4, 7, 3], [1, 5, 6, 2], [3, 2, 6, 7], [0, 1, 5, 4]];
  return sides.map((indices, i) => ({ fill: palette[i], vertices: indices.map((index) => vertices[index]) }));
}

function makeChairs(activeSeat) {
  return getHall().seats.flatMap((seat) => {
    const palette = seat === activeSeat ? colors.selected : colors.seat;
    const width = seat.recliner ? 0.57 : 0.53;
    const left = seat.x - width / 2;
    return [
      ...box(left, seat.y + .14, seat.z - .19, width, .22, .43, palette),
      ...box(left, seat.y + .36, seat.z + .12, width, .64, .15, palette),
    ];
  });
}

function clipNear(vertices) {
  const clipped = [];
  for (let index = 0; index < vertices.length; index += 1) {
    const point = vertices[index];
    const previous = vertices[(index + vertices.length - 1) % vertices.length];
    if ((point[2] >= NEAR) !== (previous[2] >= NEAR)) {
      const t = (NEAR - previous[2]) / (point[2] - previous[2]);
      clipped.push([
        previous[0] + (point[0] - previous[0]) * t,
        previous[1] + (point[1] - previous[1]) * t,
        NEAR,
      ]);
    }
    if (point[2] >= NEAR) clipped.push(point);
  }
  return clipped;
}

/** Kamera → perde hedefi yönüne göre yazılım projeksiyonu. */
function viewTransform(camera, lookAt) {
  const lookDx = lookAt.x - camera.x;
  const lookDy = lookAt.y - camera.y;
  const lookDz = lookAt.z - camera.z;
  const yaw = Math.atan2(-lookDx, -lookDz);
  const horizontal = Math.hypot(lookDx, lookDz);
  const pitch = Math.atan2(lookDy, horizontal);
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const sinPitch = Math.sin(pitch);
  const cosPitch = Math.cos(pitch);

  return ([x, y, z]) => {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const forward = camera.z - z;
    const horizontalDepth = dx * sinYaw + forward * cosYaw;
    return [
      dx * cosYaw - forward * sinYaw,
      dy * cosPitch - horizontalDepth * sinPitch,
      dy * sinPitch + horizontalDepth * cosPitch,
    ];
  };
}

function interpolateCamera(seat, hall, remaining) {
  const lookAt = hall.screenTarget ?? {
    x: 0,
    y: hall.screen.bottom + hall.screen.height / 2,
    z: 0,
  };
  const eye = {
    x: seat.x,
    y: seat.y + hall.eyeHeight,
    z: seat.z,
  };
  const overview = {
    x: 0,
    y: Math.max(lookAt.y + 2.6, 5.2),
    z: eye.z + Math.max(4.5, (eye.z - lookAt.z) * 0.35),
  };
  const t = 1 - remaining;
  return {
    x: overview.x + (eye.x - overview.x) * t,
    y: overview.y + (eye.y - overview.y) * t,
    z: overview.z + (eye.z - overview.z) * t,
    lookAt,
  };
}

/** Göz sabit; bakış yönünü yatay eksende çevir (radyan). */
function cameraWithYaw(camera, yawDelta) {
  if (!yawDelta) return camera;
  const lookAt = camera.lookAt ?? { x: 0, y: 3, z: 0 };
  const dx = lookAt.x - camera.x;
  const dz = lookAt.z - camera.z;
  const dist = Math.hypot(dx, dz) || 1;
  const angle = Math.atan2(dx, dz);
  const next = angle + yawDelta;
  return {
    ...camera,
    lookAt: {
      x: camera.x + Math.sin(next) * dist,
      y: lookAt.y,
      z: camera.z + Math.cos(next) * dist,
    },
  };
}

function drawScene(context, width, height, camera, screen, chairs) {
  const glow = context.createLinearGradient(0, 0, 0, height);
  glow.addColorStop(0, '#080908');
  glow.addColorStop(.62, '#24201a');
  glow.addColorStop(1, '#0a0a09');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  const lookAt = camera.lookAt ?? { x: 0, y: 3, z: 0 };
  const toView = viewTransform(camera, lookAt);
  const focal = Math.min(width * .63, height * 1.14);

  function draw(fill, vertices) {
    if (vertices.length < 3) return;
    context.beginPath();
    for (const [x, y, z] of vertices) {
      context.lineTo(width / 2 + x * focal / z, height * .43 - y * focal / z);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
  }

  for (const face of screen) draw(face.fill, clipNear(face.vertices.map(toView)));

  const visibleChairs = chairs
    .map(({ fill, vertices }) => ({ fill, vertices: clipNear(vertices.map(toView)) }))
    .filter(({ vertices }) => vertices.length >= 3)
    .map((face) => ({
      ...face,
      depth: face.vertices.reduce((sum, point) => sum + point[2], 0) / face.vertices.length,
    }))
    .sort((a, b) => b.depth - a.depth);

  for (const face of visibleChairs) draw(face.fill, face.vertices);
}

const MAX_YAW = 0.75;
const PAN_STEP = 0.09;
const PAN_DRAG = 0.0032;

export function createPreview(canvas) {
  const context = canvas.getContext('2d');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame;
  let activeSeat;
  let chairs;
  let startedAt;
  let screenFaces;
  let yawOffset = 0;
  let introComplete = false;
  let dragging = false;
  let dragX = 0;
  /** @type {(() => void) | undefined} */
  let detachLookControls;

  function draw(now) {
    if (!activeSeat) return;
    const hall = getHall();
    const ratio = Math.min(devicePixelRatio, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
    }

    const progress = reducedMotion.matches ? 1 : Math.min((now - startedAt) / 900, 1);
    const remaining = (1 - progress) ** 3;
    introComplete = progress >= 1;
    const baseCamera = interpolateCamera(activeSeat, hall, remaining);
    const lookYaw = introComplete ? yawOffset : 0;
    const camera = cameraWithYaw(baseCamera, lookYaw);
    drawScene(context, width, height, camera, screenFaces, chairs);
    if (progress < 1) frame = requestAnimationFrame(draw);
  }

  function requestRedraw() {
    if (!activeSeat) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  }

  function clampYaw(value) {
    return Math.max(-MAX_YAW, Math.min(MAX_YAW, value));
  }

  function nudgeYaw(delta) {
    if (!introComplete) return;
    yawOffset = clampYaw(yawOffset + delta);
    requestRedraw();
  }

  function attachLookControls() {
    canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';

    const viewport = canvas.closest('.viewport');

    function onPointerDown(event) {
      if (!introComplete || event.button !== 0) return;
      dragging = true;
      dragX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
      if (!dragging) return;
      const delta = event.clientX - dragX;
      dragX = event.clientX;
      yawOffset = clampYaw(yawOffset + delta * PAN_DRAG);
      requestRedraw();
    }

    function onPointerUp(event) {
      if (!dragging) return;
      dragging = false;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    }

    function onKeyDown(event) {
      if (!introComplete) return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        nudgeYaw(-PAN_STEP);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nudgeYaw(PAN_STEP);
      }
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('keydown', onKeyDown);

    const panLeft = viewport?.querySelector('[data-preview-pan="left"]');
    const panRight = viewport?.querySelector('[data-preview-pan="right"]');
    const onPanLeft = () => nudgeYaw(-PAN_STEP);
    const onPanRight = () => nudgeYaw(PAN_STEP);
    panLeft?.addEventListener('click', onPanLeft);
    panRight?.addEventListener('click', onPanRight);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('keydown', onKeyDown);
      panLeft?.removeEventListener('click', onPanLeft);
      panRight?.removeEventListener('click', onPanRight);
      canvas.tabIndex = -1;
    };
  }

  const resize = new ResizeObserver(() => {
    if (!activeSeat) return;
    requestRedraw();
  });
  resize.observe(canvas);

  return {
    start(seat) {
      cancelAnimationFrame(frame);
      activeSeat = seat;
      yawOffset = 0;
      introComplete = reducedMotion.matches;
      screenFaces = makeScreen();
      chairs = makeChairs(seat);
      detachLookControls?.();
      detachLookControls = attachLookControls();
      frame = requestAnimationFrame((now) => {
        startedAt = now;
        draw(now);
      });
    },
    stop() {
      cancelAnimationFrame(frame);
      detachLookControls?.();
      detachLookControls = undefined;
      activeSeat = undefined;
      dragging = false;
      yawOffset = 0;
    },
  };
}
