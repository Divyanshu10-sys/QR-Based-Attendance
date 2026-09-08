// Shared helpers for working with face-api.js landmarks: descriptor extraction and
// lightweight liveness metrics (eye-aspect-ratio for blink, a heuristic yaw/pitch
// proxy for head turns). These are approximations computed from 2D landmarks, not
// true 3D pose — good enough to distinguish a live, moving face from a static photo
// when combined with randomized challenges and short time windows, but not a
// substitute for dedicated liveness hardware/SDKs.

const FaceHelpers = (() => {
  const MODEL_URL = window.FACE_MODEL_URL || 'https://justadudewhohacks.github.io/face-api.js/models';
  let modelsLoaded = false;

  async function loadModels() {
    if (modelsLoaded) return;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Eye-aspect-ratio using the standard 6-point eye landmark formula.
  function eyeAspectRatio(eyePoints) {
    const [p1, p2, p3, p4, p5, p6] = eyePoints;
    const vertical = dist(p2, p6) + dist(p3, p5);
    const horizontal = 2 * dist(p1, p4);
    return horizontal === 0 ? 0 : vertical / horizontal;
  }

  function computeMetricsFromDetection(detection) {
    const landmarks = detection.landmarks;
    const positions = landmarks.positions;

    // face-api.js uses the standard 68-point scheme:
    // left eye 36-41, right eye 42-47, nose tip ~30, chin ~8, jaw 0 & 16
    const leftEye = positions.slice(36, 42);
    const rightEye = positions.slice(42, 48);
    const ear = (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2;

    const noseTip = positions[30];
    const jawLeft = positions[0];
    const jawRight = positions[16];
    const faceWidth = dist(jawLeft, jawRight) || 1;
    const faceCenterX = (jawLeft.x + jawRight.x) / 2;
    // Heuristic yaw proxy in "degree-like" units, not a true angle
    const yaw = ((noseTip.x - faceCenterX) / faceWidth) * 90;

    const chin = positions[8];
    const browMid = positions[27];
    const faceHeight = dist(browMid, chin) || 1;
    const noseVerticalRatio = (noseTip.y - browMid.y) / faceHeight;
    // Heuristic pitch proxy — decreases as the head tilts up
    const pitch = (0.5 - noseVerticalRatio) * 90;

    return { ear, yaw, pitch };
  }

  return { loadModels, computeMetricsFromDetection };
})();
