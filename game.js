/**
 * Aventura no Céu - Jogo 2D de Avião
 * Desenvolvido em HTML5 Canvas e Vanilla JavaScript
 */

(() => {
  // --- Elementos do DOM ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const btnPlay = document.getElementById('btnPlay');
  const btnRestart = document.getElementById('btnRestart');
  const currentScoreEl = document.getElementById('currentScore');
  const hudHighScoreEl = document.getElementById('hudHighScore');
  const finalScoreEl = document.getElementById('finalScore');
  const bestScoreEl = document.getElementById('bestScore');
  const audioToggleBtn = document.getElementById('audioToggleBtn');

  // --- Estados do Jogo ---
  const STATE = {
    START: 'START',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER'
  };

  let gameState = STATE.START;
  let score = 0;
  let highScore = parseInt(localStorage.getItem('sky_adventure_highscore') || '0', 10);
  hudHighScoreEl.textContent = highScore;

  // --- Gerenciador de Áudio com Web Audio API ---
  let audioEnabled = true;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!audioEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    if (type === 'start') {
      // Fanfarra alegre rápida de decolagem
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'crash') {
      // Som de explosão/impacto (ruído com filtro passa-baixa)
      const bufferSize = audioCtx.sampleRate * 0.4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start(now);
    }
  }

  audioToggleBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    audioToggleBtn.textContent = audioEnabled ? '🔊' : '🔇';
    audioToggleBtn.title = audioEnabled ? 'Som Ativado' : 'Som Desativado';
  });

  // --- Controles de Teclado ---
  const keys = {
    up: false,
    down: false,
    left: false,
    right: false
  };

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') {
      keys.up = true;
      e.preventDefault();
    }
    if (code === 'ArrowDown' || code === 'KeyS') {
      keys.down = true;
      e.preventDefault();
    }
    if (code === 'ArrowLeft' || code === 'KeyA') {
      keys.left = true;
      e.preventDefault();
    }
    if (code === 'ArrowRight' || code === 'KeyD') {
      keys.right = true;
      e.preventDefault();
    }

    // Atalho para iniciar ou reiniciar pelo teclado (Espaço ou Enter)
    if (code === 'Space' || code === 'Enter') {
      if (gameState === STATE.START) {
        startGame();
      } else if (gameState === STATE.GAMEOVER) {
        startGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    if (code === 'ArrowUp' || code === 'KeyW') keys.up = false;
    if (code === 'ArrowDown' || code === 'KeyS') keys.down = false;
    if (code === 'ArrowLeft' || code === 'KeyA') keys.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') keys.right = false;
  });

  // --- Entidade: Avião do Jogador ---
  const player = {
    x: 100,
    y: 200,
    width: 60,
    height: 32,
    speed: 5.2,
    pitchAngle: 0,
    propellerAngle: 0,
    smokeParticles: [],

    reset() {
      this.x = 120;
      this.y = canvas.height / 2 - this.height / 2;
      this.pitchAngle = 0;
      this.smokeParticles = [];
    },

    update() {
      let movingUp = keys.up;
      let movingDown = keys.down;
      let movingLeft = keys.left;
      let movingRight = keys.right;

      // Movimentação
      if (movingUp) this.y -= this.speed;
      if (movingDown) this.y += this.speed;
      if (movingLeft) this.x -= this.speed;
      if (movingRight) this.x += this.speed;

      // Limites de tela
      const margin = 10;
      if (this.x < margin) this.x = margin;
      if (this.x + this.width > canvas.width - margin) this.x = canvas.width - margin - this.width;
      if (this.y < margin) this.y = margin;
      if (this.y + this.height > canvas.height - margin) this.y = canvas.height - margin - this.height;

      // Inclinação suave do avião baseada no movimento vertical
      const targetAngle = movingUp ? -0.22 : movingDown ? 0.22 : 0;
      this.pitchAngle += (targetAngle - this.pitchAngle) * 0.15;

      // Hélice girando
      this.propellerAngle += 0.8;

      // Gerar partículas de fumaça na cauda
      if (Math.random() < 0.6) {
        this.smokeParticles.push({
          x: this.x - 4,
          y: this.y + this.height / 2 + (Math.random() * 4 - 2),
          vx: -(Math.random() * 2 + 3),
          vy: (Math.random() - 0.5) * 0.8,
          radius: Math.random() * 4 + 3,
          alpha: 0.65
        });
      }

      // Atualizar fumaça
      for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
        const p = this.smokeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius += 0.2;
        p.alpha -= 0.02;
        if (p.alpha <= 0) {
          this.smokeParticles.splice(i, 1);
        }
      }
    },

    draw() {
      // Desenhar fumaça primeiro (atrás do avião)
      for (const p of this.smokeParticles) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 248, 255, ${p.alpha})`;
        ctx.fill();
        ctx.restore();
      }

      // Desenhar Avião com rotação (pitchAngle)
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(this.pitchAngle);

      const w = this.width;
      const h = this.height;
      const halfW = w / 2;
      const halfH = h / 2;

      // --- Sombra suave projetada ---
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.ellipse(-2, 14, halfW * 0.85, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- Fuselagem Principal (Corpo do avião) ---
      const bodyGrad = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
      bodyGrad.addColorStop(0, '#e11d48');   // Vermelho vibrante
      bodyGrad.addColorStop(0.5, '#f43f5e'); // Rosa-vermelho brilhante
      bodyGrad.addColorStop(1, '#be123c');   // Vermelho escuro

      ctx.beginPath();
      ctx.moveTo(-halfW + 4, -halfH + 6);
      ctx.quadraticCurveTo(0, -halfH, halfW - 10, -2);
      ctx.quadraticCurveTo(halfW + 4, halfH / 2, halfW - 6, halfH - 2);
      ctx.quadraticCurveTo(0, halfH + 2, -halfW + 4, halfH - 6);
      ctx.closePath();
      ctx.fillStyle = bodyGrad;
      ctx.fill();

      // Faixa decorativa branca na fuselagem
      ctx.beginPath();
      ctx.moveTo(-halfW + 12, 1);
      ctx.lineTo(halfW - 8, 1);
      ctx.lineTo(halfW - 12, 5);
      ctx.lineTo(-halfW + 14, 5);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // --- Cauda / Leme Traseiro ---
      ctx.beginPath();
      ctx.moveTo(-halfW + 2, -halfH + 6);
      ctx.lineTo(-halfW - 10, -halfH - 8);
      ctx.lineTo(-halfW - 2, -halfH - 8);
      ctx.lineTo(-halfW + 14, -halfH + 4);
      ctx.closePath();
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // --- Asas ---
      // Asa superior/principal
      const wingGrad = ctx.createLinearGradient(-10, -halfH, 15, halfH);
      wingGrad.addColorStop(0, '#fecdd3');
      wingGrad.addColorStop(1, '#e11d48');

      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(16, 0);
      ctx.lineTo(8, halfH + 10);
      ctx.lineTo(-14, halfH + 10);
      ctx.closePath();
      ctx.fillStyle = wingGrad;
      ctx.fill();
      ctx.strokeStyle = '#9f1239';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // --- Cabine de Pilotagem (Cockpit) com vidro reflexivo ---
      const glassGrad = ctx.createLinearGradient(0, -halfH + 2, 18, 0);
      glassGrad.addColorStop(0, '#e0f2fe');
      glassGrad.addColorStop(0.6, '#38bdf8');
      glassGrad.addColorStop(1, '#0284c7');

      ctx.beginPath();
      ctx.ellipse(8, -4, 12, 6, -0.1, 0, Math.PI * 2);
      ctx.fillStyle = glassGrad;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Reflexo de luz na cabine
      ctx.beginPath();
      ctx.ellipse(6, -6, 6, 2, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();

      // --- Bico frontal do avião ---
      ctx.beginPath();
      ctx.arc(halfW - 4, 3, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();

      // --- Hélice Girando na frente ---
      ctx.save();
      ctx.translate(halfW + 1, 3);
      ctx.scale(0.3, Math.sin(this.propellerAngle)); // Efeito 3D da hélice girando
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 18, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    },

    // Hitbox ligeiramente ajustada para evitar colisões injustas nas pontas transparentes
    getHitbox() {
      const paddingX = 8;
      const paddingY = 6;
      return {
        x: this.x + paddingX,
        y: this.y + paddingY,
        width: this.width - paddingX * 2,
        height: this.height - paddingY * 2
      };
    }
  };

  // --- Cenário com Parallax (Céu, Nuvens e Montanhas) ---
  const scenery = {
    cloudsFar: [],
    cloudsNear: [],
    mountains: [],

    init() {
      // Nuvens distantes
      this.cloudsFar = [];
      for (let i = 0; i < 5; i++) {
        this.cloudsFar.push({
          x: Math.random() * canvas.width,
          y: Math.random() * (canvas.height * 0.65),
          scale: 0.6 + Math.random() * 0.4,
          speed: 0.6 + Math.random() * 0.4
        });
      }

      // Nuvens próximas
      this.cloudsNear = [];
      for (let i = 0; i < 4; i++) {
        this.cloudsNear.push({
          x: Math.random() * canvas.width,
          y: Math.random() * (canvas.height * 0.75),
          scale: 1.0 + Math.random() * 0.5,
          speed: 1.5 + Math.random() * 0.8
        });
      }

      // Montanhas ao fundo
      this.mountains = [];
      let currentX = 0;
      while (currentX < canvas.width + 200) {
        const width = 140 + Math.random() * 120;
        const height = 90 + Math.random() * 70;
        this.mountains.push({
          x: currentX,
          width: width,
          height: height
        });
        currentX += width * 0.75;
      }
    },

    update(gameSpeedFactor = 1) {
      // Movimentar nuvens distantes
      for (const c of this.cloudsFar) {
        c.x -= c.speed * gameSpeedFactor;
        if (c.x < -160) {
          c.x = canvas.width + Math.random() * 80;
          c.y = Math.random() * (canvas.height * 0.65);
        }
      }

      // Movimentar nuvens próximas
      for (const c of this.cloudsNear) {
        c.x -= c.speed * gameSpeedFactor;
        if (c.x < -200) {
          c.x = canvas.width + Math.random() * 100;
          c.y = Math.random() * (canvas.height * 0.75);
        }
      }

      // Movimentar montanhas
      for (const m of this.mountains) {
        m.x -= 0.4 * gameSpeedFactor;
      }
      // Reorganizar montanhas que saíram pela esquerda
      if (this.mountains.length > 0 && this.mountains[0].x + this.mountains[0].width < 0) {
        const first = this.mountains.shift();
        const last = this.mountains[this.mountains.length - 1];
        first.x = last.x + last.width * 0.75;
        this.mountains.push(first);
      }
    },

    drawBackground() {
      // 1. Gradiente do Céu
      const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      skyGrad.addColorStop(0, '#0284c7');   // Azul celeste vívido
      skyGrad.addColorStop(0.55, '#38bdf8'); // Azul claro
      skyGrad.addColorStop(0.85, '#bae6fd'); // Horizonte brilhante
      skyGrad.addColorStop(1, '#7dd3fc');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Sol suave no canto
      const sunGrad = ctx.createRadialGradient(720, 90, 15, 720, 90, 110);
      sunGrad.addColorStop(0, 'rgba(255, 255, 230, 0.9)');
      sunGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.5)');
      sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(720, 90, 110, 0, Math.PI * 2);
      ctx.fill();

      // 3. Montanhas distantes no horizonte
      ctx.save();
      for (const m of this.mountains) {
        ctx.beginPath();
        ctx.moveTo(m.x, canvas.height);
        ctx.lineTo(m.x + m.width * 0.5, canvas.height - m.height);
        ctx.lineTo(m.x + m.width, canvas.height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(56, 115, 175, 0.28)';
        ctx.fill();
      }
      ctx.restore();

      // 4. Desenhar nuvens de fundo (camada 1)
      for (const c of this.cloudsFar) {
        this.drawCloud(c.x, c.y, c.scale, 'rgba(255, 255, 255, 0.45)');
      }
    },

    drawForeground() {
      // Nuvens da frente mais nítidas
      for (const c of this.cloudsNear) {
        this.drawCloud(c.x, c.y, c.scale, 'rgba(255, 255, 255, 0.75)');
      }
    },

    drawCloud(x, y, scale, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.arc(22, -10, 30, 0, Math.PI * 2);
      ctx.arc(52, -4, 22, 0, Math.PI * 2);
      ctx.arc(70, 8, 18, 0, Math.PI * 2);
      ctx.arc(35, 12, 22, 0, Math.PI * 2);
      ctx.arc(10, 12, 20, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  };

  // --- Gerenciador de Obstáculos ---
  let obstacles = [];
  let obstacleTimer = 0;
  let obstacleInterval = 110; // frames entre novos obstáculos
  let baseSpeed = 4.2;

  class Obstacle {
    constructor(type) {
      this.type = type; // 'stormCloud' ou 'balloon'
      this.x = canvas.width + 50;
      this.speed = baseSpeed + Math.random() * 1.8 + Math.min(score * 0.005, 3.5);

      if (this.type === 'stormCloud') {
        this.width = 72;
        this.height = 48;
        this.y = 20 + Math.random() * (canvas.height - this.height - 40);
        this.flashTimer = Math.random() * 60;
      } else {
        // Balão de ar quente
        this.width = 46;
        this.height = 64;
        this.y = 30 + Math.random() * (canvas.height - this.height - 50);
        this.bobOffset = Math.random() * Math.PI * 2;
      }
    }

    update() {
      this.x -= this.speed;

      if (this.type === 'balloon') {
        // Flutuação vertical suave
        this.bobOffset += 0.05;
        this.y += Math.sin(this.bobOffset) * 0.6;
      } else if (this.type === 'stormCloud') {
        this.flashTimer++;
      }
    }

    draw() {
      if (this.type === 'stormCloud') {
        this.drawStormCloud();
      } else {
        this.drawBalloon();
      }
    }

    drawStormCloud() {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

      // Sombra inferior escura
      ctx.beginPath();
      ctx.ellipse(0, 8, 34, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#334155';
      ctx.fill();

      // Círculos volumosos da nuvem de tempestade
      const cloudGrad = ctx.createLinearGradient(-30, -20, 30, 20);
      cloudGrad.addColorStop(0, '#475569');
      cloudGrad.addColorStop(0.5, '#334155');
      cloudGrad.addColorStop(1, '#1e293b');

      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(-22, 2, 18, 0, Math.PI * 2);
      ctx.arc(-6, -10, 24, 0, Math.PI * 2);
      ctx.arc(18, -4, 20, 0, Math.PI * 2);
      ctx.arc(24, 8, 14, 0, Math.PI * 2);
      ctx.arc(0, 10, 18, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();

      // Contorno de aviso sutil
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Relâmpago interno cintilante
      if (Math.sin(this.flashTimer * 0.15) > 0.8) {
        ctx.beginPath();
        ctx.moveTo(-6, 4);
        ctx.lineTo(-2, 14);
        ctx.lineTo(-7, 15);
        ctx.lineTo(2, 26);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.restore();
    }

    drawBalloon() {
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + 24);

      // Balão (Oval superior)
      const balloonGrad = ctx.createLinearGradient(-18, -20, 18, 20);
      balloonGrad.addColorStop(0, '#f97316');
      balloonGrad.addColorStop(0.5, '#ea580c');
      balloonGrad.addColorStop(1, '#c2410c');

      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = balloonGrad;
      ctx.fill();

      // Listras amarelas no balão
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 25, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Cordas do cesto
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-8, 24);
      ctx.lineTo(-5, 34);
      ctx.moveTo(8, 24);
      ctx.lineTo(5, 34);
      ctx.stroke();

      // Cestinha marrom
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-6, 34, 12, 10);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1;
      ctx.strokeRect(-6, 34, 12, 10);

      ctx.restore();
    }

    getHitbox() {
      // Hitbox calibrada para uma colisão precisa e justa
      const padX = 6;
      const padY = 6;
      return {
        x: this.x + padX,
        y: this.y + padY,
        width: this.width - padX * 2,
        height: this.height - padY * 2
      };
    }
  }

  // --- Sistema de Partículas de Explosão (Game Over) ---
  let explosionParticles = [];

  function createExplosion(x, y) {
    explosionParticles = [];
    const colors = ['#f97316', '#ef4444', '#fbbf24', '#ffffff', '#334155'];
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 2;
      explosionParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 5 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  function updateAndDrawExplosion() {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
      const p = explosionParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        explosionParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Detecção de Colisão ---
  function checkCollision(box1, box2) {
    return (
      box1.x < box2.x + box2.width &&
      box1.x + box1.width > box2.x &&
      box1.y < box2.y + box2.height &&
      box1.y + box1.height > box2.y
    );
  }

  // --- Controle de Ciclo de Vida do Jogo ---
  function startGame() {
    initAudio();
    gameState = STATE.PLAYING;
    score = 0;
    currentScoreEl.textContent = '0';
    obstacles = [];
    obstacleTimer = 0;
    explosionParticles = [];
    player.reset();

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');

    playSound('start');
  }

  function gameOver() {
    gameState = STATE.GAMEOVER;
    playSound('crash');

    createExplosion(player.x + player.width / 2, player.y + player.height / 2);

    // Salvar melhor pontuação
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('sky_adventure_highscore', highScore.toString());
      hudHighScoreEl.textContent = highScore;
    }

    finalScoreEl.textContent = score;
    bestScoreEl.textContent = highScore;

    // Exibir tela de game over com suave atraso para ver a explosão
    setTimeout(() => {
      if (gameState === STATE.GAMEOVER) {
        gameOverScreen.classList.remove('hidden');
      }
    }, 400);
  }

  btnPlay.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);

  // --- Inicialização do Cenário ---
  scenery.init();

  // --- Loop Principal do Jogo ---
  let lastTime = 0;
  let scoreAccumulator = 0;

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Atualizar e Desenhar Cenário
    const speedFactor = gameState === STATE.PLAYING ? 1.0 : 0.35;
    scenery.update(speedFactor);
    scenery.drawBackground();

    // 2. Comportamento específico por estado
    if (gameState === STATE.PLAYING) {
      // Atualizar Jogador
      player.update();
      player.draw();

      // Gerenciar Obstáculos
      obstacleTimer++;
      // Reduz o intervalo entre obstáculos gradualmente conforme pontua
      const currentInterval = Math.max(50, obstacleInterval - Math.floor(score / 35));
      if (obstacleTimer >= currentInterval) {
        obstacleTimer = 0;
        const type = Math.random() < 0.5 ? 'stormCloud' : 'balloon';
        obstacles.push(new Obstacle(type));
      }

      // Atualizar e Desenhar Obstáculos + Checar Colisões
      const playerBox = player.getHitbox();
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();
        obs.draw();

        // Checar colisão
        if (checkCollision(playerBox, obs.getHitbox())) {
          gameOver();
          break;
        }

        // Remover obstáculos que saíram da tela
        if (obs.x + obs.width < -30) {
          obstacles.splice(i, 1);
        }
      }

      // Incrementar pontuação conforme o avanço (aproximadamente 10 pontos a cada segundo)
      scoreAccumulator += deltaTime;
      if (scoreAccumulator >= 100) {
        const pointsToAdd = Math.floor(scoreAccumulator / 100);
        score += pointsToAdd;
        scoreAccumulator %= 100;
        currentScoreEl.textContent = score;

        if (score > highScore) {
          hudHighScoreEl.textContent = score;
        }
      }
    } else if (gameState === STATE.START) {
      // Modo de Demonstração / Menu Inicial
      // O avião flutua suavemente no meio da tela
      player.y = canvas.height / 2 - player.height / 2 + Math.sin(timestamp * 0.003) * 12;
      player.x = 140;
      player.pitchAngle = Math.sin(timestamp * 0.003) * 0.08;
      player.propellerAngle += 0.5;
      player.draw();
    } else if (gameState === STATE.GAMEOVER) {
      // Durante o game over: desenha os obstáculos estáticos e a explosão
      for (const obs of obstacles) {
        obs.draw();
      }
      updateAndDrawExplosion();
    }

    // 3. Desenhar Nuvens de Primeiro Plano (Parallax)
    scenery.drawForeground();

    requestAnimationFrame(gameLoop);
  }

  // Iniciar Game Loop
  requestAnimationFrame(gameLoop);
})();
