// Drives the QR -> location -> identity(face+liveness) flow on scan.html.
// Every step's real validation happens server-side; this script's job is to collect
// the right evidence (QR payload, GPS coords, face descriptor, liveness samples)
// and present state, not to decide pass/fail itself.

(function () {
  const user = requireRole('student');
  if (!user) return;

  let sessionId = null;
  let html5QrCode = null;
  let stream = null;
  let challenge = null;
  let samples = [];
  let sampling = false;
  let finalDescriptor = null;

  const CHALLENGE_LABELS = {
    blink: 'Blink naturally',
    turn_left: 'Turn your head to the left',
    turn_right: 'Turn your head to the right',
    look_up: 'Tilt your head up slightly'
  };

  function setDot(id, state) {
    const dot = document.getElementById(id);
    dot.classList.remove('active', 'done');
    if (state) dot.classList.add(state);
  }

  function showStage(id) {
    ['stageQr', 'stageLocation', 'stageIdentity', 'stageSuccess', 'stageError'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
  }

  function showError(message) {
    document.getElementById('errorText').textContent = message;
    showStage('stageError');
    stopCamera();
    if (html5QrCode) { try { html5QrCode.stop(); } catch (e) {} }
  }

  function stopCamera() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  // ---------- STAGE 1: QR ----------
  function startQrScanner() {
    html5QrCode = new Html5Qrcode('qrReader');
    const qrStatus = document.getElementById('qrStatus');
    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        let payload;
        try { payload = JSON.parse(decodedText); } catch (e) { return; }
        if (!payload.sid || !payload.tok) return;

        try {
          await html5QrCode.pause(true);
        } catch (e) {}

        qrStatus.textContent = 'Verifying QR…';
        try {
          await Api.post('/attendance/verify-qr', { sessionId: payload.sid, token: payload.tok });
          sessionId = payload.sid;
          try { await html5QrCode.stop(); } catch (e) {}
          setDot('dot-qr', 'done'); document.getElementById('line-1').classList.add('done');
          setDot('dot-loc', 'active');
          showStage('stageLocation');
          requestLocation();
        } catch (err) {
          qrStatus.textContent = err.message;
          qrStatus.style.color = 'var(--danger)';
          setTimeout(() => { try { html5QrCode.resume(); } catch (e) {} qrStatus.style.color = 'var(--muted)'; qrStatus.textContent = ''; }, 2500);
        }
      },
      () => { /* per-frame scan failure, ignore (normal while searching) */ }
    ).catch(err => {
      qrStatus.textContent = 'Camera error: ' + err;
    });
  }

  // ---------- STAGE 2: LOCATION ----------
  function requestLocation() {
    const statusEl = document.getElementById('locationStatus');
    if (!navigator.geolocation) {
      showError('Your browser does not support location services, which are required to mark attendance.');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      statusEl.textContent = 'Verifying you are in range…';
      try {
        await Api.post('/attendance/verify-location', {
          sessionId,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setDot('dot-loc', 'done'); document.getElementById('line-2').classList.add('done');
        setDot('dot-id', 'active');
        showStage('stageIdentity');
        startIdentityStage();
      } catch (err) {
        showError(err.message);
      }
    }, (err) => {
      showError('Location permission is required to mark attendance: ' + err.message);
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  // ---------- STAGE 3: IDENTITY (face + liveness) ----------
  async function startIdentityStage() {
    const identityStatus = document.getElementById('identityStatus');
    const challengeText = document.getElementById('challengeText');
    const video = document.getElementById('video');
    const overlay = document.getElementById('overlay');

    try {
      identityStatus.textContent = 'Loading face models…';
      await FaceHelpers.loadModels();

      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
      video.srcObject = stream;

      const { challenge: c } = await Api.get(`/attendance/liveness-challenge?sessionId=${sessionId}`);
      challenge = c;
      challengeText.textContent = CHALLENGE_LABELS[challenge.type] || 'Hold still';
      identityStatus.textContent = 'Detecting your face…';

      samples = [];
      sampling = true;
      const startedAt = Date.now();
      const SAMPLE_WINDOW_MS = 6000;

      const loop = async () => {
        if (!sampling) return;
        if (video.readyState === 4) {
          const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks().withFaceDescriptor();

          const ctx = overlay.getContext('2d');
          overlay.width = video.videoWidth; overlay.height = video.videoHeight;
          ctx.clearRect(0, 0, overlay.width, overlay.height);

          if (detection) {
            const box = detection.detection.box;
            ctx.strokeStyle = '#E3B23C';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            const metrics = FaceHelpers.computeMetricsFromDetection(detection);
            samples.push({ ...metrics, t: Date.now() });
            finalDescriptor = Array.from(detection.descriptor);
            identityStatus.textContent = `Recording… (${Math.ceil((SAMPLE_WINDOW_MS - (Date.now() - startedAt)) / 1000)}s)`;
          } else {
            identityStatus.textContent = 'Face not detected — stay centered in frame.';
          }
        }

        if (Date.now() - startedAt >= SAMPLE_WINDOW_MS) {
          sampling = false;
          await submitIdentity();
          return;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } catch (err) {
      showError('Camera/model error: ' + err.message);
    }
  }

  async function submitIdentity() {
    const identityStatus = document.getElementById('identityStatus');
    if (!finalDescriptor || samples.length < 3) {
      showError('Could not capture enough face data. Please try again with better lighting.');
      return;
    }
    identityStatus.textContent = 'Verifying identity…';
    try {
      await Api.post('/attendance/verify-face', {
        sessionId,
        descriptor: finalDescriptor,
        proof: { challengeId: challenge.id, completedAt: Date.now(), samples }
      });
      stopCamera();
      setDot('dot-id', 'done'); document.getElementById('line-3').classList.add('done');
      setDot('dot-done', 'done');
      showStage('stageSuccess');
    } catch (err) {
      showError(err.message);
    }
  }

  // ---------- App-switch / visibility interruption ----------
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden && sessionId && !document.getElementById('stageIdentity').classList.contains('hidden')) {
      sampling = false;
      stopCamera();
      try { await Api.post('/attendance/visibility-interrupt', { sessionId }); } catch (e) {}
      showError('Verification was interrupted because you left the page. Please restart identity verification.');
    }
  });

  document.getElementById('retryBtn').addEventListener('click', () => {
    window.location.reload();
  });

  // Kick off
  showStage('stageQr');
  startQrScanner();
})();
