export function triggerConfetti(originX?: number, originY?: number) {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '99999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const startX = originX ?? canvas.width / 2;
  const startY = originY ?? canvas.height / 2;

  const colors = ['#ff5500', '#00e88a', '#f39c12', '#ffffff', '#ff3d5a', '#ffaa00'];
  const particleCount = 55;

  const particles = Array.from({ length: particleCount }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 9 + 4;
    return {
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4, // initial upward lift
      size: Math.random() * 7 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 14,
    };
  });

  const startTime = performance.now();

  function animate(now: number) {
    if (!ctx) return;
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let anyAlive = false;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28; // gravity
      p.vx *= 0.97; // friction
      p.rotation += p.rotSpeed;
      p.alpha = Math.max(0, 1 - elapsed / 1500);

      if (p.alpha > 0) {
        anyAlive = true;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.7);
        ctx.restore();
      }
    }

    if (anyAlive && elapsed < 1600) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(animate);
}
