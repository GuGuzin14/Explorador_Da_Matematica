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
			op: ['+', '-'],
			questionCount: 8,
			gen() {
				const op = pick(this.op);
				let a = randInt(1, 90);
				let b = randInt(1, 90);
				if (op === '-') {
					if (b > a) [a, b] = [b, a];
				}
				const answer = op === '+' ? a + b : a - b;
				return { text: `${a} ${op} ${b} = ?`, answer };
			},
		},
		marte: {
			name: 'Marte',
			icon: '🔴',
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
			icon: '🪐',
			op: ['÷'],
			questionCount: 8,
			gen() {
				// Gera divisão com resultado inteiro
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
	const state = load() || { unlocked: { terra: true, marte: false, andromeda: false } };
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
				if (currentPlanetKey === 'marte') state.unlocked.andromeda = true;
			save(state);
				endTitle.textContent = 'Parabéns!';
				const isLast = currentPlanetKey === 'andromeda';
				endMessage.textContent = isLast
					? `${planet.icon} ${planet.name} concluído! Você finalizou a missão!`
					: `${planet.icon} ${planet.name} concluído! Planeta seguinte desbloqueado.`;
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

