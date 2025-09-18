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
	let initialFuel = 100; // pode aumentar com upgrade
	let fuelLossPerSec = 5; // por segundo
	let fuelGainOnCorrect = 15; // pode aumentar via upgrade de eficiência de acerto
	const baseFuelLossPerSec = 5;
	let progressPerCorrectMultiplier = 1; // aumenta o avanço na trilha por acerto
	let questionReduction = 0; // reduz número de questões por planeta
	let jackpotChance = 0; // chance de dobrar recompensa ao concluir

	const levelConfigs = {
		1: { add: [1, 50], subA: [20, 99], subB: [1, 50], mul: [2, 9], div: [2, 9], fuelLossMul: 1.0 },
		2: { add: [20, 101], subA: [40, 140], subB: [10, 120], mul: [3, 12], div: [3, 12], fuelLossMul: 1.1 },
		3: { add: [50, 150], subA: [80, 220], subB: [30, 180], mul: [6, 14], div: [6, 14], fuelLossMul: 1.2 },
	};

	const planets = {
		terra: {
			name: 'Terra',
			icon: '🌎',
			op: ['+'],
			questionCount: 8,
			gen(level = 1) {
				const cfg = levelConfigs[level] || levelConfigs[1];
				const a = randInt(cfg.add[0], cfg.add[1]);
				const b = randInt(cfg.add[0], cfg.add[1]);
				return { text: `${a} + ${b} = ?`, answer: a + b };
			},
		},
		marte: {
			name: 'Marte',
			icon: '🔴',
			op: ['-'],
			questionCount: 8,
			gen(level = 1) {
				const cfg = levelConfigs[level] || levelConfigs[1];
				let a = randInt(cfg.subA[0], cfg.subA[1]);
				let b = randInt(cfg.subB[0], cfg.subB[1]);
				if (b > a) [a, b] = [b, a];
				return { text: `${a} - ${b} = ?`, answer: a - b };
			},
		},
		saturno: {
			name: 'Saturno',
			icon: '🪐',
			op: ['×'],
			questionCount: 8,
			gen(level = 1) {
				const cfg = levelConfigs[level] || levelConfigs[1];
				const a = randInt(cfg.mul[0], cfg.mul[1]);
				const b = randInt(cfg.mul[0], cfg.mul[1]);
				return { text: `${a} × ${b} = ?`, answer: a * b };
			},
		},
		andromeda: {
			name: 'Andrômeda',
			icon: '🌌',
			op: ['÷'],
			questionCount: 8,
			gen(level = 1) {
				const cfg = levelConfigs[level] || levelConfigs[1];
				const b = randInt(cfg.div[0], cfg.div[1]);
				const q = randInt(cfg.div[0], cfg.div[1]);
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
	const openShopBtn = $('#openShop');
	const shopModal = $('#shopModal');
	const closeShopBtn = $('#closeShop');
	const shopList = $('#shopList');
	const resAguaEl = $('#resAgua');
	const resAreiaEl = $('#resAreia');
	const resAneisEl = $('#resAneis');
	const resPoeiraEl = $('#resPoeira');

	const menuView = $('#menuView');
	const gameView = $('#gameView');
	const endView = $('#endView');

	const planetButtons = Array.from(document.querySelectorAll('.planet-btn'));
	const levelModal = document.querySelector('#levelModal');
	const levelButtons = document.querySelector('#levelButtons');
	const closeLevelBtn = document.querySelector('#closeLevel');
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
	const state = loaded || { unlocked: { terra: true, marte: false, saturno: false, andromeda: false }, resources: { agua: 0, areia: 0, aneis: 0, poeira: 0 }, upgrades: {}, levels: { terra: [false, false, false], marte: [false, false, false], saturno: [false, false, false], andromeda: [false, false, false] } };
	if (!state.unlocked) state.unlocked = { terra: true, marte: false, saturno: false, andromeda: false };
	if (state.unlocked && state.unlocked.andromeda === undefined) state.unlocked.andromeda = false;
	if (state.unlocked && state.unlocked.saturno === undefined) state.unlocked.saturno = false;
	if (!state.resources) state.resources = { agua: 0, areia: 0, aneis: 0, poeira: 0 };
	if (!state.upgrades) state.upgrades = {};
	if (!state.levels) state.levels = { terra: [false, false, false], marte: [false, false, false], saturno: [false, false, false], andromeda: [false, false, false] };
	save(state);

	// Upgrades e Loja
	// Estrutura: cada upgrade tem maxLevel, baseCost (por recurso), scale, apply(level)
	const upgradesDef = {
		fuelCapacity: {
			id: 'fuelCapacity',
			name: 'Tanque Expansível',
			desc: 'Aumenta o combustível máximo em +20 por nível.',
			icon: '🛢️',
			maxLevel: 5,
			baseCost: { agua: 4 },
			scale: 1.6,
			apply(level) {
				initialFuel = 100 + 20 * level;
				if (fuel > initialFuel) fuel = initialFuel;
				updateFuelHUD();
			},
		},
		fuelEfficiency: {
			id: 'fuelEfficiency',
			name: 'Reator Otimizado',
			desc: 'Acertos rendem +3 de combustível por nível.',
			icon: '⚙️',
			maxLevel: 5,
			baseCost: { areia: 4 },
			scale: 1.6,
			apply(level) {
				fuelGainOnCorrect = 15 + 3 * level;
			},
		},
		resourceBonus: {
			id: 'resourceBonus',
			name: 'Coletor Avançado',
			desc: 'Ganha +1 recurso de recompensa por nível.',
			icon: '📦',
			maxLevel: 5,
			baseCost: { aneis: 3 },
			scale: 1.7,
			apply(level) {
				// aplicado ao gerar recompensa no fim do planeta
			},
		},
		// Novos upgrades (substituindo a conversão de poeira)
		timeDilation: {
			id: 'timeDilation',
			name: 'Cristal de Estase',
			desc: 'Reduz o consumo por segundo em ~8% por nível (mín. 40%).',
			icon: '⏳',
			maxLevel: 5,
			baseCost: { poeira: 4 },
			scale: 1.7,
			apply(level) {
				const mult = Math.max(0.4, 1 - 0.08 * level);
				fuelLossPerSec = baseFuelLossPerSec * mult;
			},
		},
		astroNavigation: {
			id: 'astroNavigation',
			name: 'Navegação Autônoma',
			desc: 'Reduz 1 questão por planeta por nível.',
			icon: '🧭',
			maxLevel: 2,
			baseCost: { areia: 6 },
			scale: 1.5,
			apply(level) {
				questionReduction = level;
			},
		},
		starJackpot: {
			id: 'starJackpot',
			name: 'Sorte Estelar',
			desc: 'Até +8% de chance por nível de dobrar a recompensa do planeta.',
			icon: '🌠',
			maxLevel: 4,
			baseCost: { poeira: 5 },
			scale: 1.7,
			apply(level) {
				jackpotChance = 0.08 * level;
			},
		},
	};

	function getUpgradeLevel(id) { return state.upgrades[id] || 0; }
	function setUpgradeLevel(id, lvl) { state.upgrades[id] = lvl; save(state); }
	function computeCost(baseCost, scale, level) {
		// custo do próximo nível (level atual -> comprar level+1)
		const next = {};
		for (const k in baseCost) {
			const v = Math.ceil(baseCost[k] * Math.pow(scale, level));
			next[k] = v;
		}
		return next;
	}

	function hasResources(cost) {
		for (const k in cost) if ((state.resources[k] || 0) < cost[k]) return false;
		return true;
	}
	function spendResources(cost) {
		for (const k in cost) state.resources[k] = (state.resources[k] || 0) - cost[k];
		save(state); updateProgressHUD();
	}

	function applyAllUpgrades() {
		for (const id in upgradesDef) {
			const lvl = getUpgradeLevel(id);
			upgradesDef[id].apply(lvl);
		}
	}

	function renderShop() {
		if (!shopList) return;
		shopList.innerHTML = '';
		const frag = document.createDocumentFragment();
		for (const id in upgradesDef) {
			const def = upgradesDef[id];
			const lvl = getUpgradeLevel(id);
			const card = document.createElement('div');
			card.className = 'upgrade-card';
			const title = document.createElement('div');
			title.className = 'upgrade-title';
			title.textContent = `${def.icon} ${def.name}`;
			const desc = document.createElement('div');
			desc.className = 'upgrade-desc';
			desc.textContent = def.desc;
			const meta = document.createElement('div');
			meta.className = 'upgrade-meta';
			const levelEl = document.createElement('span');
			levelEl.className = 'upgrade-level';
			levelEl.textContent = `Nível: ${lvl}/${def.maxLevel}`;
			meta.appendChild(levelEl);
			const actions = document.createElement('div');
			actions.className = 'upgrade-actions';

			if (lvl < def.maxLevel) {
				const cost = computeCost(def.baseCost, def.scale, lvl);
				const costsWrap = document.createElement('div');
				for (const k in cost) {
					const pill = document.createElement('span');
					pill.className = 'cost-pill';
					const label = ({ agua: '💧', areia: '🏜️', aneis: '🪐', poeira: '✨' })[k] || k;
					pill.textContent = `${label} ${cost[k]}`;
					costsWrap.appendChild(pill);
				}
				const btn = document.createElement('button');
				btn.className = 'btn-buy';
				btn.textContent = 'Comprar';
				btn.disabled = !hasResources(cost);
				btn.addEventListener('click', () => {
					if (!hasResources(cost)) return;
					spendResources(cost);
					setUpgradeLevel(id, lvl + 1);
					upgradesDef[id].apply(lvl + 1);
					renderShop();
				});
				actions.appendChild(costsWrap);
				actions.appendChild(btn);
			} else {
				const done = document.createElement('span');
				done.className = 'muted';
				done.textContent = 'Máximo alcançado';
				actions.appendChild(done);
			}

			// ações extras: n/a

			card.appendChild(title);
			card.appendChild(desc);
			card.appendChild(meta);
			card.appendChild(actions);
			frag.appendChild(card);
		}
		shopList.appendChild(frag);
	}

	function openShop() {
		if (!shopModal) return;
		shopModal.setAttribute('aria-hidden', 'false');
		renderShop();
	}
	function closeShop() { if (shopModal) shopModal.setAttribute('aria-hidden', 'true'); }

	// Jogo em andamento
	let currentPlanetKey = null;
	let currentLevel = 1;
	let currentQuestionIndex = 0;
	let totalQuestions = 0;
	let fuel = initialFuel;
	let timerId = null;
	let running = false;
	let levelFuelLossMultiplier = 1;
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
		planetName.textContent = planet ? `${planet.icon} ${planet.name}` : '';
		// progressEl.textContent = `${currentQuestionIndex}/${totalQuestions}`;
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
			const loss = fuelLossPerSec * levelFuelLossMultiplier * dt;
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
		// planetName.textContent = '—';
		progressEl.textContent = '';
		feedback.textContent = '';
		refreshMenuLocks();
		updateProgressHUD();
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
			// Recompensa base 3–6 escala com o nível (1: x1.0, 2: x1.4, 3: x1.8)
			let reward = Math.round(randInt(3, 6) * (1 + (currentLevel - 1) * 0.4));
			reward += getUpgradeLevel('resourceBonus');
			let jackpotHit = false;
			if (Math.random() < jackpotChance) { reward *= 2; jackpotHit = true; }
			let resKey = null, resName = '';
			if (currentPlanetKey === 'terra') { resKey = 'agua'; resName = 'Água'; }
			if (currentPlanetKey === 'marte') { resKey = 'areia'; resName = 'Areia Vermelha'; }
			if (currentPlanetKey === 'saturno') { resKey = 'aneis'; resName = 'Anéis'; }
			if (currentPlanetKey === 'andromeda') { resKey = 'poeira'; resName = 'Poeira Estelar'; }
			if (resKey) state.resources[resKey] = (state.resources[resKey] || 0) + reward;
			// Marcar nível concluído
			const lvls = state.levels[currentPlanetKey] || [false, false, false];
			lvls[currentLevel - 1] = true;
			state.levels[currentPlanetKey] = lvls;
			// Se os 3 níveis concluídos, desbloquear próximo planeta
			if (lvls.every(Boolean)) {
				if (currentPlanetKey === 'terra') state.unlocked.marte = true;
				if (currentPlanetKey === 'marte') state.unlocked.saturno = true;
				if (currentPlanetKey === 'saturno') state.unlocked.andromeda = true;
			}
			save(state);
			updateProgressHUD();
			endTitle.textContent = 'Parabéns!';
			const doneCount = (state.levels[currentPlanetKey] || []).filter(Boolean).length;
			const unlockMsg = doneCount >= 3 ? 'Planeta seguinte desbloqueado.' : `Progresso: ${doneCount}/3 níveis concluídos.`;
			endMessage.textContent = `${planet.icon} ${planet.name} Nível ${currentLevel} concluído! +${reward} ${resName}. ${unlockMsg}${jackpotHit ? ' Bônus estelar x2!' : ''}`;
			show(endView);
			return;
		}
		const q = planet.gen(currentLevel);
		questionTitle.textContent = `${planet.icon} ${planet.name}`;
		questionText.textContent = q.text;
		feedback.textContent = '';
		answerInput.value = '';
		answerInput.focus();
		// Guarda a resposta esperada temporariamente no elemento
		questionText.dataset.answer = String(q.answer);
		updateProgressHUD();
	}

	function startPlanet(key, level = 1) {
		currentPlanetKey = key;
		currentLevel = clamp(level, 1, 3);
		currentQuestionIndex = 0;
		// aplica redução de questões com mínimo 4
		const baseQ = planets[key].questionCount;
		totalQuestions = clamp(baseQ - questionReduction, 4, baseQ);
		levelFuelLossMultiplier = (levelConfigs[currentLevel] || levelConfigs[1]).fuelLossMul || 1;
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
	// Função para gerar estrelas de dificuldade
	function generateStars(level) {
		const stars = [];
		for (let i = 1; i <= level; i++) {
			stars.push(`<span class="star${i <= level ? '' : ' empty'}">⭐</span>`);
		}
		return stars.join('');
	}

	// Função para calcular progresso da trilha
	function calculateTrackProgress(levels) {
		const completed = levels.filter(Boolean).length;
		return Math.round((completed / levels.length) * 100);
	}

	// Função para obter informações do planeta
	function getPlanetInfo(key) {
		const planetData = {
			terra: {
				name: 'Terra - Operações Básicas',
				desc: 'Domine a adição para desbloquear novos mundos!',
				levels: [
					{ title: 'Explorador', desc: 'Números pequenos para começar a jornada' },
					{ title: 'Navegador', desc: 'Números maiores, mais desafios!' },
					{ title: 'Comandante', desc: 'Para os mais corajosos do universo!' }
				]
			},
			marte: {
				name: 'Marte - Território Hostil',
				desc: 'Subtração em terreno árido e desafiador',
				levels: [
					{ title: 'Escoteiro', desc: 'Primeiros passos no planeta vermelho' },
					{ title: 'Soldado', desc: 'Batalhas mais intensas' },
					{ title: 'General', desc: 'Domine as tempestades de areia!' }
				]
			},
			saturno: {
				name: 'Saturno - Reino dos Anéis',
				desc: 'Multiplicação entre os misteriosos anéis',
				levels: [
					{ title: 'Observador', desc: 'Desvende os segredos dos anéis' },
					{ title: 'Cientista', desc: 'Calcule as órbitas complexas' },
					{ title: 'Mestre', desc: 'Controle o poder dos anéis!' }
				]
			},
			andromeda: {
				name: 'Andrômeda - Galáxia Distante',
				desc: 'Divisão nas profundezas do cosmos',
				levels: [
					{ title: 'Viajante', desc: 'Primeiros saltos intergalácticos' },
					{ title: 'Pioneiro', desc: 'Explorando novos sistemas' },
					{ title: 'Lenda', desc: 'Mestre das dimensões infinitas!' }
				]
			}
		};
		return planetData[key] || planetData.terra;
	}

	window.selectLevel = function(planetKey, level) {
		if (levelModal) levelModal.setAttribute('aria-hidden', 'true');
		startPlanet(planetKey, level);
	}
	// Função para renderizar o modal de níveis com trilha

	function renderLevelModal(planetKey) {
		if (!levelModal || !levelButtons) return;

		const planet = planets[planetKey];
		const planetInfo = getPlanetInfo(planetKey);
		const levels = state.levels[planetKey] || [false, false, false];
		const progressPercent = calculateTrackProgress(levels);
		const completedCount = levels.filter(Boolean).length;

		// Determinar próximo planeta para mensagem de desbloqueio
		const nextPlanet = {
			terra: 'Marte',
			marte: 'Saturno',
			saturno: 'Andrômeda',
			andromeda: null
		}[planetKey];

		levelButtons.innerHTML = `
		<!-- Informações do planeta -->
		<div class="planet-info">
			<div class="planet-icon">${planet.icon}</div>
			<div class="planet-details">
				<h3>${planetInfo.name}</h3>
				<p>${planetInfo.desc}</p>
			</div>
		</div>

		<!-- Trilha de níveis -->
		<div class="track-line"></div>
		<div class="track-progress" style="width: ${progressPercent}%;"></div>
		<div class="level-track">
			
			<div class="levels-container">
				${planetInfo.levels.map((levelInfo, index) => {
			const levelNum = index + 1;
			const isCompleted = levels[index];
			const isAvailable = index === 0 || levels[index - 1]; // Primeiro nível sempre disponível, demais dependem do anterior

			let stateClass = 'locked';
			if (isCompleted) stateClass = 'completed';
			else if (isAvailable) stateClass = 'available';

			return `
						<div class="level-station ${stateClass}" ${isAvailable ? `onclick="selectLevel('${planetKey}', ${levelNum})"` : ''}>
							<div class="station-node">
								<span class="level-number">${levelNum}</span>
							</div>
							<div class="station-info">
								<div class="level-title">${levelInfo.title}</div>
								<div class="level-description">${levelInfo.desc}</div>
								<div class="difficulty-stars">
									${generateStars(levelNum)}
								</div>
							</div>
						</div>
					`;
		}).join('')}
			</div>
		</div>

		<!-- Informações de conclusão -->
		<div class="completion-info">
			<span class="progress-text">Progresso: ${completedCount}/3 níveis concluídos</span><br>
			${nextPlanet ? `Complete pelo menos 1 nível para desbloquear ${nextPlanet}!` : 'Parabéns! Você conquistou toda a galáxia!'}
		</div>
	`;
	}

	// Função para selecionar nível (chamada pelo onclick)	

	// Atualizar o evento de clique dos botões de planeta
	planetButtons.forEach((btn) => {
		btn.addEventListener('click', () => {
			const key = btn.getAttribute('data-planet');
			if (!state.unlocked[key]) return;

			if (!levelModal) {
				startPlanet(key);
				return;
			}

			// Renderizar modal com trilha
			renderLevelModal(key);
			levelModal.setAttribute('aria-hidden', 'false');
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
			feedback.textContent = `Correto! +${fuelGainOnCorrect} combustível`;
			feedback.className = 'feedback ok';
			fuel = clamp(fuel + fuelGainOnCorrect, 0, initialFuel);
			// Avança nave: distribuir 100% pelas questões do planeta
			const step = (100 / totalQuestions) * progressPerCorrectMultiplier;
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
			// setPathProgress(pathProgress - 5);
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

	// Eventos da Loja
	if (openShopBtn) openShopBtn.addEventListener('click', openShop);
	if (closeShopBtn) closeShopBtn.addEventListener('click', closeShop);
	if (shopModal) shopModal.addEventListener('click', (e) => { if (e.target === shopModal) closeShop(); });
	// Eventos modal de níveis
	if (closeLevelBtn) closeLevelBtn.addEventListener('click', () => levelModal && levelModal.setAttribute('aria-hidden', 'true'));
	if (levelModal) levelModal.addEventListener('click', (e) => { if (e.target === levelModal) levelModal.setAttribute('aria-hidden', 'true'); });

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
		const g = ctx.createRadialGradient(W * 0.2, H * 0.8, 20, W * 0.2, H * 0.8, 260);
		g.addColorStop(0, 'rgba(60, 90, 180, 0.08)');
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc(W * 0.2, H * 0.8, 260, 0, Math.PI * 2); ctx.fill();

		drawShip(t);
		requestAnimationFrame(animateBg);
	}
	requestAnimationFrame(animateBg);

	// Inicialização
	updateFuelHUD();
	refreshMenuLocks();
	applyAllUpgrades();
	updateProgressHUD();
	show(menuView);
})();