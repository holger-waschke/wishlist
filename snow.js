// --- Snow effect ---
(function initSnow() {
  const canvas = document.getElementById('snow-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height, flakes;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    const count = Math.floor(width * height / 5000); // density
    flakes = Array.from({ length: count }, () => newFlake());
  }

  function newFlake() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1 + Math.random() * 2.5,
      speedY: 0.5 + Math.random() * 1.5,
      driftX: -0.5 + Math.random() * 1,
      opacity: 0.4 + Math.random() * 0.6,
    };
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';

    for (const f of flakes) {
      ctx.globalAlpha = f.opacity;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();

      f.y += f.speedY;
      f.x += f.driftX;

      if (f.y > height + 5) {
        f.y = -5;
        f.x = Math.random() * width;
      }
      if (f.x < -5) f.x = width + 5;
      if (f.x > width + 5) f.x = -5;
    }

    requestAnimationFrame(draw);
  }

  // Style canvas above background but below content
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '0',
  });
  document.querySelector('.page').style.position = 'relative';
  document.querySelector('.page').style.zIndex = '1';

  window.addEventListener('resize', resize);
  resize();
  draw();
})();
