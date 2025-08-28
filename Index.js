// Explorador da Matemática — Lado do cliente puro JS
// Regras chave:
// - Planetas: Terra (adição/subtração), Marte (multiplicação), Andrômeda (divisão)
// - Combustível: começa em 100, perde 5 por segundo, acerto +15 (cap 100)
// - Desbloqueio: Marte após concluir Terra; Andrômeda após concluir Marte
// - Persistência leve: progresso no localStorage

(function () {
	'use strict';

	// Utilidades
	const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
	const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
	const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

	// Estado
	const initialFuel = 100;
	const fuelLossPerSec = 5; // por segundo
	const fuelGainOnCorrect = 15;

		const planets = {
			terra: {
				name: 'Terra',
				icon: '🌎',
				op: ['+'],
				questionCount: 8,
				gen() {
					const a = randInt(1, 90);
					const b = randInt(1, 90);
					return { text: `${a} + ${b} = ?`, answer: a + b };
				},
			},
			marte: {
				name: 'Marte',
				icon: '🔴',
				op: ['-'],
				questionCount: 8,
				gen() {
					let a = randInt(10, 99);
					let b = randInt(1, 90);
					if (b > a) [a, b] = [b, a];
					return { text: `${a} - ${b} = ?`, answer: a - b };
				},
			},
			saturno: {
				name: 'Saturno',
				icon: '🪐',
				op: ['×'],
				questionCount: 8,
				gen() {
					const a = randInt(2, 12);
					const b = randInt(2, 12);
					return { text: `${a} × ${b} = ?`, answer: a * b };
				},
			},
			andromeda: {
				name: 'Andrômeda',
				icon: '🌌',
				op: ['÷'],
				questionCount: 8,
				gen() {
					const b = randInt(2, 12);
					const q = randInt(2, 12);
					const a = b * q; // a ÷ b = q
					return { text: `${a} ÷ ${b} = ?`, answer: q };
				},
			},
		};

	// Elementos
	const $ = (sel) => document.querySelector(sel);
	const bg = $('#bg');
	const fuelFill = $('#fuelFill');
	const fuelValue = $('#fuelValue');
	const planetName = $('#planetName');
	const progressEl = $('#progress');
		const resAguaEl = $('#resAgua');
		const resAreiaEl = $('#resAreia');
		const resAneisEl = $('#resAneis');
		const resPoeiraEl = $('#resPoeira');

	const menuView = $('#menuView');
	const gameView = $('#gameView');
	const endView = $('#endView');

	const planetButtons = Array.from(document.querySelectorAll('.planet-btn'));
	const questionTitle = $('#questionTitle');
	const questionText = $('#questionText');
	const answerForm = $('#answerForm');
	const answerInput = $('#answerInput');
	const feedback = $('#feedback');
	const giveUpBtn = $('#giveUp');
		const pathFill = $('#pathFill');
		const pathShip = $('#pathShip');

	const backToMenu = $('#backToMenu');
	const retryPlanet = $('#retryPlanet');
	const endTitle = $('#endTitle');
	const endMessage = $('#endMessage');

	// Persistência simples
	const save = (data) => localStorage.setItem('exploradorMath', JSON.stringify(data));
	const load = () => {
		try {
			const raw = localStorage.getItem('exploradorMath');
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	};
		// Migração simples para novo fluxo com Saturno
			const loaded = load();
			const state = loaded || { unlocked: { terra: true, marte: false, saturno: false, andromeda: false }, resources: { agua: 0, areia: 0, aneis: 0, poeira: 0 } };
		if (!state.unlocked) state.unlocked = { terra: true, marte: false, saturno: false, andromeda: false };
		if (state.unlocked && state.unlocked.andromeda === undefined) state.unlocked.andromeda = false;
		if (state.unlocked && state.unlocked.saturno === undefined) state.unlocked.saturno = false;
			if (!state.resources) state.resources = { agua: 0, areia: 0, aneis: 0, poeira: 0 };
	save(state);

	// Jogo em andamento
	let currentPlanetKey = null;
	let currentQuestionIndex = 0;
	let totalQuestions = 0;
	let fuel = initialFuel;
	let timerId = null;
	let running = false;
		let pathProgress = 0; // 0..100

		// Progresso visual da nave
		function setPathProgress(p) {
			pathProgress = clamp(Math.round(p), 0, 100);
			if (pathFill) pathFill.style.width = pathProgress + '%';
			if (pathShip) pathShip.style.left = pathProgress + '%';
		}

	// HUD
	function updateFuelHUD() {
		fuel = clamp(fuel, 0, initialFuel);
		const pct = Math.round((fuel / initialFuel) * 100);
		fuelFill.style.width = pct + '%';
		fuelValue.textContent = `${Math.round(fuel)} / ${initialFuel}`;
		fuelFill.style.background = pct < 20
			? `linear-gradient(90deg, #ff2f2f, #ff7777)`
			: `linear-gradient(90deg, #ff9d00, #ffd166)`;
	}

	function updateProgressHUD() {
		const planet = currentPlanetKey ? planets[currentPlanetKey] : null;
		planetName.textContent = planet ? `${planet.icon} ${planet.name}` : '—';
		progressEl.textContent = `${currentQuestionIndex}/${totalQuestions}`;
		// Recursos
		if (resAguaEl) resAguaEl.textContent = String(state.resources.agua);
		if (resAreiaEl) resAreiaEl.textContent = String(state.resources.areia);
		if (resAneisEl) resAneisEl.textContent = String(state.resources.aneis);
		if (resPoeiraEl) resPoeiraEl.textContent = String(state.resources.poeira);
	}

	// Timer de combustível
	function startFuelTimer() {
		stopFuelTimer();
		running = true;
		let last = performance.now();
		function tick(now) {
			if (!running) return;
			const dt = (now - last) / 1000;
			last = now;
			const loss = fuelLossPerSec * dt;
			// usar frações para suavidade; exibir inteiro
			fuel = Math.max(0, fuel - loss);
			updateFuelHUD();
			if (fuel <= 0.5) {
				fuel = 0;
				updateFuelHUD();
				gameOver(false, 'Sem combustível!');
				return;
			}
			timerId = requestAnimationFrame(tick);
		}
		timerId = requestAnimationFrame(tick);
	}

	function stopFuelTimer() {
		running = false;
		if (timerId) cancelAnimationFrame(timerId);
		timerId = null;
	}

	// Fluxo de telas
	function show(view) {
		for (const v of [menuView, gameView, endView]) v.classList.remove('active');
		view.classList.add('active');
	}

	function refreshMenuLocks() {
		planetButtons.forEach((btn) => {
			const key = btn.getAttribute('data-planet');
			const locked = !state.unlocked[key];
			const lockEl = btn.querySelector('.lock');
			btn.disabled = locked;
			if (locked) {
				if (lockEl) lockEl.textContent = '🔒';
			} else {
				if (lockEl) lockEl.textContent = '';
			}
		});
	}

	function toMenu() {
		stopFuelTimer();
		show(menuView);
		currentPlanetKey = null;
		planetName.textContent = '—';
		progressEl.textContent = '0/0';
		feedback.textContent = '';
		refreshMenuLocks();
	}

	// Perguntas
	function nextQuestion() {
		const planet = planets[currentPlanetKey];
		if (!planet) return;
				if (currentQuestionIndex >= totalQuestions) {
			// Concluiu o planeta
			stopFuelTimer();
			// Desbloquear próximo
				if (currentPlanetKey === 'terra') state.unlocked.marte = true;
				if (currentPlanetKey === 'marte') state.unlocked.saturno = true;
				if (currentPlanetKey === 'saturno') state.unlocked.andromeda = true;
					// Recompensa de recursos 3–6 conforme o planeta
					const reward = randInt(3, 6);
					let resKey = null, resName = '';
					if (currentPlanetKey === 'terra') { resKey = 'agua'; resName = 'Água'; }
					if (currentPlanetKey === 'marte') { resKey = 'areia'; resName = 'Areia Vermelha'; }
					if (currentPlanetKey === 'saturno') { resKey = 'aneis'; resName = 'Anéis'; }
					if (currentPlanetKey === 'andromeda') { resKey = 'poeira'; resName = 'Poeira Estelar'; }
					if (resKey) state.resources[resKey] = (state.resources[resKey] || 0) + reward;
					save(state);
					updateProgressHUD();
					endTitle.textContent = 'Parabéns!';
					const isLast = currentPlanetKey === 'andromeda';
					const unlockMsg = isLast ? 'Você finalizou a missão!' : 'Planeta seguinte desbloqueado.';
					endMessage.textContent = `${planet.icon} ${planet.name} concluído! +${reward} ${resName}. ${unlockMsg}`;
			show(endView);
			return;
		}
		const q = planet.gen();
		questionTitle.textContent = `${planet.icon} ${planet.name}`;
		questionText.textContent = q.text;
		feedback.textContent = '';
		answerInput.value = '';
		answerInput.focus();
		// Guarda a resposta esperada temporariamente no elemento
		questionText.dataset.answer = String(q.answer);
		updateProgressHUD();
	}

	function startPlanet(key) {
		currentPlanetKey = key;
		currentQuestionIndex = 0;
		totalQuestions = planets[key].questionCount;
		fuel = initialFuel;
		setPathProgress(0);
		updateFuelHUD();
		updateProgressHUD();
		show(gameView);
		startFuelTimer();
		nextQuestion();
	}

	function gameOver(won, reason) {
		stopFuelTimer();
		endTitle.textContent = won ? 'Parabéns!' : 'Fim de Jogo';
		endMessage.textContent = reason || (won ? 'Você concluiu o desafio!' : 'Tente novamente.');
		show(endView);
	}

	// Eventos
	planetButtons.forEach((btn) => {
		btn.addEventListener('click', () => {
			const key = btn.getAttribute('data-planet');
			if (!state.unlocked[key]) return;
			startPlanet(key);
		});
	});

	answerForm.addEventListener('submit', (e) => {
		e.preventDefault();
		if (!currentPlanetKey) return;
		const expected = Number(questionText.dataset.answer);
		const val = Number(answerInput.value.trim());
		if (Number.isNaN(val)) return;
			if (val === expected) {
			currentQuestionIndex++;
			feedback.textContent = 'Correto! +15 combustível';
			feedback.className = 'feedback ok';
				fuel = clamp(fuel + fuelGainOnCorrect, 0, initialFuel);
				// Avança nave: distribuir 100% pelas questões do planeta
				const step = 100 / totalQuestions;
				setPathProgress(pathProgress + step);
				// Concluir fase se progresso >= 100 (mesmo que por arredondamento antes da última pergunta)
				if (pathProgress >= 100 || currentQuestionIndex >= totalQuestions) {
					currentQuestionIndex = totalQuestions; // força conclusão
					nextQuestion(); // cair no fluxo de conclusão
					return;
				}
			updateFuelHUD();
			nextQuestion();
		} else {
			feedback.textContent = 'Ops, tente novamente!';
			feedback.className = 'feedback err';
				// Penalidade: pequeno recuo na trilha (5%)
				setPathProgress(pathProgress - 5);
				// Sem penalidade extra além do tempo/combustível correndo
			answerInput.select();
		}
	});

	giveUpBtn.addEventListener('click', () => {
		toMenu();
	});

	backToMenu.addEventListener('click', () => {
		toMenu();
	});
	retryPlanet.addEventListener('click', () => {
		if (currentPlanetKey) startPlanet(currentPlanetKey);
		else toMenu();
	});

	// Animação de fundo: estrela + nave simples
	const ctx = bg.getContext('2d');
	let W = 0, H = 0, dpr = Math.max(1, window.devicePixelRatio || 1);
	const stars = [];
	const STAR_COUNT = 180;
		// Planetas de fundo (posições relativas para escalar com a tela)
			const planetsBg = [
				// Azul (frio)
				{
					rx: 0.18, ry: 0.28, r: 60,
					colors: ['#2a4b9e', '#0a1230'], glow: 'rgba(60,100,220,0.25)',
					parallax: 0.12,
					floatAmp: 8, floatSpeed: 0.00035, // bobbing
					pulseAmp: 0.03, pulseSpeed: 0.00055, // pulsar de escala
					moon: { ratio: 0.17, dist: 1.6, speed: 0.00025, color: '#9fb3ff' }
				},
				// Laranja (quente) com anéis
				{
					rx: 0.78, ry: 0.72, r: 80,
					colors: ['#f39c12', '#5a2a08'],
					ring: { color: '#ccb88a', width: 10, tilt: -0.45 },
					glow: 'rgba(255,170,60,0.22)', parallax: 0.08,
					floatAmp: 6, floatSpeed: 0.0003,
					pulseAmp: 0.025, pulseSpeed: 0.0005
				},
				// Roxo (misterioso)
				{
					rx: 0.52, ry: 0.2, r: 46,
					colors: ['#7b2cbf', '#200638'], glow: 'rgba(180,100,255,0.18)', parallax: 0.16,
					floatAmp: 10, floatSpeed: 0.00042,
					pulseAmp: 0.035, pulseSpeed: 0.0006
				},
			];

				// Planeta com imagem (fundo) — com mesma flutuação e pulso
				const imagePlanetCfg = {
					src: 'assets/17ac2c68-efd2-44d1-a0f2-72f5e3367264-removebg-preview.png',
					rx: 0.32, // posição relativa X
					ry: 0.68, // posição relativa Y
					r: 90,    // raio base para escala
					parallax: 0.10,
					floatAmp: 8, floatSpeed: 0.00035,
					pulseAmp: 0.03, pulseSpeed: 0.0005,
					glow: 'rgba(255,255,255,0.12)'
				};
				const imagePlanet = new Image();
				let imagePlanetLoaded = false;
				imagePlanet.onload = () => { imagePlanetLoaded = true; };
				imagePlanet.src = imagePlanetCfg.src;

	function resize() {
		W = bg.clientWidth;
		H = bg.clientHeight;
		bg.width = Math.floor(W * dpr);
		bg.height = Math.floor(H * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	window.addEventListener('resize', resize);
	resize();

	function makeStar() {
		return {
			x: Math.random() * W,
			y: Math.random() * H,
			z: Math.random() * 0.6 + 0.4, // brilho
			s: Math.random() * 1.5 + 0.2, // tamanho
			vx: - (Math.random() * 0.4 + 0.2),
		};
	}
	for (let i = 0; i < STAR_COUNT; i++) stars.push(makeStar());

	function drawShip(t) {
		const x = W * 0.75 + Math.sin(t * 0.0015) * 20;
		const y = H * 0.4 + Math.cos(t * 0.0012) * 16;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(-0.05 + Math.sin(t * 0.002) * 0.02);
		// Corpo
		ctx.fillStyle = '#9bbcff';
		ctx.beginPath();
		ctx.moveTo(-14, 0); ctx.lineTo(10, -8); ctx.lineTo(10, 8); ctx.closePath();
		ctx.fill();
		// Janela
		ctx.fillStyle = '#14223f';
		ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
		// Exaustão
		const flame = 8 + Math.sin(t * 0.02) * 4;
		ctx.fillStyle = '#ffd166aa';
		ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-14 - flame, -3); ctx.lineTo(-14 - flame, 3); ctx.closePath(); ctx.fill();
		ctx.restore();
	}

	function animateBg(t) {
		ctx.clearRect(0, 0, W, H);
				// Planetas de fundo (atrás das estrelas)
			for (let i = 0; i < planetsBg.length; i++) {
				const p = planetsBg[i];
					const driftX = Math.sin(t * 0.00015 + i) * 6 * p.parallax;
					const driftY = Math.cos(t * 0.00012 + i * 0.6) * 4 * p.parallax;
					const bobX = Math.cos(t * (p.floatSpeed || 0.00035) + i) * (p.floatAmp || 6) * 0.6;
					const bobY = Math.sin(t * (p.floatSpeed || 0.00035) + i) * (p.floatAmp || 6);
					const x = p.rx * W + driftX + bobX;
					const y = p.ry * H + driftY + bobY;
					const r = p.r * (1 + (p.pulseAmp || 0) * Math.sin(t * (p.pulseSpeed || 0.0005) + i * 1.3));

				// Halo suave
				if (p.glow) {
					const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.5);
					g.addColorStop(0, p.glow);
					g.addColorStop(1, 'rgba(0,0,0,0)');
					ctx.fillStyle = g;
					ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill();
				}

				// Corpo do planeta
					const ox = Math.cos(t * 0.0004 + i) * r * 0.05;
					const oy = Math.sin(t * 0.0004 + i * 0.7) * r * 0.05;
					const grad = ctx.createRadialGradient(x - r * 0.28 + ox, y - r * 0.28 + oy, r * 0.2, x, y, r);
				grad.addColorStop(0, p.colors[0]);
				grad.addColorStop(1, p.colors[1]);
				ctx.fillStyle = grad;
				ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

				// Iluminação (terminador)
				ctx.save();
				ctx.globalCompositeOperation = 'source-atop';
					const phi = t * 0.0002 + i * 0.7;
					const dx = Math.cos(phi) * r;
					const dy = Math.sin(phi) * r;
					const light = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
				light.addColorStop(0, 'rgba(255,255,255,0.10)');
				light.addColorStop(0.5, 'rgba(0,0,0,0)');
				light.addColorStop(1, 'rgba(0,0,0,0.18)');
				ctx.fillStyle = light;
				ctx.fillRect(x - r, y - r, r * 2, r * 2);
				ctx.restore();

				// Anéis (opcional)
				if (p.ring) {
					ctx.save();
					ctx.translate(x, y);
						ctx.rotate(p.ring.tilt + Math.sin(t * 0.00022 + i) * 0.06);
						ctx.strokeStyle = p.ring.color;
						ctx.globalAlpha = 0.85;
						ctx.lineWidth = p.ring.width + Math.sin(t * 0.001 + i) * 0.6;
					ctx.beginPath();
					ctx.ellipse(0, 0, r * 1.4, r * 0.55, 0, 0, Math.PI * 2);
					ctx.stroke();
					ctx.restore();
				}

					// Lua (opcional)
					if (p.moon) {
						const ang = t * (p.moon.speed || 0.0002) + i * 0.8;
						const md = r * (p.moon.dist || 1.6);
						const mx = x + Math.cos(ang) * md;
						const my = y + Math.sin(ang) * md;
						const mr = Math.max(2, r * (p.moon.ratio || 0.16));
						const mg = ctx.createRadialGradient(mx - mr * 0.2, my - mr * 0.2, mr * 0.2, mx, my, mr);
						mg.addColorStop(0, p.moon.color || '#cfd8ff');
						mg.addColorStop(1, '#222848');
						ctx.fillStyle = mg;
						ctx.globalAlpha = 0.95;
						ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
						ctx.globalAlpha = 1;
					}
			}

						// Planeta de imagem (fundo), com a mesma animação de flutuação
						if (imagePlanetLoaded) {
							const p = imagePlanetCfg;
							const driftX = Math.sin(t * 0.00015 + 9) * 6 * p.parallax;
							const driftY = Math.cos(t * 0.00012 + 9 * 0.6) * 4 * p.parallax;
							const bobX = Math.cos(t * (p.floatSpeed || 0.00035) + 9) * (p.floatAmp || 6) * 0.6;
							const bobY = Math.sin(t * (p.floatSpeed || 0.00035) + 9) * (p.floatAmp || 6);
							const x = p.rx * W + driftX + bobX;
							const y = p.ry * H + driftY + bobY;
							const r = p.r * (1 + (p.pulseAmp || 0) * Math.sin(t * (p.pulseSpeed || 0.0005) + 9 * 1.3));

							// Glow leve atrás da imagem
							if (p.glow) {
								const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.6);
								g.addColorStop(0, p.glow);
								g.addColorStop(1, 'rgba(0,0,0,0)');
								ctx.fillStyle = g;
								ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
							}

							// Desenhar imagem centralizada e mantendo proporção
							const aspect = imagePlanet.height > 0 ? (imagePlanet.height / imagePlanet.width) : 1;
							const w = r * 2;
							const h = w * aspect;
							ctx.drawImage(imagePlanet, x - w / 2, y - h / 2, w, h);
						}

			// Estrelas
		for (const s of stars) {
			s.x += s.vx * s.z;
			if (s.x < -2) { s.x = W + 2; s.y = Math.random() * H; }
			ctx.fillStyle = `rgba(255,255,255,${0.4 + s.z * 0.6})`;
			ctx.fillRect(s.x, s.y, s.s, s.s);
		}
		// Nebulosidade suave
		const g = ctx.createRadialGradient(W*0.2, H*0.8, 20, W*0.2, H*0.8, 260);
		g.addColorStop(0, 'rgba(60, 90, 180, 0.08)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc(W*0.2, H*0.8, 260, 0, Math.PI*2); ctx.fill();

		drawShip(t);
		requestAnimationFrame(animateBg);
	}
	requestAnimationFrame(animateBg);

	// Inicialização
	updateFuelHUD();
	refreshMenuLocks();
	show(menuView);
})();

