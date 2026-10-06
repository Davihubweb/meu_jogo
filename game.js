/**
 * AeroSim Brasil - Simulador de Voo Regional 3D
 * Modelo: Caravaneer 208-TX (Regional Turboprop)
 * Desenvolvido com Three.js e Vanilla JavaScript
 */

(() => {
  // ==============================================================
  // 1. SISTEMA DE PROGRESSÃO E ROTAS
  // ==============================================================
  const ROUTES_DATABASE = [
    {
      id: 'sp_cwb',
      code: 'VOO AZ-2081',
      originName: 'São Paulo',
      originCode: 'SBSP (Congonhas)',
      destName: 'Curitiba',
      destCode: 'SBCT (Afonso Pena)',
      distanceKm: 330,
      durationText: '1h 15m',
      recAltitudeFt: 8500,
      recAltitudeM: 2590,
      estFuelPct: 35,
      difficulty: 'Fácil',
      difficultyClass: 'difficulty-easy',
      rewardCredits: 850,
      briefing: 'Decolagem no Aeroporto de Congonhas com subida inicial para 8.500 pés. Voo de cruzeiro sobre o relevo da Serra do Mar e aproximação final para pouso seguro na pista do Aeroporto Afonso Pena em Curitiba.',
      unlockedByDefault: true,
      minCreditsToUnlock: 0,
      destCoords: { x: 0, z: -1800 } // Localização da pista de destino no mundo 3D
    },
    {
      id: 'cwb_fln',
      code: 'VOO AZ-2082',
      originName: 'Curitiba',
      originCode: 'SBCT (Afonso Pena)',
      destName: 'Florianópolis',
      destCode: 'SBFL (Hercílio Luz)',
      distanceKm: 250,
      durationText: '55m',
      recAltitudeFt: 6500,
      recAltitudeM: 1980,
      estFuelPct: 28,
      difficulty: 'Fácil',
      difficultyClass: 'difficulty-easy',
      rewardCredits: 750,
      briefing: 'Saída do planalto paranaense em direção ao litoral catarinense. Descida visual pela baía de Florianópolis e pouso costeiro.',
      unlockedByDefault: false,
      minCreditsToUnlock: 800,
      destCoords: { x: 350, z: -2000 }
    },
    {
      id: 'sp_rio',
      code: 'VOO AZ-2083',
      originName: 'São Paulo',
      originCode: 'SBSP (Congonhas)',
      destName: 'Rio de Janeiro',
      destCode: 'SBRJ (Santos Dumont)',
      distanceKm: 360,
      durationText: '1h 10m',
      recAltitudeFt: 9000,
      recAltitudeM: 2740,
      estFuelPct: 40,
      difficulty: 'Médio',
      difficultyClass: 'difficulty-medium',
      rewardCredits: 950,
      briefing: 'Clássica ponte aérea regional sobre o Vale do Paraíba com aproximação cênica para a Baía de Guanabara.',
      unlockedByDefault: false,
      minCreditsToUnlock: 1500,
      destCoords: { x: -350, z: -2100 }
    },
    {
      id: 'rio_bh',
      code: 'VOO AZ-2084',
      originName: 'Rio de Janeiro',
      originCode: 'SBRJ (Santos Dumont)',
      destName: 'Belo Horizonte',
      destCode: 'SBCF (Confins)',
      distanceKm: 340,
      durationText: '1h 05m',
      recAltitudeFt: 8000,
      recAltitudeM: 2430,
      estFuelPct: 38,
      difficulty: 'Médio',
      difficultyClass: 'difficulty-medium',
      rewardCredits: 900,
      briefing: 'Voo com relevo acidentado sobre as serras mineiras até o planalto de Confins.',
      unlockedByDefault: false,
      minCreditsToUnlock: 2200,
      destCoords: { x: 100, z: -2200 }
    },
    {
      id: 'bh_bsb',
      code: 'VOO AZ-2085',
      originName: 'Belo Horizonte',
      originCode: 'SBCF (Confins)',
      destName: 'Brasília',
      destCode: 'SBBR (Pres. JK)',
      distanceKm: 620,
      durationText: '1h 45m',
      recAltitudeFt: 11000,
      recAltitudeM: 3350,
      estFuelPct: 65,
      difficulty: 'Difícil',
      difficultyClass: 'difficulty-hard',
      rewardCredits: 1500,
      briefing: 'Voo de longo curso regional pelo Planalto Central do Brasil com ventos variáveis e altitude elevada.',
      unlockedByDefault: false,
      minCreditsToUnlock: 3000,
      destCoords: { x: 0, z: -2400 }
    }
  ];

  // Carregar progresso do jogador
  let playerCredits = parseInt(localStorage.getItem('aerosim_credits') || '1250', 10);
  let unlockedRoutes = JSON.parse(localStorage.getItem('aerosim_unlocked_routes') || '["sp_cwb"]');
  let completedRoutes = JSON.parse(localStorage.getItem('aerosim_completed_routes') || '[]');

  function saveProgress() {
    localStorage.setItem('aerosim_credits', playerCredits.toString());
    localStorage.setItem('aerosim_unlocked_routes', JSON.stringify(unlockedRoutes));
    localStorage.setItem('aerosim_completed_routes', JSON.stringify(completedRoutes));
    updateCreditsDisplay();
  }

  function updateCreditsDisplay() {
    const el = document.getElementById('userCreditsDisplay');
    if (el) el.textContent = playerCredits.toLocaleString('pt-BR');
  }
  updateCreditsDisplay();

  let selectedRoute = ROUTES_DATABASE[0];
  let activeFlightRoute = null;
  let flightStartTime = 0;
  let flightDistanceRemainingKm = 0;

  // ==============================================================
  // 2. CONFIGURAÇÕES GERAIS E ÁUDIO
  // ==============================================================
  const CONFIG = {
    worldSize: 5000,
    runwayLength: 750,
    runwayWidth: 40,
    groundY: 0,
    takeoffSpeed: 88,    // km/h (Vr)
    cruiseSpeed: 320,    // km/h
    maxSpeed: 360,       // km/h
    stallSpeed: 75,      // km/h
    gravity: 9.81,
    fuelConsumptionRate: 0.0035 // % de combustível por segundo em 100%
  };

  let weatherCondition = 'scattered'; // 'clear', 'scattered', 'overcast'
  let audioEnabled = true;
  let audioCtx = null;
  let engineOsc = null;
  let engineGain = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
        engineOsc = audioCtx.createOscillator();
        engineGain = audioCtx.createGain();

        engineOsc.type = 'sawtooth';
        engineOsc.frequency.setValueAtTime(65, audioCtx.currentTime);
        engineGain.gain.setValueAtTime(0.001, audioCtx.currentTime);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, audioCtx.currentTime);

        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(audioCtx.destination);
        engineOsc.start();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function updateEngineSound(throttle, speed) {
    if (!audioEnabled || !audioCtx || !engineGain) return;
    const normSpeed = Math.min(1.0, speed / CONFIG.maxSpeed);
    const targetFreq = 55 + (throttle * 90) + (normSpeed * 50);
    const targetVol = 0.02 + (throttle * 0.08);

    engineOsc.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(targetVol, audioCtx.currentTime, 0.1);
  }

  function stopEngineSound() {
    if (engineGain && audioCtx) {
      engineGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.15);
    }
  }

  // ==============================================================
  // 3. CAPTURA DE ENTRADAS (TECLADO)
  // ==============================================================
  const input = {
    throttleUp: false,    // W
    throttleDown: false,  // S
    pitchUp: false,       // ArrowDown (Puxar manche)
    pitchDown: false,     // ArrowUp (Empurrar manche)
    rollLeft: false,      // ArrowLeft (Virar esquerda)
    rollRight: false      // ArrowRight (Virar direita)
  };

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': input.throttleUp = true; break;
      case 'KeyS': input.throttleDown = true; break;
      case 'ArrowDown': input.pitchUp = true; e.preventDefault(); break;
      case 'ArrowUp': input.pitchDown = true; e.preventDefault(); break;
      case 'ArrowLeft': input.rollLeft = true; e.preventDefault(); break;
      case 'ArrowRight': input.rollRight = true; e.preventDefault(); break;
      case 'F1':
        setCameraMode(CAMERA_MODES.COCKPIT);
        e.preventDefault();
        break;
      case 'F2':
        setCameraMode(CAMERA_MODES.CHASE);
        e.preventDefault();
        break;
      case 'KeyC':
        toggleCameraMode();
        break;
      case 'KeyR':
        resetFlightOnRunway();
        break;
      case 'Escape':
        openMainMenu();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': input.throttleUp = false; break;
      case 'KeyS': input.throttleDown = false; break;
      case 'ArrowDown': input.pitchUp = false; break;
      case 'ArrowUp': input.pitchDown = false; break;
      case 'ArrowLeft': input.rollLeft = false; break;
      case 'ArrowRight': input.rollRight = false; break;
    }
  });

  // ==============================================================
  // 4. CENA THREE.JS, ILUMINAÇÃO E RENDERIZADOR
  // ==============================================================
  const canvas = document.getElementById('flightCanvas');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7ec0ee); // Céu azul límpido
  scene.fog = new THREE.FogExp2(0xa6d4f2, 0.00045); // Névoa atmosférica de horizonte suave

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 7500);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Luzes da Cena
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x47663b, 0.82);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffaea, 1.05);
  dirLight.position.set(500, 900, 400);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 20;
  dirLight.shadow.camera.far = 2400;
  dirLight.shadow.camera.left = -380;
  dirLight.shadow.camera.right = 380;
  dirLight.shadow.camera.top = 380;
  dirLight.shadow.camera.bottom = -380;
  scene.add(dirLight);

  // Farol do Aeroporto (Airport Beacon verde/branco rotativo)
  const beaconGroup = new THREE.Group();
  beaconGroup.position.set(-110, 32, -40);
  const beaconLight1 = new THREE.SpotLight(0x22c55e, 2.5, 400, Math.PI / 8, 0.5);
  const beaconLight2 = new THREE.SpotLight(0xffffff, 2.5, 400, Math.PI / 8, 0.5);
  beaconLight1.position.set(0, 0, 0);
  beaconLight2.position.set(0, 0, 0);
  beaconGroup.add(beaconLight1);
  beaconGroup.add(beaconLight2);
  scene.add(beaconGroup);

  // ==============================================================
  // 5. CONSTRUÇÃO DO CENÁRIO 3D PROFISSIONAL
  // ==============================================================
  const world = {
    clouds: [],
    animatedVehicles: [],
    runwayOriginZ: 0,
    runwayDestZ: -2000,
    destRunwayGroup: null,

    build() {
      // 1. Terreno Amplo (Campos e Relevo com Colinas)
      const groundGeo = new THREE.PlaneGeometry(5000, 5000, 32, 32);
      const groundMat = new THREE.MeshLambertMaterial({ color: 0x3d6e2e }); // Verde vegetação natural
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = CONFIG.groundY;
      ground.receiveShadow = true;
      scene.add(ground);

      // Campos agrícolas / áreas de cultivo (retângulos com variações de verde e ocre)
      const farmColors = [0x4a7c36, 0x5a8c3d, 0x8a7b3b, 0x3d662b, 0x6e8e45];
      for (let i = 0; i < 45; i++) {
        const fw = 120 + Math.random() * 160;
        const fd = 120 + Math.random() * 160;
        const fGeo = new THREE.PlaneGeometry(fw, fd);
        const fMat = new THREE.MeshLambertMaterial({ color: farmColors[i % farmColors.length] });
        const field = new THREE.Mesh(fGeo, fMat);
        field.rotation.x = -Math.PI / 2;
        const fx = (Math.random() - 0.5) * 3200;
        const fz = -2400 + Math.random() * 3200;
        field.position.set(fx, CONFIG.groundY + 0.1, fz);
        scene.add(field);
      }

      // 2. Rio Sinuoso e Lagos
      const riverGeo = new THREE.PlaneGeometry(80, 4000);
      const waterMat = new THREE.MeshPhongMaterial({
        color: 0x0369a1,
        shininess: 95,
        specular: 0x93c5fd,
        transparent: true,
        opacity: 0.92
      });
      const river = new THREE.Mesh(riverGeo, waterMat);
      river.rotation.x = -Math.PI / 2;
      river.rotation.z = 0.22; // Inclinado atravessando o cenário
      river.position.set(750, CONFIG.groundY + 0.2, -1000);
      scene.add(river);

      // Lago perto do destino
      const lakeGeo = new THREE.CircleGeometry(260, 32);
      const lake = new THREE.Mesh(lakeGeo, waterMat);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(500, CONFIG.groundY + 0.22, -1800);
      scene.add(lake);

      // 3. Montanhas ao Fundo
      this.buildMountainRanges();

      // 4. Aeroporto de Origem (SBSP - Completo com Terminal, Hangares, Pistas e Iluminação)
      this.buildAirportOrigin();

      // 5. Aeroporto de Destino (SBCT - Pista de Pouso com ALS Estroboscópico)
      this.buildAirportDest();

      // 6. Rodovias e Veículos em Movimento
      this.buildHighways();

      // 7. Cidades e Conjunto de Prédios
      this.buildCities();

      // 8. Nuvens 3D
      this.buildClouds();
    },

    buildAirportOrigin() {
      const airportGroup = new THREE.Group();
      airportGroup.position.set(0, 0, 0);

      // Pista Principal de Asfalto (Runway 09/27)
      const rGeo = new THREE.PlaneGeometry(CONFIG.runwayWidth, CONFIG.runwayLength);
      const rMat = new THREE.MeshLambertMaterial({ color: 0x1e293b }); // Asfalto escuro
      const runway = new THREE.Mesh(rGeo, rMat);
      runway.rotation.x = -Math.PI / 2;
      runway.position.y = CONFIG.groundY + 0.3;
      runway.receiveShadow = true;
      airportGroup.add(runway);

      // Faixas centrais brancas tracejadas
      const dashGeo = new THREE.PlaneGeometry(2.4, 18);
      const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let z = -CONFIG.runwayLength / 2 + 40; z <= CONFIG.runwayLength / 2 - 40; z += 32) {
        const dash = new THREE.Mesh(dashGeo, whiteMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(0, CONFIG.groundY + 0.35, z);
        airportGroup.add(dash);
      }

      // Zona de toque (Touchdown stripes) nas duas cabeceiras
      for (const side of [-1, 1]) {
        const baseZ = side * (CONFIG.runwayLength / 2 - 35);
        for (let x = -CONFIG.runwayWidth / 2 + 6; x <= CONFIG.runwayWidth / 2 - 6; x += 4.5) {
          const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 22), whiteMat);
          stripe.rotation.x = -Math.PI / 2;
          stripe.position.set(x, CONFIG.groundY + 0.35, baseZ);
          airportGroup.add(stripe);
        }
      }

      // Taxiway Paralela e Alças de Acesso
      const taxiMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(22, CONFIG.runwayLength * 0.8), taxiMat);
      taxiway.rotation.x = -Math.PI / 2;
      taxiway.position.set(-65, CONFIG.groundY + 0.28, 0);
      airportGroup.add(taxiway);

      // Alças conectando pista ao taxiway
      for (const zConnect of [-200, 0, 200]) {
        const link = new THREE.Mesh(new THREE.PlaneGeometry(50, 18), taxiMat);
        link.rotation.x = -Math.PI / 2;
        link.position.set(-35, CONFIG.groundY + 0.28, zConnect);
        airportGroup.add(link);
      }

      // Luzes Balizadoras da Pista (Brancas, Verdes e Vermelhas)
      const lightGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const whiteLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
      const redLightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

      for (let z = -CONFIG.runwayLength / 2; z <= CONFIG.runwayLength / 2; z += 30) {
        const isNorth = z <= -CONFIG.runwayLength / 2 + 10;
        const isSouth = z >= CONFIG.runwayLength / 2 - 10;
        const mat = isNorth ? greenLightMat : (isSouth ? redLightMat : whiteLightMat);

        const l1 = new THREE.Mesh(lightGeo, mat);
        l1.position.set(-CONFIG.runwayWidth / 2 - 1.6, CONFIG.groundY + 0.6, z);
        airportGroup.add(l1);

        const l2 = new THREE.Mesh(lightGeo, mat);
        l2.position.set(CONFIG.runwayWidth / 2 + 1.6, CONFIG.groundY + 0.6, z);
        airportGroup.add(l2);
      }

      // Terminal de Passageiros Regional com Vidros Espelhados
      const termGroup = new THREE.Group();
      termGroup.position.set(-130, 0, -20);

      const termMain = new THREE.Mesh(
        new THREE.BoxGeometry(45, 14, 90),
        new THREE.MeshLambertMaterial({ color: 0xf1f5f9 })
      );
      termMain.position.y = 7;
      termMain.castShadow = true;
      termGroup.add(termMain);

      // Janelões de vidro do terminal
      const glassMat = new THREE.MeshPhongMaterial({
        color: 0x0284c7,
        shininess: 90,
        specular: 0xbae6fd,
        transparent: true,
        opacity: 0.8
      });
      const termGlass = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 80), glassMat);
      termGlass.position.set(22.6, 7, 0);
      termGroup.add(termGlass);

      // Torre de Controle Cilíndrica com Cúpula de Vidro
      const towerGroup = new THREE.Group();
      towerGroup.position.set(-110, 0, -40);

      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(4.5, 5.5, 30, 14),
        new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
      );
      shaft.position.y = 15;
      shaft.castShadow = true;
      towerGroup.add(shaft);

      const cab = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 5, 6, 14),
        glassMat
      );
      cab.position.y = 31;
      towerGroup.add(cab);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(7.5, 3, 14),
        new THREE.MeshLambertMaterial({ color: 0x0284c7 })
      );
      roof.position.y = 35.5;
      towerGroup.add(roof);

      airportGroup.add(towerGroup);
      airportGroup.add(termGroup);

      // Hangares de Manutenção
      for (const hgZ of [90, 160]) {
        const hangar = new THREE.Group();
        hangar.position.set(-130, 0, hgZ);

        const hMain = new THREE.Mesh(
          new THREE.CylinderGeometry(18, 18, 50, 12, 1, false, 0, Math.PI),
          new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
        );
        hMain.rotation.z = Math.PI / 2;
        hMain.rotation.y = Math.PI / 2;
        hMain.position.y = 0;
        hMain.castShadow = true;
        hangar.add(hMain);

        airportGroup.add(hangar);
      }

      // Biruta (Windsock)
      const windsockGroup = new THREE.Group();
      windsockGroup.position.set(35, 0, 50);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 9, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      pole.position.y = 4.5;
      windsockGroup.add(pole);

      const sock = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.5, 8), new THREE.MeshLambertMaterial({ color: 0xf97316 }));
      sock.rotation.z = -Math.PI / 2.2;
      sock.position.set(1.8, 8.5, 0);
      windsockGroup.add(sock);
      airportGroup.add(windsockGroup);

      // Veículos Estáticos de Serviço (Caminhão de Abastecimento e Carrinhos)
      const fuelTruck = new THREE.Group();
      fuelTruck.position.set(-85, 0, -25);
      const cabTruck = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshLambertMaterial({ color: 0xfacc15 }));
      cabTruck.position.set(0, 1.5, -2);
      fuelTruck.add(cabTruck);
      const tankTruck = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 8, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
      tankTruck.rotation.x = Math.PI / 2;
      tankTruck.position.set(0, 2, 3);
      fuelTruck.add(tankTruck);
      airportGroup.add(fuelTruck);

      scene.add(airportGroup);
    },

    buildAirportDest() {
      // Aeroporto de Destino (Com sistema ALS Estroboscópico de Aproximação)
      const destGroup = new THREE.Group();
      destGroup.position.set(0, 0, this.runwayDestZ);

      // Pista de Destino
      const rGeo = new THREE.PlaneGeometry(CONFIG.runwayWidth, CONFIG.runwayLength);
      const rMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const runway = new THREE.Mesh(rGeo, rMat);
      runway.rotation.x = -Math.PI / 2;
      runway.position.y = CONFIG.groundY + 0.3;
      runway.receiveShadow = true;
      destGroup.add(runway);

      // Faixas da pista de destino
      const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const dashGeo = new THREE.PlaneGeometry(2.4, 18);
      for (let z = -CONFIG.runwayLength / 2 + 40; z <= CONFIG.runwayLength / 2 - 40; z += 32) {
        const dash = new THREE.Mesh(dashGeo, whiteMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(0, CONFIG.groundY + 0.35, z);
        destGroup.add(dash);
      }

      // Luzes ALS (Approach Lighting System) - Linha de postes de aproximação que guiam o pouso
      const alsStrobes = [];
      const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let z = CONFIG.runwayLength / 2 + 20; z <= CONFIG.runwayLength / 2 + 280; z += 35) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.5, 6), new THREE.MeshBasicMaterial({ color: 0x94a3b8 }));
        post.position.set(0, 1.75, z);
        destGroup.add(post);

        const strobe = new THREE.Mesh(new THREE.SphereGeometry(1.0, 6, 6), strobeMat);
        strobe.position.set(0, 3.6, z);
        destGroup.add(strobe);
        alsStrobes.push(strobe);
      }
      this.alsStrobes = alsStrobes;

      // Terminal e Torre de Destino
      const termDest = new THREE.Mesh(
        new THREE.BoxGeometry(45, 12, 80),
        new THREE.MeshLambertMaterial({ color: 0xe2e8f0 })
      );
      termDest.position.set(-110, 6, 0);
      destGroup.add(termDest);

      scene.add(destGroup);
      this.destRunwayGroup = destGroup;
    },

    buildMountainRanges() {
      const mountainMat = new THREE.MeshLambertMaterial({ color: 0x334155, flatShading: true });
      const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

      // Cadeia montanhosa no flanco oeste
      for (let i = 0; i < 28; i++) {
        const r = 120 + Math.random() * 200;
        const h = 220 + Math.random() * 380;
        const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mountainMat);
        const mx = -1400 + (Math.random() - 0.5) * 600;
        const mz = -2600 + i * 160;
        m.position.set(mx, h / 2, mz);
        scene.add(m);

        // Pico com neve para montanhas muito altas
        if (h > 360) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, h * 0.35, 6), snowMat);
          cap.position.set(mx, h - (h * 0.35) / 2, mz);
          scene.add(cap);
        }
      }
    },

    buildHighways() {
      // Rodovia asfaltada que conecta cidades com pequenos veículos em movimento
      const roadGeo = new THREE.PlaneGeometry(16, 3200);
      const roadMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(280, CONFIG.groundY + 0.15, -1000);
      scene.add(road);

      // Veículos animados na rodovia
      const carColors = [0xef4444, 0x3b82f6, 0xffffff, 0xfacc15];
      for (let i = 0; i < 16; i++) {
        const car = new THREE.Mesh(
          new THREE.BoxGeometry(3.2, 1.8, 5.5),
          new THREE.MeshLambertMaterial({ color: carColors[i % carColors.length] })
        );
        const cz = -2500 + Math.random() * 3000;
        const lane = (i % 2 === 0) ? 276 : 284;
        const dir = (i % 2 === 0) ? -1 : 1;
        car.position.set(lane, CONFIG.groundY + 1.0, cz);
        scene.add(car);
        this.animatedVehicles.push({ mesh: car, speed: (30 + Math.random() * 25) * dir });
      }
    },

    buildCities() {
      // Pequena Cidade com Prédios e Casas
      const cityGroup = new THREE.Group();
      cityGroup.position.set(-350, 0, -600);

      const bColors = [0x94a3b8, 0x64748b, 0x475569, 0x38bdf8, 0xe2e8f0, 0xd97706];

      for (let x = -5; x <= 5; x++) {
        for (let z = -5; z <= 5; z++) {
          if (Math.random() < 0.3) continue;

          const height = 18 + Math.random() * 85;
          const w = 18 + Math.random() * 16;
          const d = 18 + Math.random() * 16;
          const b = new THREE.Mesh(
            new THREE.BoxGeometry(w, height, d),
            new THREE.MeshLambertMaterial({ color: bColors[Math.floor(Math.random() * bColors.length)] })
          );
          b.position.set(x * 45 + (Math.random() * 8 - 4), height / 2, z * 45 + (Math.random() * 8 - 4));
          b.castShadow = true;
          b.receiveShadow = true;
          cityGroup.add(b);
        }
      }

      // Árvores volumosas ao redor da cidade
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x78350f });
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x15803d });
      for (let i = 0; i < 80; i++) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 6), trunkMat);
        trunk.position.y = 2.5;
        tree.add(trunk);

        const leaf = new THREE.Mesh(new THREE.ConeGeometry(4.5, 10, 7), leafMat);
        leaf.position.y = 9;
        tree.add(leaf);

        tree.position.set((Math.random() - 0.5) * 500, 0, (Math.random() - 0.5) * 500);
        cityGroup.add(tree);
      }

      scene.add(cityGroup);
    },

    buildClouds() {
      // Limpar nuvens antigas
      for (const c of this.clouds) scene.remove(c);
      this.clouds = [];

      let cloudCount = 35;
      if (weatherCondition === 'clear') cloudCount = 10;
      if (weatherCondition === 'overcast') cloudCount = 70;

      const cloudMat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: weatherCondition === 'overcast' ? 0.95 : 0.88,
        flatShading: true
      });

      for (let i = 0; i < cloudCount; i++) {
        const cloud = new THREE.Group();
        const puffs = 4 + Math.floor(Math.random() * 5);

        for (let p = 0; p < puffs; p++) {
          const r = 20 + Math.random() * 24;
          const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), cloudMat);
          puff.position.set(
            (p - puffs / 2) * 22 + (Math.random() * 10 - 5),
            Math.random() * 10 - 5,
            Math.random() * 18 - 9
          );
          cloud.add(puff);
        }

        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 1800;
        cloud.position.set(
          Math.cos(angle) * dist,
          240 + Math.random() * 320,
          Math.sin(angle) * dist
        );
        scene.add(cloud);
        this.clouds.push(cloud);
      }
    },

    update(dt) {
      // Atualizar veículos na rodovia
      for (const v of this.animatedVehicles) {
        v.mesh.position.z += v.speed * dt;
        if (v.mesh.position.z < -2500) v.mesh.position.z = 500;
        if (v.mesh.position.z > 500) v.mesh.position.z = -2500;
      }

      // Piscar luzes estroboscópicas ALS de aproximação
      if (this.alsStrobes) {
        const time = performance.now() * 0.005;
        this.alsStrobes.forEach((strobe, idx) => {
          const flash = Math.sin(time - idx * 0.7) > 0.85;
          strobe.material.color.setHex(flash ? 0xffffff : 0x475569);
        });
      }

      // Farol do Aeroporto (Girar Spotlights verde e branco)
      beaconGroup.rotation.y += dt * 2.2;
    }
  };

  world.build();

  // ==============================================================
  // 6. MODELO 3D: TURBOÉLICE REGIONAL CARAVANEER 208-TX
  // ==============================================================
  class CaravaneerAirplane {
    constructor() {
      this.mesh = new THREE.Group();
      this.propeller = null;
      this.yoke = null; // Manche do cockpit
      this.cockpitInterior = null;

      // Variáveis Aerodinâmicas
      this.speed = 0;           // km/h
      this.throttle = 0;        // 0.0 a 1.0 (0% a 100%)
      this.fuel = 100;          // % de combustível
      this.altitude = 0;       // metros
      this.verticalSpeed = 0;  // m/s
      this.isGrounded = true;
      this.hasCrashed = false;

      // Atitude angular
      this.pitch = 0; // Arfagem
      this.roll = 0;  // Rolagem / Bank
      this.yaw = 0;   // Guinada / Heading

      this.groundClearance = 2.15; // Altura do eixo com as rodas no solo

      this.buildModel();
      this.resetOnRunway();
      scene.add(this.mesh);
    }

    buildModel() {
      // Materiais de Alta Qualidade
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.15
      });
      const navyStripeMat = new THREE.MeshStandardMaterial({
        color: 0x0f2744, // Azul marinho executivo
        roughness: 0.3,
        metalness: 0.2
      });
      const goldStripeMat = new THREE.MeshStandardMaterial({
        color: 0xd97706, // Faixa dourada perolizada
        roughness: 0.35,
        metalness: 0.5
      });
      const metalMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.8
      });
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.15,
        metalness: 0.95
      });
      const glassMat = new THREE.MeshPhongMaterial({
        color: 0x0f172a,
        shininess: 120,
        specular: 0x38bdf8,
        transparent: true,
        opacity: 0.82
      });

      // 1. Fuselagem Utilitária Robusta (Caravaneer 208-TX)
      // Corpo principal ligeiramente retangular/arredondado
      const fuselageGeo = new THREE.CylinderGeometry(1.35, 1.05, 12.0, 14);
      fuselageGeo.rotateX(Math.PI / 2);
      fuselageGeo.scale(0.95, 1.25, 1.0); // Seção ovalizada típica do Caravan
      const fuselage = new THREE.Mesh(fuselageGeo, bodyMat);
      fuselage.castShadow = true;
      this.mesh.add(fuselage);

      // Faixas decorativas laterais em Azul Marinho e Dourado
      const stripeGeo = new THREE.BoxGeometry(0.08, 0.4, 9.8);
      for (const side of [-1, 1]) {
        const navyStripe = new THREE.Mesh(stripeGeo, navyStripeMat);
        navyStripe.position.set(side * 1.3, -0.1, 0.4);
        this.mesh.add(navyStripe);

        const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 9.8), goldStripeMat);
        goldStripe.position.set(side * 1.3, 0.2, 0.4);
        this.mesh.add(goldStripe);
      }

      // Janelas de Passageiros nas Laterais (6 janelas de cada lado)
      const windowMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      for (let w = -2.8; w <= 3.2; w += 1.2) {
        for (const side of [-1, 1]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.75), windowMat);
          win.position.set(side * 1.32, 0.5, w);
          this.mesh.add(win);
        }
      }

      // 2. Nariz do Motor Turboélice PT6A
      const noseGeo = new THREE.ConeGeometry(1.25, 3.2, 14);
      noseGeo.rotateX(-Math.PI / 2);
      const nose = new THREE.Mesh(noseGeo, bodyMat);
      nose.position.z = -7.5;
      nose.castShadow = true;
      this.mesh.add(nose);

      // Entradas de Ar e Escapamentos Cromados Laterais da Turbina
      for (const side of [-1, 1]) {
        const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.2, 8), chromeMat);
        exhaust.rotation.x = Math.PI / 3;
        exhaust.rotation.z = side * (Math.PI / 4);
        exhaust.position.set(side * 1.15, 0.1, -6.6);
        this.mesh.add(exhaust);
      }

      // 3. Cockpit e Para-brisa Frontal
      const cockpitCanopy = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.3, 2.8, 12, 1, false, Math.PI * 0.7, Math.PI * 1.6),
        glassMat
      );
      cockpitCanopy.rotation.x = Math.PI / 2;
      cockpitCanopy.position.set(0, 0.8, -4.6);
      this.mesh.add(cockpitCanopy);

      // 4. Asa Alta com Montantes Estruturais (High-Wing Struts)
      // Asa principal montada no teto
      const wingGeo = new THREE.BoxGeometry(19.0, 0.24, 2.4);
      const wing = new THREE.Mesh(wingGeo, bodyMat);
      wing.position.set(0, 1.65, -1.2);
      wing.castShadow = true;
      this.mesh.add(wing);

      // Winglets elegantes nas pontas
      for (const side of [-1, 1]) {
        const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.2, 1.4), navyStripeMat);
        winglet.position.set(side * 9.5, 2.1, -1.2);
        this.mesh.add(winglet);
      }

      // Montantes da Asa (Wing Struts característicos do Cessna Caravan)
      for (const side of [-1, 1]) {
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.2, 6), metalMat);
        strut.rotation.z = side * 0.65;
        strut.rotation.x = -0.05;
        strut.position.set(side * 3.4, 0.5, -1.2);
        this.mesh.add(strut);
      }

      // 5. Cauda: Estabilizador Vertical e Horizontal
      const tailFinGeo = new THREE.BoxGeometry(0.2, 3.4, 2.8);
      const tailFin = new THREE.Mesh(tailFinGeo, navyStripeMat);
      tailFin.position.set(0, 2.6, 5.2);
      tailFin.castShadow = true;
      this.mesh.add(tailFin);

      const horizTailGeo = new THREE.BoxGeometry(6.4, 0.16, 1.6);
      const horizTail = new THREE.Mesh(horizTailGeo, bodyMat);
      horizTail.position.set(0, 1.4, 5.2);
      horizTail.castShadow = true;
      this.mesh.add(horizTail);

      // 6. Trem de Pouso Fixo Reforçado Utilitário
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
      const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 12);
      wheelGeo.rotateZ(Math.PI / 2);

      // Roda Dianteira com Amortecedor
      const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
      frontWheel.position.set(0, -1.6, -5.2);
      frontWheel.castShadow = true;
      this.mesh.add(frontWheel);

      const frontStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), metalMat);
      frontStrut.position.set(0, -0.9, -5.2);
      this.mesh.add(frontStrut);

      // Rodas Traseiras Principais com Hastes Tubulares
      for (const side of [-1, 1]) {
        const mainWheel = new THREE.Mesh(wheelGeo, wheelMat);
        mainWheel.position.set(side * 2.2, -1.6, 0.2);
        mainWheel.castShadow = true;
        this.mesh.add(mainWheel);

        const mainStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.0, 8), metalMat);
        mainStrut.rotation.z = side * 0.45;
        mainStrut.position.set(side * 1.5, -0.9, 0.2);
        this.mesh.add(mainStrut);
      }

      // 7. Hélice Turboélice de 4 Pás com Pontas de Alta Visibilidade
      const propGroup = new THREE.Group();
      propGroup.position.set(0, -0.05, -9.1);

      // Spinner Cônico Central Cromado
      const spinnerGeo = new THREE.ConeGeometry(0.55, 1.2, 12);
      spinnerGeo.rotateX(-Math.PI / 2);
      const spinner = new THREE.Mesh(spinnerGeo, chromeMat);
      propGroup.add(spinner);

      // 4 Pás Pretas com pontas Amarelas
      const bladeGeo = new THREE.BoxGeometry(0.26, 3.4, 0.06);
      const bladeMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
      const tipGeo = new THREE.BoxGeometry(0.28, 0.5, 0.08);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

      for (let b = 0; b < 4; b++) {
        const bladeArm = new THREE.Group();
        bladeArm.rotation.z = (Math.PI / 2) * b;

        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.y = 1.7;
        bladeArm.add(blade);

        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.y = 3.2;
        bladeArm.add(tip);

        propGroup.add(bladeArm);
      }

      this.mesh.add(propGroup);
      this.propeller = propGroup;

      // 8. Interior do Cockpit (Visível em F1)
      const cockpitGroup = new THREE.Group();
      cockpitGroup.position.set(0, 0.7, -4.2);

      // Painel de Instrumentos Frontal
      const dashPanel = new THREE.Mesh(
        new THREE.BoxGeometry(2.0, 0.9, 0.2),
        new THREE.MeshLambertMaterial({ color: 0x1e293b })
      );
      dashPanel.position.set(0, 0.1, -0.6);
      cockpitGroup.add(dashPanel);

      // Instrumentos no painel
      const instMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      for (const px of [-0.6, -0.2, 0.2, 0.6]) {
        const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), instMat);
        gauge.position.set(px, 0.15, -0.49);
        cockpitGroup.add(gauge);
      }

      // Manche (Yoke) Duplo
      const yokeGroup = new THREE.Group();
      yokeGroup.position.set(-0.4, 0.1, -0.2);
      const yokeCol = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), metalMat);
      yokeCol.rotation.x = Math.PI / 2;
      yokeGroup.add(yokeCol);

      const yokeHandle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 12, Math.PI * 1.3), metalMat);
      yokeHandle.rotation.z = Math.PI * 0.85;
      yokeHandle.position.z = 0.3;
      yokeGroup.add(yokeHandle);

      cockpitGroup.add(yokeGroup);
      this.yoke = yokeGroup;

      this.mesh.add(cockpitGroup);
      this.cockpitInterior = cockpitGroup;
    }

    resetOnRunway() {
      // Inicia na cabeceira da pista de origem SBSP
      this.mesh.position.set(0, CONFIG.groundY + this.groundClearance, CONFIG.runwayLength / 2 - 60);
      this.speed = 0;
      this.throttle = 0;
      this.fuel = 100;
      this.altitude = 0;
      this.verticalSpeed = 0;
      this.isGrounded = true;
      this.hasCrashed = false;

      this.pitch = 0;
      this.roll = 0;
      this.yaw = Math.PI; // Apontando ao longo da pista no sentido Norte (-Z)
      this.updateMeshOrientation();
    }

    updateMeshOrientation() {
      const euler = new THREE.Euler(this.pitch, this.yaw, this.roll, 'YXZ');
      this.mesh.quaternion.setFromEuler(euler);
    }

    update(dt) {
      if (this.hasCrashed) return;

      // 1. Controle de Potência (Throttle) via W e S
      if (input.throttleUp && this.fuel > 0) {
        this.throttle = Math.min(1.0, this.throttle + dt * 0.42);
      }
      if (input.throttleDown) {
        this.throttle = Math.max(0.0, this.throttle - dt * 0.42);
      }

      // Consumo de Combustível
      if (this.throttle > 0 && this.fuel > 0) {
        this.fuel = Math.max(0, this.fuel - this.throttle * CONFIG.fuelConsumptionRate * dt * 100);
        if (this.fuel <= 0) {
          this.throttle = 0; // Motor apagou por falta de combustível
        }
      }

      // Aceleração do Motor PT6A vs Arrasto Aerodinâmico
      const targetSpeed = (this.fuel > 0 ? this.throttle : 0) * CONFIG.maxSpeed;
      const accelRate = this.throttle > (this.speed / CONFIG.maxSpeed) ? 24 : 15;
      this.speed += (targetSpeed - this.speed) * Math.min(1.0, dt * (accelRate / 10));

      // Rotação da Hélice e Som do Motor
      if (this.propeller) {
        const propSpeed = (0.2 + this.throttle * 2.2 + (this.speed / CONFIG.maxSpeed)) * 40;
        this.propeller.rotation.z += propSpeed * dt;
      }
      updateEngineSound(this.throttle, this.speed);

      // Movimento do Manche (Yoke) no Cockpit
      if (this.yoke) {
        this.yoke.rotation.z = -this.roll * 1.5;
        this.yoke.position.z = -0.2 - this.pitch * 0.5;
      }

      // 2. Dinâmica de Voo e Sustentação (Aerodinâmica)
      const speedRatio = Math.max(0, this.speed / CONFIG.maxSpeed);

      if (this.isGrounded) {
        // --- NO SOLO (Pista de pouso) ---
        this.altitude = 0;
        this.verticalSpeed = 0;
        this.pitch = 0;
        this.roll = 0;

        // Curva suave na pista pelo trem de pouso direcional dianteiro
        if (input.rollLeft) this.yaw += dt * 0.75 * speedRatio;
        if (input.rollRight) this.yaw -= dt * 0.75 * speedRatio;

        // DECOLAGEM: Puxar o manche ao atingir velocidade de rotação (Vr >= 85 km/h)
        if (this.speed >= CONFIG.takeoffSpeed && input.pitchUp) {
          this.isGrounded = false;
          this.pitch = 0.14;
          this.mesh.position.y += 0.8;
        }
      } else {
        // --- EM VOO REGIONAL ---

        // Arfagem (Pitch): Seta Baixo sobe (+pitch), Seta Cima desce (-pitch)
        const pitchSensitivity = 1.35 * Math.min(1.2, speedRatio + 0.25);
        if (input.pitchUp) {
          this.pitch += dt * pitchSensitivity;
        } else if (input.pitchDown) {
          this.pitch -= dt * pitchSensitivity;
        } else {
          // Amortecimento aerodinâmico para estabilidade de voo
          this.pitch *= Math.pow(0.88, dt * 5);
        }
        this.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.pitch));

        // Curvas e Rolagem (Bank-to-turn): Inclinar as asas
        const rollSensitivity = 2.1 * Math.min(1.2, speedRatio + 0.25);
        if (input.rollLeft) {
          this.roll = Math.min(Math.PI / 3.0, this.roll + dt * rollSensitivity);
        } else if (input.rollRight) {
          this.roll = Math.max(-Math.PI / 3.0, this.roll - dt * rollSensitivity);
        } else {
          // Auto-nivelamento das asas característico de asa alta (High-Wing)
          this.roll *= Math.pow(0.55, dt * 5.5);
        }

        // Curva pelo vetor de sustentação
        const turnRate = Math.sin(this.roll) * 1.6 * Math.min(1.15, speedRatio);
        this.yaw += turnRate * dt;

        // Sustentação (Lift) vs Gravidade:
        const liftFactor = Math.pow(this.speed / CONFIG.takeoffSpeed, 1.45);
        const climbAngle = Math.sin(this.pitch);

        // Razão de subida/descida (m/s)
        this.verticalSpeed = (this.speed / 3.6) * climbAngle + (liftFactor - 1.0) * 4.8;

        // Troca de energia: subir perde velocidade; mergulhar ganha velocidade
        if (climbAngle > 0) {
          this.speed = Math.max(0, this.speed - climbAngle * dt * 20);
        } else if (climbAngle < 0) {
          this.speed = Math.min(CONFIG.maxSpeed * 1.15, this.speed - climbAngle * dt * 28);
        }

        // Pré-estol se voar devagar demais no ar
        if (this.speed < CONFIG.stallSpeed) {
          this.pitch -= dt * 0.45; // Nariz desce naturalmente no estol
        }

        // Atualizar Altitude
        this.mesh.position.y += this.verticalSpeed * dt;
        this.altitude = Math.max(0, this.mesh.position.y - (CONFIG.groundY + this.groundClearance));

        // --- SISTEMA DE CONTATO COM O SOLO E POUSO ---
        if (this.mesh.position.y <= CONFIG.groundY + this.groundClearance) {
          this.mesh.position.y = CONFIG.groundY + this.groundClearance;
          this.altitude = 0;

          // Checar se tocou em área de pista (origem ou destino)
          const inOriginRunway = Math.abs(this.mesh.position.x) < (CONFIG.runwayWidth / 2 + 8) &&
            Math.abs(this.mesh.position.z) < (CONFIG.runwayLength / 2 + 50);

          const inDestRunway = Math.abs(this.mesh.position.x) < (CONFIG.runwayWidth / 2 + 15) &&
            Math.abs(this.mesh.position.z - world.runwayDestZ) < (CONFIG.runwayLength / 2 + 70);

          const isSmoothDescent = Math.abs(this.verticalSpeed) < 5.8 && Math.abs(this.roll) < 0.32;

          if ((inOriginRunway || inDestRunway) && isSmoothDescent) {
            // Pouso correto e seguro
            this.isGrounded = true;
            this.pitch = 0;
            this.roll = 0;

            if (inDestRunway && activeFlightRoute && this.speed < 40) {
              // VOO CONCLUÍDO COM SUCESSO!
              triggerFlightCompleted();
            }
          } else {
            // Colisão / Pouso brusco fora da pista
            const reason = !isSmoothDescent
              ? 'Aeronave tocou o solo com taxa de descida excessiva ou asas desinclinadas.'
              : 'Aeronave tocou o solo fora dos limites da pista de pouso.';
            triggerFlightFailed(reason);
            return;
          }
        }
      }

      // 3. Deslocamento no Espaço 3D
      const forwardZ = -Math.cos(this.yaw);
      const forwardX = -Math.sin(this.yaw);
      const velocityMPS = (this.speed / 3.6);

      this.mesh.position.x += forwardX * velocityMPS * dt;
      this.mesh.position.z += forwardZ * velocityMPS * dt;

      this.updateMeshOrientation();
    }
  }

  const plane = new CaravaneerAirplane();

  // ==============================================================
  // 7. SISTEMA DE CÂMERAS (F1 COCKPIT & F2 TERCEIRA PESSOA)
  // ==============================================================
  const CAMERA_MODES = {
    CHASE: 'CHASE',     // F2: Terceira Pessoa Externa
    COCKPIT: 'COCKPIT'  // F1: Cockpit Interno
  };

  let currentCameraMode = CAMERA_MODES.CHASE;

  function setCameraMode(mode) {
    currentCameraMode = mode;
    const btnF1 = document.getElementById('btnCamF1');
    const btnF2 = document.getElementById('btnCamF2');
    if (btnF1 && btnF2) {
      btnF1.classList.toggle('active', mode === CAMERA_MODES.COCKPIT);
      btnF2.classList.toggle('active', mode === CAMERA_MODES.CHASE);
    }
  }

  function toggleCameraMode() {
    setCameraMode(currentCameraMode === CAMERA_MODES.CHASE ? CAMERA_MODES.COCKPIT : CAMERA_MODES.CHASE);
  }

  function updateCamera(dt) {
    const planePos = plane.mesh.position;
    const planeQuat = plane.mesh.quaternion;

    if (currentCameraMode === CAMERA_MODES.CHASE) {
      // Offset de 3ª Pessoa: 22m atrás, 5.2m acima
      const offset = new THREE.Vector3(0, 5.2, 23);
      offset.applyQuaternion(planeQuat);
      const targetPos = planePos.clone().add(offset);
      camera.position.lerp(targetPos, Math.min(1.0, dt * 7.5));

      const lookOffset = new THREE.Vector3(0, 1.4, -14);
      lookOffset.applyQuaternion(planeQuat);
      camera.lookAt(planePos.clone().add(lookOffset));

    } else if (currentCameraMode === CAMERA_MODES.COCKPIT) {
      // Câmera no assento do piloto dentro da cabine
      const cockpitEye = new THREE.Vector3(-0.4, 1.45, -4.1);
      cockpitEye.applyQuaternion(planeQuat);
      camera.position.copy(planePos.clone().add(cockpitEye));

      const lookAhead = new THREE.Vector3(-0.4, 1.45, -45);
      lookAhead.applyQuaternion(planeQuat);
      camera.lookAt(planePos.clone().add(lookAhead));
    }
  }

  // ==============================================================
  // 8. INTERFACE (HUD), NAVEGAÇÃO E ATUALIZAÇÃO EM TEMPO REAL
  // ==============================================================
  const speedText = document.getElementById('speedText');
  const altitudeFeetText = document.getElementById('altitudeFeetText');
  const altitudeMetersText = document.getElementById('altitudeMetersText');
  const verticalSpeedText = document.getElementById('verticalSpeedText');
  const throttleFill = document.getElementById('throttleFill');
  const throttleText = document.getElementById('throttleText');
  const fuelBarFill = document.getElementById('fuelBarFill');
  const fuelText = document.getElementById('fuelText');
  const hudHeading = document.getElementById('hudHeading');
  const hudDestName = document.getElementById('hudDestName');
  const hudDistanceVal = document.getElementById('hudDistanceVal');
  const hudRecAlt = document.getElementById('hudRecAlt');
  const horizonLine = document.getElementById('horizonLine');
  const flightStatus = document.getElementById('flightStatus');

  function updateHUDStatus(msg, type = 'normal') {
    if (!flightStatus) return;
    flightStatus.textContent = msg;
    flightStatus.className = 'flight-status-badge';
    if (type === 'warning') flightStatus.classList.add('warning');
    if (type === 'danger') flightStatus.classList.add('danger');
    if (type === 'success') flightStatus.classList.add('success');
  }

  function updateHUD() {
    // 1. Velocidade
    const spd = Math.round(plane.speed);
    if (speedText) speedText.textContent = spd;

    // 2. Altitude em Pés (ft) e Metros (m)
    const altM = Math.round(plane.altitude);
    const altFt = Math.round(plane.altitude * 3.28084);
    if (altitudeFeetText) altitudeFeetText.textContent = altFt.toLocaleString('pt-BR');
    if (altitudeMetersText) altitudeMetersText.textContent = `(${altM} metros)`;

    // 3. Taxa de Subida (VSI)
    if (verticalSpeedText) {
      const vs = plane.isGrounded ? 0 : plane.verticalSpeed;
      verticalSpeedText.textContent = (vs >= 0 ? '+' : '') + vs.toFixed(1);
    }

    // 4. Potência (Throttle)
    const thPct = Math.round(plane.throttle * 100);
    if (throttleText) throttleText.textContent = `${thPct}%`;
    if (throttleFill) throttleFill.style.height = `${thPct}%`;

    // 5. Combustível
    const fuelVal = Math.round(plane.fuel);
    if (fuelText) fuelText.textContent = `${fuelVal}%`;
    if (fuelBarFill) fuelBarFill.style.width = `${fuelVal}%`;

    // 6. Bússola / Heading
    let deg = Math.round(((plane.yaw * 180 / Math.PI) % 360 + 360) % 360);
    let cardinal = 'NORTE';
    if (deg >= 22.5 && deg < 67.5) cardinal = 'NORDESTE';
    else if (deg >= 67.5 && deg < 112.5) cardinal = 'LESTE';
    else if (deg >= 112.5 && deg < 157.5) cardinal = 'SUDESTE';
    else if (deg >= 157.5 && deg < 202.5) cardinal = 'SUL';
    else if (deg >= 202.5 && deg < 247.5) cardinal = 'SUDOESTE';
    else if (deg >= 247.5 && deg < 292.5) cardinal = 'OESTE';
    else if (deg >= 292.5 && deg < 337.5) cardinal = 'NOROESTE';

    const degFormatted = deg.toString().padStart(3, '0');
    if (hudHeading) hudHeading.textContent = `${degFormatted}° ${cardinal}`;

    // 7. Horizonte Artificial
    if (horizonLine) {
      const pitchDeg = (plane.pitch * 180 / Math.PI) * 1.3;
      const rollDeg = (plane.roll * 180 / Math.PI);
      horizonLine.style.transform = `translateY(${pitchDeg}px) rotate(${-rollDeg}deg)`;
    }

    // 8. Distância até o Destino (Cálculo em Tempo Real)
    if (activeFlightRoute) {
      // Distância 3D até a pista de destino
      const distToDestWorld = plane.mesh.position.distanceTo(new THREE.Vector3(0, 0, world.runwayDestZ));
      // Escala cênica para visualização em km
      const initialWorldDist = (CONFIG.runwayLength / 2 - 60) - world.runwayDestZ;
      const progress = Math.max(0, Math.min(1.0, 1.0 - (distToDestWorld / initialWorldDist)));
      flightDistanceRemainingKm = Math.max(0, Math.round(activeFlightRoute.distanceKm * (1.0 - progress)));

      if (hudDistanceVal) hudDistanceVal.textContent = flightDistanceRemainingKm;
    }

    // 9. Status Contextual de Voo
    if (!plane.hasCrashed) {
      if (plane.isGrounded) {
        if (plane.speed < 15) {
          updateHUDStatus('NA PISTA DE DECOLAGEM - AUMENTE A POTÊNCIA COM W', 'normal');
        } else if (plane.speed < CONFIG.takeoffSpeed) {
          updateHUDStatus(`CORRENDO NA PISTA (${spd}/${CONFIG.takeoffSpeed} km/h)`, 'normal');
        } else {
          updateHUDStatus('VELOCIDADE DE ROTAÇÃO (Vr)! PUXE O MANCHE COM ▼ PARA DECOLAR ✈️', 'success');
        }
      } else {
        if (plane.speed < CONFIG.stallSpeed) {
          updateHUDStatus('ALERTA: VELOCIDADE BAIXA! PERDA DE SUSTENTAÇÃO (USE W)', 'warning');
        } else if (flightDistanceRemainingKm <= 35 || plane.mesh.position.z < (world.runwayDestZ + 550)) {
          updateHUDStatus('APROXIMAÇÃO FINAL - PISTA DE DESTINO EM VISTA! REDUZA A POTÊNCIA (S)', 'success');
        } else if (altFt >= activeFlightRoute.recAltitudeFt * 0.9) {
          updateHUDStatus('EM VOO DE CRUZEIRO NA ALTITUDE RECOMENDADA', 'normal');
        } else {
          updateHUDStatus('SUBINDO PARA A ALTITUDE DE CRUZEIRO DA ROTA', 'normal');
        }
      }
    }
  }

  // ==============================================================
  // 9. CONTROLE DE MENUS, MODAIS E CICLO DE JOGO
  // ==============================================================
  const mainMenuModal = document.getElementById('mainMenuModal');
  const routesModal = document.getElementById('routesModal');
  const hangarModal = document.getElementById('hangarModal');
  const settingsModal = document.getElementById('settingsModal');
  const flightCompletedModal = document.getElementById('flightCompletedModal');
  const flightFailedModal = document.getElementById('flightFailedModal');
  const hudOverlay = document.getElementById('hudOverlay') || document.getElementById('hud-overlay');

  // Botões do Menu Principal
  const btnOpenRoutes = document.getElementById('btnOpenRoutes');
  const btnFreeFlight = document.getElementById('btnFreeFlight');
  const btnOpenHangar = document.getElementById('btnOpenHangar');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnHeaderMenu = document.getElementById('btnHeaderMenu');
  const btnPauseMenu = document.getElementById('btnPauseMenu');

  // Botões de Rotas
  const btnCloseRoutes = document.getElementById('btnCloseRoutes');
  const btnStartSelectedRoute = document.getElementById('btnStartSelectedRoute');
  const routesListContainer = document.getElementById('routesListContainer');

  // Botões do Hangar & Configurações
  const btnCloseHangar = document.getElementById('btnCloseHangar');
  const btnHangarOk = document.getElementById('btnHangarOk');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSettingsSave = document.getElementById('btnSettingsSave');
  const btnSoundToggle = document.getElementById('btnSoundToggle');

  // Botões de Conclusão / Falha
  const btnCompletedContinue = document.getElementById('btnCompletedContinue');
  const btnRetryFlight = document.getElementById('btnRetryFlight');
  const btnBackToRoutesFailed = document.getElementById('btnBackToRoutesFailed');

  // Câmeras
  const btnCamF1 = document.getElementById('btnCamF1');
  const btnCamF2 = document.getElementById('btnCamF2');
  if (btnCamF1) btnCamF1.addEventListener('click', () => setCameraMode(CAMERA_MODES.COCKPIT));
  if (btnCamF2) btnCamF2.addEventListener('click', () => setCameraMode(CAMERA_MODES.CHASE));

  function hideAllModals() {
    mainMenuModal.classList.add('hidden');
    routesModal.classList.add('hidden');
    hangarModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    flightCompletedModal.classList.add('hidden');
    flightFailedModal.classList.add('hidden');
  }

  function openMainMenu() {
    hideAllModals();
    mainMenuModal.classList.remove('hidden');
    hudOverlay.classList.add('hidden');
  }

  function openRoutesModal() {
    hideAllModals();
    renderRoutesList();
    updateRouteDetailsPanel(selectedRoute);
    routesModal.classList.remove('hidden');
  }

  function renderRoutesList() {
    routesListContainer.innerHTML = '';
    ROUTES_DATABASE.forEach(route => {
      const isUnlocked = route.unlockedByDefault || unlockedRoutes.includes(route.id) || playerCredits >= route.minCreditsToUnlock;
      const isCompleted = completedRoutes.includes(route.id);
      const isSelected = selectedRoute.id === route.id;

      const item = document.createElement('div');
      item.className = `route-card-item ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;

      let statusBadge = '<span class="route-status-tag status-unlocked">Disponível</span>';
      if (isCompleted) statusBadge = '<span class="route-status-tag status-completed">Concluída ★</span>';
      if (!isUnlocked) statusBadge = `<span class="route-status-tag status-locked">🔒 ${route.minCreditsToUnlock} Créditos</span>`;

      item.innerHTML = `
        <div class="route-card-left">
          <span class="route-card-codes">${route.originName} ➔ ${route.destName}</span>
          <span class="route-card-names">${route.originCode} para ${route.destCode}</span>
        </div>
        <div class="route-card-right">
          <span class="route-reward-tag">+${route.rewardCredits} 🪙</span>
          <span class="route-dist-tag">${route.distanceKm} km • ${route.difficulty}</span>
          ${statusBadge}
        </div>
      `;

      item.addEventListener('click', () => {
        if (!isUnlocked) return;
        selectedRoute = route;
        renderRoutesList();
        updateRouteDetailsPanel(route);
      });

      routesListContainer.appendChild(item);
    });
  }

  function updateRouteDetailsPanel(route) {
    document.getElementById('detailFlightCode').textContent = route.code;
    document.getElementById('detailOriginCode').textContent = route.originName;
    document.getElementById('detailDestCode').textContent = route.destName;
    document.getElementById('detailRouteNames').textContent = `${route.originName} → ${route.destName}`;
    document.getElementById('detailDistance').textContent = `${route.distanceKm} km`;
    document.getElementById('detailDuration').textContent = route.durationText;
    document.getElementById('detailAltitude').textContent = `${route.recAltitudeFt.toLocaleString()} ft`;
    document.getElementById('detailFuel').textContent = `${route.estFuelPct}%`;

    const diffEl = document.getElementById('detailDifficulty');
    diffEl.textContent = route.difficulty;
    diffEl.className = `spec-value ${route.difficultyClass}`;

    document.getElementById('detailReward').textContent = `+${route.rewardCredits} Créditos`;
    document.getElementById('detailBriefingText').textContent = route.briefing;

    const isUnlocked = route.unlockedByDefault || unlockedRoutes.includes(route.id) || playerCredits >= route.minCreditsToUnlock;
    btnStartSelectedRoute.disabled = !isUnlocked;
  }

  function startFlight(route) {
    initAudio();
    activeFlightRoute = route;
    flightStartTime = performance.now();
    flightDistanceRemainingKm = route.distanceKm;

    // Atualizar HUD com informações da rota
    hudDestName.textContent = `${route.destName} (${route.destCode})`;
    hudDistanceVal.textContent = route.distanceKm;
    hudRecAlt.textContent = route.recAltitudeFt.toLocaleString();

    hideAllModals();
    hudOverlay.classList.remove('hidden');

    plane.resetOnRunway();
    updateHUDStatus('NA PISTA DE DECOLAGEM - AUMENTE A POTÊNCIA (W)', 'normal');
  }

  function triggerFlightCompleted() {
    stopEngineSound();
    hideAllModals();

    const durationSec = Math.round((performance.now() - flightStartTime) / 1000);
    const mins = Math.floor(durationSec / 60).toString().padStart(2, '0');
    const secs = (durationSec % 60).toString().padStart(2, '0');

    // Recompensas
    playerCredits += activeFlightRoute.rewardCredits;
    if (!completedRoutes.includes(activeFlightRoute.id)) {
      completedRoutes.push(activeFlightRoute.id);
    }

    // Desbloquear próxima rota na sequência se houver
    const currentIndex = ROUTES_DATABASE.findIndex(r => r.id === activeFlightRoute.id);
    let nextRouteName = 'Todas as rotas disponíveis concluídas!';
    if (currentIndex >= 0 && currentIndex < ROUTES_DATABASE.length - 1) {
      const nextRoute = ROUTES_DATABASE[currentIndex + 1];
      if (!unlockedRoutes.includes(nextRoute.id)) {
        unlockedRoutes.push(nextRoute.id);
      }
      nextRouteName = `Nova Rota Desbloqueada: ${nextRoute.originName} ➔ ${nextRoute.destName}!`;
    }

    saveProgress();

    document.getElementById('completedRouteName').textContent = `${activeFlightRoute.originName} → ${activeFlightRoute.destName}`;
    document.getElementById('completedFlightTime').textContent = `${mins}:${secs}`;
    document.getElementById('completedRewardText').textContent = `+${activeFlightRoute.rewardCredits} Créditos`;
    document.getElementById('unlockedRouteName').textContent = nextRouteName;

    flightCompletedModal.classList.remove('hidden');
    hudOverlay.classList.add('hidden');
  }

  function triggerFlightFailed(reason) {
    stopEngineSound();
    plane.hasCrashed = true;
    hideAllModals();

    document.getElementById('failedReasonText').textContent = reason || 'Aeronave perdeu a sustentação ou tocou o solo fora das condições de pouso.';
    flightFailedModal.classList.remove('hidden');
    hudOverlay.classList.add('hidden');
  }

  function resetFlightOnRunway() {
    initAudio();
    plane.resetOnRunway();
    hideAllModals();
    hudOverlay.classList.remove('hidden');
    updateHUDStatus('REINICIADO NA PISTA - PRONTO PARA DECOLAGEM', 'normal');
  }

  // Listeners de Menus
  btnOpenRoutes.addEventListener('click', openRoutesModal);
  btnFreeFlight.addEventListener('click', () => startFlight(ROUTES_DATABASE[0]));
  btnOpenHangar.addEventListener('click', () => { hideAllModals(); hangarModal.classList.remove('hidden'); });
  btnOpenSettings.addEventListener('click', () => { hideAllModals(); settingsModal.classList.remove('hidden'); });
  if (btnHeaderMenu) btnHeaderMenu.addEventListener('click', openMainMenu);
  if (btnPauseMenu) btnPauseMenu.addEventListener('click', openMainMenu);

  btnCloseRoutes.addEventListener('click', openMainMenu);
  btnStartSelectedRoute.addEventListener('click', () => startFlight(selectedRoute));

  btnCloseHangar.addEventListener('click', openMainMenu);
  btnHangarOk.addEventListener('click', openMainMenu);
  btnCloseSettings.addEventListener('click', openMainMenu);
  btnSettingsSave.addEventListener('click', openMainMenu);

  btnCompletedContinue.addEventListener('click', openRoutesModal);
  btnRetryFlight.addEventListener('click', resetFlightOnRunway);
  btnBackToRoutesFailed.addEventListener('click', openRoutesModal);

  // Seletores de Clima
  document.querySelectorAll('.weather-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.weather-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      weatherCondition = btn.dataset.weather;
      world.buildClouds();
    });
  });

  if (btnSoundToggle) {
    btnSoundToggle.addEventListener('click', () => {
      audioEnabled = !audioEnabled;
      btnSoundToggle.textContent = audioEnabled ? 'ATIVADO 🔊' : 'MUTADO 🔇';
      btnSoundToggle.classList.toggle('muted', !audioEnabled);
      if (!audioEnabled) stopEngineSound();
    });
  }

  // ==============================================================
  // 10. LOOP PRINCIPAL DE SIMULAÇÃO 3D (60 FPS)
  // ==============================================================
  let lastTimestamp = performance.now();

  function animate(timestamp) {
    requestAnimationFrame(animate);

    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    // Atualizar Física do Caravaneer 208-TX
    plane.update(dt);

    // Atualizar Câmera (F1 Cockpit / F2 Terceira Pessoa)
    updateCamera(dt);

    // Mover Cenário e Veículos
    world.update(dt);

    // Mover Nuvens suavemente
    for (const c of world.clouds) {
      c.position.x += 1.5 * dt;
      if (c.position.x > 2500) c.position.x = -2500;
    }

    // Atualizar Instrumentos do HUD
    updateHUD();

    // Renderizar
    renderer.render(scene, camera);
  }

  // Iniciar loop
  animate(performance.now());
})();
