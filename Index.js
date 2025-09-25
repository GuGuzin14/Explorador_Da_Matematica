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

	// CORREÇÃO: Definir funções de persistência ANTES de usar
	const save = (data) => localStorage.setItem('exploradorMath', JSON.stringify(data));
	const load = () => {
		try {
			const raw = localStorage.getItem('exploradorMath');
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	};

	// Estado
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

	// CORREÇÃO: Carregar estado e configurar variáveis corretamente
	const loaded = load();
	const state = loaded || {
		unlocked: { terra: true, marte: false, saturno: false, andromeda: false },
		resources: { agua: 0, areia: 0, aneis: 0, poeira: 0 },
		upgrades: {},
		levels: { terra: [false, false, false], marte: [false, false, false], saturno: [false, false, false], andromeda: [false, false, false] },
		// NOVO: persistir combustível
		fuelData: { maxFuel: 100, currentFuel: 100 }
	};

	// Migração e validação do estado
	if (!state.unlocked) state.unlocked = { terra: true, marte: false, saturno: false, andromeda: false };
	if (state.unlocked && state.unlocked.andromeda === undefined) state.unlocked.andromeda = false;
	if (state.unlocked && state.unlocked.saturno === undefined) state.unlocked.saturno = false;
	if (!state.resources) state.resources = { agua: 0, areia: 0, aneis: 0, poeira: 0 };
	if (!state.upgrades) state.upgrades = {};
	if (!state.levels) state.levels = { terra: [false, false, false], marte: [false, false, false], saturno: [false, false, false], andromeda: [false, false, false] };
	// NOVO: migração de dados de combustível
	if (!state.fuelData) state.fuelData = { maxFuel: 100, currentFuel: 100 };

	// CORREÇÃO: Função para salvar combustível
	function saveFuelData() {
		state.fuelData = {
			maxFuel: initialFuel,
			currentFuel: Math.round(fuel)
		};
		save(state);
	}

	// CORREÇÃO: Usar valores salvos para inicializar as variáveis
	let initialFuel = state.fuelData.maxFuel || 100;
	let fuel = state.fuelData.currentFuel || initialFuel;
	let fuelLossPerSec = 5;
	let fuelGainOnCorrect = 15;
	const baseFuelLossPerSec = 5;
	let progressPerCorrectMultiplier = 1;
	let questionReduction = 0;
	let jackpotChance = 0;

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
				const newMax = 100 + 20 * level;
				const wasAtMax = fuel >= initialFuel; // Se estava no máximo
				initialFuel = newMax;

				// Se estava no máximo, atualizar para novo máximo
				if (wasAtMax || fuel > initialFuel) {
					fuel = initialFuel;
				}

				// NOVO: Salvar sempre que aplicar upgrade
				saveFuelData();
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
	function setUpgradeLevel(id, lvl) {
		state.upgrades[id] = lvl;
		save(state);
	}
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
	
		if (fuelFill) {
			fuelFill.style.width = pct + '%';
			
			// CORREÇÃO: Recalcular a cor baseada na porcentagem atual
			if (pct < 20) {
				fuelFill.style.background = `linear-gradient(90deg, #ff2f2f, #ff7777)`;
			} else {
				fuelFill.style.background = `linear-gradient(90deg, #ff9d00, #ffd166)`;
			}
		}
	
		if (fuelValue) {
			fuelValue.textContent = `${Math.round(fuel)} / ${initialFuel}`;
		}
	
		saveFuelData();
	}

	function updateProgressHUD() {
		const planet = currentPlanetKey ? planets[currentPlanetKey] : null;
		if (planetName) planetName.textContent = planet ? `${planet.icon} ${planet.name}` : '';
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
		for (const v of [menuView, gameView, endView]) {
			if (v) v.classList.remove('active');
		}
		if (view) view.classList.add('active');
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
		
		// NOVO: Reabastecer combustível ao voltar ao menu
		fuel = initialFuel;
		saveFuelData();
		updateFuelHUD();
		
		show(menuView);
		currentPlanetKey = null;
		if (progressEl) progressEl.textContent = '';
		if (feedback) feedback.textContent = '';
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
			if (endTitle) endTitle.textContent = 'Parabéns!';
			const doneCount = (state.levels[currentPlanetKey] || []).filter(Boolean).length;
			const unlockMsg = doneCount >= 3 ? 'Planeta seguinte desbloqueado.' : `Progresso: ${doneCount}/3 níveis concluídos.`;
			if (endMessage) endMessage.textContent = `${planet.icon} ${planet.name} Nível ${currentLevel} concluído! +${reward} ${resName}. ${unlockMsg}${jackpotHit ? ' Bônus estelar x2!' : ''}`;
			show(endView);
			return;
		}
		const q = planet.gen(currentLevel);
		if (questionTitle) questionTitle.textContent = `${planet.icon} ${planet.name}`;
		if (questionText) {
			questionText.textContent = q.text;
			// Guarda a resposta esperada temporariamente no elemento
			questionText.dataset.answer = String(q.answer);
		}
		if (feedback) feedback.textContent = '';
		if (answerInput) {
			answerInput.value = '';
			answerInput.focus();
		}
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
		fuel = initialFuel; // Reabastecer ao iniciar
		setPathProgress(0);
		saveFuelData(); // Salvar o reabastecimento
		updateFuelHUD();
		updateProgressHUD();
		show(gameView);
		startFuelTimer();
		nextQuestion();
	}

	function gameOver(won, reason) {
		stopFuelTimer();
		if (endTitle) endTitle.textContent = won ? 'Parabéns!' : 'Fim de Jogo';
		if (endMessage) endMessage.textContent = reason || (won ? 'Você concluiu o desafio!' : 'Tente novamente.');
		show(endView);
	}

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

	// Função global para selecionar nível
	window.selectLevel = function (planetKey, level) {
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

		const progressPercentBar = progressPercent !== 100
			? `width: ${progressPercent}%`
			: '';

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
		<div class="track-progress" style="${progressPercentBar}"></div>
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

	// Event Listeners
	if (answerForm) {
		answerForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!currentPlanetKey) return;
			const expected = Number(questionText.dataset.answer);
			const val = Number(answerInput.value.trim());
			if (Number.isNaN(val)) return;
			if (val === expected) {
				currentQuestionIndex++;
				if (feedback) {
					feedback.textContent = `Correto! +${fuelGainOnCorrect} combustível`;
					feedback.className = 'feedback ok';
				}
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
				if (feedback) {
					feedback.textContent = 'Ops, tente novamente!';
					feedback.className = 'feedback err';
				}
				// Sem penalidade extra além do tempo/combustível correndo
				if (answerInput) answerInput.select();
			}
		});
	}

	if (giveUpBtn) giveUpBtn.addEventListener('click', () => toMenu());
	if (backToMenu) {
		backToMenu.addEventListener('click', () => {
			fuel = initialFuel;
			saveFuelData();
			updateFuelHUD();
			toMenu();
		});
	}
	if (retryPlanet) {
		retryPlanet.addEventListener('click', () => {
			if (currentPlanetKey) startPlanet(currentPlanetKey, currentLevel);
			else toMenu();
		});
	}

	// Eventos da Loja
	if (openShopBtn) openShopBtn.addEventListener('click', openShop);
	if (closeShopBtn) closeShopBtn.addEventListener('click', closeShop);
	if (shopModal) shopModal.addEventListener('click', (e) => { if (e.target === shopModal) closeShop(); });

	// Eventos modal de níveis
	if (closeLevelBtn) closeLevelBtn.addEventListener('click', () => levelModal && levelModal.setAttribute('aria-hidden', 'true'));
	if (levelModal) levelModal.addEventListener('click', (e) => { if (e.target === levelModal) levelModal.setAttribute('aria-hidden', 'true'); });

	// Animação de fundo: estrela + nave simples
	if (bg && bg.getContext) {
		const ctx = bg.getContext('2d');
		let W = 0, H = 0, dpr = Math.max(1, window.devicePixelRatio || 1);
		const stars = [];
		const STAR_COUNT = 180;

		// Planetas de fundo (posições relativas para escalar com a tela)
		
// Planetas de fundo mais realistas (substitui a configuração existente)

// Configuração corrigida dos planetas de fundo
const planetsBg = [
	// Planeta azul estilo Terra (SEM as bolas pretas)
	{
		rx: 0.18, ry: 0.28, r: 60,
		colors: ['#4a90e2', '#1e3a8a', '#0f172a'], 
		glow: 'rgba(74, 144, 226, 0.3)',
		parallax: 0.12,
		floatAmp: 8, floatSpeed: 0.00035,
		pulseAmp: 0.03, pulseSpeed: 0.00055,
		// Atmosfera
		atmosphere: { color: 'rgba(74, 144, 226, 0.15)', thickness: 1.2 },
		// Lua realística
		moon: { 
			ratio: 0.17, 
			dist: 1.6, 
			speed: 0.00025, 
			colors: ['#e5e7eb', '#9ca3af', '#6b7280'],
			craters: false // Removido as crateras que causavam as bolas pretas
		},
		// REMOVIDO: surface (continentes) que causava as bolas pretas
	},
	// Planeta laranja estilo Saturno (SEM quadrado ao redor)
	{
		rx: 0.78, ry: 0.72, r: 80,
		colors: ['#f59e0b', '#d97706', '#92400e', '#451a03'],
		// Anéis corrigidos - sem múltiplos anéis que causavam o quadrado
		ring: { 
			color: '#e5e7eb', 
			width: 8, 
			tilt: -0.45,
			opacity: 0.7
		},
		glow: 'rgba(245, 158, 11, 0.25)', 
		parallax: 0.08,
		floatAmp: 6, floatSpeed: 0.0003,
		pulseAmp: 0.025, pulseSpeed: 0.0005,
		atmosphere: { color: 'rgba(245, 158, 11, 0.1)', thickness: 1.15 }
	},
	// Planeta roxo misterioso (mantido)
	{
		rx: 0.52, ry: 0.2, r: 46,
		colors: ['#a855f7', '#7c2d12', '#581c87', '#1e1b4b'], 
		glow: 'rgba(168, 85, 247, 0.2)', 
		parallax: 0.16,
		floatAmp: 10, floatSpeed: 0.00042,
		pulseAmp: 0.035, pulseSpeed: 0.0006,
		atmosphere: { color: 'rgba(168, 85, 247, 0.12)', thickness: 1.1 }
	}
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
			const scale = 1 + Math.sin(t * 0.003) * 0.05; // Respiração sutil
			
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(-0.05 + Math.sin(t * 0.002) * 0.02);
			ctx.scale(scale, scale);
			
			// Sombra da nave
			ctx.save();
			ctx.translate(2, 2);
			ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
			ctx.beginPath();
			ctx.moveTo(-16, 0);
			ctx.lineTo(12, -10);
			ctx.lineTo(12, 10);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
			
			// Corpo principal da nave (gradiente mais realístico)
			const bodyGrad = ctx.createLinearGradient(-16, -10, 12, 10);
			bodyGrad.addColorStop(0, '#9bbcff');
			bodyGrad.addColorStop(0.3, '#7c9cff');
			bodyGrad.addColorStop(0.7, '#5a7cff');
			bodyGrad.addColorStop(1, '#3b5ccc');
			
			ctx.fillStyle = bodyGrad;
			ctx.beginPath();
			ctx.moveTo(-16, 0);
			ctx.quadraticCurveTo(-8, -12, 4, -10);
			ctx.lineTo(12, -8);
			ctx.lineTo(12, 8);
			ctx.quadraticCurveTo(4, 10, -8, 12);
			ctx.closePath();
			ctx.fill();
			
			// Detalhes metálicos
			ctx.strokeStyle = '#b8d4ff';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(-12, -6);
			ctx.lineTo(8, -6);
			ctx.moveTo(-12, 6);
			ctx.lineTo(8, 6);
			ctx.stroke();
			
			// Janela da cabine com reflexo
			const windowGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, 6);
			windowGrad.addColorStop(0, '#64748b');
			windowGrad.addColorStop(0.6, '#1e293b');
			windowGrad.addColorStop(1, '#0f172a');
			
			ctx.fillStyle = windowGrad;
			ctx.beginPath();
			ctx.arc(0, 0, 6, 0, Math.PI * 2);
			ctx.fill();
			
			// Reflexo na janela
			ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
			ctx.beginPath();
			ctx.arc(-2, -2, 2, 0, Math.PI * 2);
			ctx.fill();
			
			// Asas laterais
			ctx.fillStyle = '#6b7cff';
			ctx.beginPath();
			ctx.moveTo(-6, -8);
			ctx.lineTo(-2, -16);
			ctx.lineTo(2, -12);
			ctx.lineTo(-2, -8);
			ctx.closePath();
			ctx.fill();
			
			ctx.beginPath();
			ctx.moveTo(-6, 8);
			ctx.lineTo(-2, 16);
			ctx.lineTo(2, 12);
			ctx.lineTo(-2, 8);
			ctx.closePath();
			ctx.fill();
			
			// Propulsores múltiplos com chamas realísticas
			const flame1 = 12 + Math.sin(t * 0.02) * 6;
			const flame2 = 10 + Math.sin(t * 0.025 + 1) * 4;
			const flame3 = 8 + Math.sin(t * 0.03 + 2) * 3;
			
			// Chama principal (azul-branca)
			const flameGrad = ctx.createLinearGradient(-16, 0, -16 - flame1, 0);
			flameGrad.addColorStop(0, '#fbbf24');
			flameGrad.addColorStop(0.3, '#f59e0b');
			flameGrad.addColorStop(0.7, '#3b82f6');
			flameGrad.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
			
			ctx.fillStyle = flameGrad;
			ctx.beginPath();
			ctx.moveTo(-16, 0);
			ctx.lineTo(-16 - flame1, -4);
			ctx.lineTo(-16 - flame1 * 0.8, 0);
			ctx.lineTo(-16 - flame1, 4);
			ctx.closePath();
			ctx.fill();
			
			// Propulsores laterais menores
			ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
			ctx.beginPath();
			ctx.moveTo(-8, -6);
			ctx.lineTo(-8 - flame2, -8);
			ctx.lineTo(-8 - flame2 * 0.7, -6);
			ctx.closePath();
			ctx.fill();
			
			ctx.beginPath();
			ctx.moveTo(-8, 6);
			ctx.lineTo(-8 - flame3, 8);
			ctx.lineTo(-8 - flame3 * 0.7, 6);
			ctx.closePath();
			ctx.fill();
			
			// Luzes de navegação piscando
			const blinkRate = Math.sin(t * 0.008) > 0 ? 1 : 0.3;
			ctx.fillStyle = `rgba(34, 197, 94, ${blinkRate})`;
			ctx.beginPath();
			ctx.arc(8, -6, 1.5, 0, Math.PI * 2);
			ctx.fill();
			
			ctx.fillStyle = `rgba(239, 68, 68, ${1 - blinkRate + 0.3})`;
			ctx.beginPath();
			ctx.arc(8, 6, 1.5, 0, Math.PI * 2);
			ctx.fill();
			
			ctx.restore();
		}

		function drawDetailedPlanet(p, x, y, r, t, index) {
			// Atmosfera
			if (p.atmosphere) {
				const atmosGrad = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * p.atmosphere.thickness);
				atmosGrad.addColorStop(0, 'rgba(0,0,0,0)');
				atmosGrad.addColorStop(0.8, p.atmosphere.color);
				atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.fillStyle = atmosGrad;
				ctx.beginPath();
				ctx.arc(x, y, r * p.atmosphere.thickness, 0, Math.PI * 2);
				ctx.fill();
			}
		
			// Halo suave
			if (p.glow) {
				const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.5);
				g.addColorStop(0, p.glow);
				g.addColorStop(1, 'rgba(0,0,0,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
				ctx.fill();
			}
		
			// Corpo do planeta com gradiente suave
			const ox = Math.cos(t * 0.0004 + index) * r * 0.05;
			const oy = Math.sin(t * 0.0004 + index * 0.7) * r * 0.05;
			
			const grad = ctx.createRadialGradient(x - r * 0.3 + ox, y - r * 0.3 + oy, r * 0.1, x, y, r);
			for (let i = 0; i < p.colors.length; i++) {
				grad.addColorStop(i / (p.colors.length - 1), p.colors[i]);
			}
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, Math.PI * 2);
			ctx.fill();
		
			// Iluminação suave (terminador)
			ctx.save();
			ctx.globalCompositeOperation = 'source-atop';
			const phi = t * 0.0002 + index * 0.7;
			const dx = Math.cos(phi) * r;
			const dy = Math.sin(phi) * r;
			const light = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
			light.addColorStop(0, 'rgba(255,255,255,0.12)');
			light.addColorStop(0.5, 'rgba(255,255,255,0.03)');
			light.addColorStop(0.7, 'rgba(0,0,0,0)');
			light.addColorStop(1, 'rgba(0,0,0,0.2)');
			ctx.fillStyle = light;
			ctx.fillRect(x - r, y - r, r * 2, r * 2);
			ctx.restore();
		
			// Anel único e limpo (apenas para Saturno)
			if (p.ring) {
				ctx.save();
				ctx.translate(x, y);
				ctx.rotate(p.ring.tilt + Math.sin(t * 0.00022 + index) * 0.03);
				ctx.globalAlpha = p.ring.opacity || 0.7;
				ctx.strokeStyle = p.ring.color;
				ctx.lineWidth = p.ring.width + Math.sin(t * 0.001 + index) * 0.5;
				
				// Desenhar anel com bordas suaves
				ctx.beginPath();
				ctx.ellipse(0, 0, r * 1.4, r * 0.4, 0, 0, Math.PI * 2);
				ctx.stroke();
				
				// Anel interno mais sutil
				ctx.globalAlpha = (p.ring.opacity || 0.7) * 0.5;
				ctx.lineWidth = (p.ring.width + Math.sin(t * 0.001 + index) * 0.5) * 0.6;
				ctx.beginPath();
				ctx.ellipse(0, 0, r * 1.6, r * 0.45, 0, 0, Math.PI * 2);
				ctx.stroke();
				
				ctx.restore();
			}
		
			// Lua limpa (sem crateras problemáticas)
			if (p.moon) {
				const ang = t * (p.moon.speed || 0.0002) + index * 0.8;
				const md = r * (p.moon.dist || 1.6);
				const mx = x + Math.cos(ang) * md;
				const my = y + Math.sin(ang) * md;
				const mr = Math.max(3, r * (p.moon.ratio || 0.16));
				
				// Corpo da lua com gradiente suave
				const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.2, mx, my, mr);
				if (p.moon.colors) {
					for (let i = 0; i < p.moon.colors.length; i++) {
						mg.addColorStop(i / (p.moon.colors.length - 1), p.moon.colors[i]);
					}
				}
				
				ctx.fillStyle = mg;
				ctx.globalAlpha = 0.85;
				ctx.beginPath();
				ctx.arc(mx, my, mr, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalAlpha = 1;
			}
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
			
				drawDetailedPlanet(p, x, y, r, t, i);
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
	}

	// CORREÇÃO: Salvar estado inicial e aplicar upgrades
	save(state);

	// Inicialização
	refreshMenuLocks();
	applyAllUpgrades();
	updateFuelHUD();
	updateProgressHUD();
	show(menuView);

	// Debug log para verificar se está funcionando
	console.log('🚀 Jogo inicializado!');
	console.log(`Combustível: ${fuel}/${initialFuel}`);
	console.log('Upgrades:', state.upgrades);

})();