const TEXT_RU = window.GAME_TEXT_RU || {};

function t(key, params) {
    if (!key) return "";
    const parts = key.split('.');
    let value = TEXT_RU;
    for (const p of parts) {
        if (value && Object.prototype.hasOwnProperty.call(value, p)) {
            value = value[p];
        } else {
            value = null;
            break;
        }
    }
    if (typeof value !== 'string') value = key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, String(v));
        }
    }
    return value;
}

const grid = document.getElementById('grid');
const terminal = document.getElementById('terminal-content');
const timeDisplay = document.getElementById('time-display');
const stepInfo = document.getElementById('step-info');
const modal = document.getElementById('game-modal');
const modalText = document.getElementById('modal-text');
const modalTitle = document.getElementById('modal-title');
const modalButton = document.getElementById('modal-button');
const bossTrigger = document.getElementById('boss-trigger');
const bossLabel = document.getElementById('boss-label');
const targetHeader = document.getElementById('target-header');
const footerLeft = document.getElementById('footer-left');
const footerCenter = document.getElementById('footer-center');
const footerRight = document.getElementById('footer-right');
const emergencyMessage = document.getElementById('emergency-message');
const resetCycleBtn = document.getElementById('reset-cycle-btn');
const resetConfirmModal = document.getElementById('reset-confirm-modal');
const resetConfirmTitle = document.getElementById('reset-confirm-title');
const resetConfirmText = document.getElementById('reset-confirm-text');
const resetConfirmYes = document.getElementById('reset-confirm-yes');
const resetConfirmNo = document.getElementById('reset-confirm-no');
const inventoryDisplay = document.getElementById('inventory-display');
const inventoryItems = document.getElementById('inventory-items');
const debugWipeBtn = document.getElementById('debug-wipe-btn');
const musicToggleBtn = document.getElementById('music-toggle-btn');

const LOC_NAMES = ["Лаборатория", "Логово Хакера", "Улицы", "База"];
const TIMES = ["ДЕНЬ", "СУМЕРКИ", "ВЕЧЕР", "НОЧЬ"];
const TIME_CLASSES = ["day", "twilight", "evening", "night"];
const TIME_COLORS = ["#fbbf24", "#f97316", "#a855f7", "#3b82f6"];

let currentRow = 3;
let killed = { H: false, F: false, K: false, C: false };
let playerPath = []; // Новый массив для отслеживания пути игрока
let killLocations = [];
let isGameOver = false;
let cycleFinished = false;
let charlieInfoRevealed = false;
let assistantCrackedAtTwilight = false;
let charlieKilledOnRow = -1; // -1 означает, что Чарли еще жив или убит не на прошлом ходу

// --- Постоянное хранилище (Инвентарь) ---
let persistentState = {
    // Активные задачи для игрока
    clues: {
        labCode: false,
        fionaPCPassword: false,
    },
    // Решенные задачи
    solvedClues: {
        labCode: false,
        fionaPCPassword: false,
    },
    // Постоянная информация о мире
    information: {
        charlieSpying: false,
        fionaPassword: null,
        canWarnKarl: false, // Знание о том, что можно предупредить Карла
        revengeImminent: false, // Знание о том, что месть скоро начнется
    }
};

// --- Временное хранилище (сбрасывается при перезагрузке) ---
let sessionState = {
    fionaPasswordChangeInitiatedOnRow: -1,
    karlWarned: false, // Флаг, что Карл предупрежден
    karlDiedInShootout: false, // Флаг, что Карл погиб в перестрелке
    karlsKeyTakenByPlayer: false, // Флаг, что игрок сам забрал ключ Карла
};

function savePersistentState() {
    localStorage.setItem('echoesOf80s_save', JSON.stringify(persistentState));
    renderInventory(); // Обновляем инвентарь при сохранении
}

function loadPersistentState() {
    const savedData = localStorage.getItem('echoesOf80s_save');
    if (savedData) persistentState = JSON.parse(savedData);
    renderInventory(); // Обновляем инвентарь при загрузке
}

function renderInventory() {
    inventoryItems.innerHTML = '';

    // 1. Рендерим РЕШЕННЫЕ ЗАЦЕПКИ (золотой цвет)
    if (persistentState.solvedClues.labCode) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-amber-900/50 border border-amber-500 text-amber-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.inventoryLabCodeFound");
        inventoryItems.appendChild(itemEl);
    }

    // Решенная зацепка Фионы
    if (persistentState.solvedClues.fionaPCPassword) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-amber-900/50 border border-amber-500 text-amber-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.inventoryFionaPasswordFound");
        inventoryItems.appendChild(itemEl);
    }

    // 2. Рендерим АКТИВНЫЕ ЗАЦЕПКИ (синий цвет), только если они не решены
    if (persistentState.clues.labCode && !persistentState.solvedClues.labCode) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-blue-900/50 border border-blue-500 text-blue-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.inventoryLabNeedsCode");
        inventoryItems.appendChild(itemEl);
    }

    if (persistentState.clues.fionaPCPassword && !persistentState.solvedClues.fionaPCPassword) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-blue-900/50 border border-blue-500 text-blue-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.inventoryFionaNeedsPassword");
        inventoryItems.appendChild(itemEl);
    }

    // 3. Рендерим ИНФОРМАЦИЮ (серый/белый цвет)
    if (persistentState.information.charlieSpying) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.infoCharlieSpying");
        inventoryItems.appendChild(itemEl);
    }

    if (persistentState.information.canWarnKarl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.infoCanWarnKarl");
        inventoryItems.appendChild(itemEl);
    }

    if (persistentState.information.revengeImminent) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-red-900/50 border border-red-500 text-red-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.infoRevengeImminent");
        inventoryItems.appendChild(itemEl);
    }
}
// -----------------------------------------

function getLivingEnemiesInCell(time, locIdx) {
    let enemies = [];
    const isRevengeTurn = charlieKilledOnRow === currentRow + 1;
    
    if (isRevengeTurn) {
        // На следующий ход после убийства Чарли все собираются на Базе
        if (locIdx === 3) {
            if (!killed.H) enemies.push("H");
            if (!killed.F) enemies.push("F");
            if (!killed.K) enemies.push("K");
        } 
        // В ход мести остальные локации пусты, поэтому выходим
        return enemies.filter(e => !killed[e]);
    }
    
    // Стандартное расписание (выполняется, только если НЕ ход мести)
    if (locIdx === 0 && (time === "ДЕНЬ" || time === "СУМЕРКИ" || time === "ВЕЧЕР")) enemies.push("H"); // Генриетта

    // Логика Фионы (F)
    if (sessionState.karlDiedInShootout && (time === "ВЕЧЕР" || time === "НОЧЬ")) {
        if (time === "ВЕЧЕР" && locIdx === 2) enemies.push("F"); // Вечером на Улицах
        else if (time === "НОЧЬ" && locIdx === 1) enemies.push("F"); // Ночью возвращается в Логово
    } else if (!sessionState.karlDiedInShootout && (time === "СУМЕРКИ" || time === "ВЕЧЕР") && locIdx === 1) {
        // Стандартное расписание: Фиона в Логове
        enemies.push("F");
    }
    
    // Логика Карла (K)
    if (sessionState.karlWarned) {
        // Если Карл предупрежден, он не идет в Логово.
        // В Сумерках он погибает на Улицах, поэтому его нет в списке активных врагов.
        // В остальное время он на Улицах.
        if (time !== "СУМЕРКИ" && locIdx === 2) enemies.push("K");
    } else {
        // Стандартное расписание Карла
        if (time === "СУМЕРКИ" && locIdx === 1) enemies.push("K"); // Идет к Фионе
        else if (time !== "СУМЕРКИ" && locIdx === 2) enemies.push("K"); // Патрулирует Улицы
    }

    if (locIdx === 3 && (time === "ДЕНЬ" || time === "НОЧЬ")) enemies.push("C");
    
    return enemies.filter(e => !killed[e]);
}

function renderGrid() {
    grid.innerHTML = '';
    for (let r = 0; r < 4; r++) {
        const timeIdx = 3 - r;
        for (let c = 0; c < 4; c++) {
            const cell = document.createElement('div');
            const isActive = r === currentRow && !cycleFinished;
            
            cell.className = `cell ${TIME_CLASSES[timeIdx]} ${isActive ? 'active-row' : 'locked'}`;
            cell.dataset.row = r;
            cell.dataset.loc = c;
            
            let content = `<span class="loc-label">${LOC_NAMES[c]}</span>`;
            
            // Проверяем, была ли эта ячейка посещена
            if (playerPath.find(p => p.row === r && p.loc === c)) {
                cell.classList.add('player-location');
            }
            // Аватар добавляем только на клетку последнего хода
            const lastMove = playerPath.length > 0 ? playerPath[playerPath.length - 1] : null;
            if (lastMove && lastMove.row === r && lastMove.loc === c) {
                content += `<img src="./assets/avatar.png" class="player-avatar" alt="Player">`;
            }
            
            const wasKillHere = killLocations.find(k => k.row === r && k.loc === c);
            if (wasKillHere) {
                content += `<img src="./assets/skull.png" class="skull-icon" alt="Kill">`;
            }
            
            cell.innerHTML = content;
            
            if (isActive) {
                cell.onpointerdown = () => processMove(r, c);
            }
            grid.appendChild(cell);
        }
    }
}

function checkFinalVictory() {
    if (!cycleFinished || isGameOver) return;

    const allKilled = killed.H && killed.F && killed.K && killed.C;
    
    if (allKilled) {
        isGameOver = true;
        const modalContent = modal.querySelector('.modal-content');

        // Применяем "праздничные" стили
        modalContent.classList.add('victory');
        modalButton.className = "w-full border-2 border-green-500 py-4 text-green-400 font-bold hover:bg-green-500 hover:text-black transition-all uppercase";
        modalButton.innerText = "НАЧАТЬ НОВУЮ ИГРУ";

        modalTitle.innerText = t("system.protocolDoneTitle");
        modalTitle.style.color = "#00ff41";
        modalText.innerText = t("system.bossAllKilledText");
        modal.style.display = "flex";
        soundManager.playEffect('game_over_victory', 0.8);

        // Финальный штрих: стираем все данные после полной победы
        localStorage.removeItem('echoesOf80s_save');
    } else {
        const missing = Object.entries(killed).filter(([k, v]) => !v).map(([k]) => k).join(', ');
        triggerGameOver(t("system.bossMissingKeysText", { missing }));
    }
}

function triggerGameOver(reason) {
    isGameOver = true;
    modalTitle.innerText = t("system.modalFailureTitle");
    modalText.innerText = reason;
    modal.style.display = "flex";
    soundManager.playEffect('game_over_fail');
}

function updateKillStatus(target, row, loc) {
    killed[target] = true;
    killLocations.push({ row, loc });
    if (target === 'C') charlieKilledOnRow = row;
    soundManager.playEffect('kill_success');
    document.getElementById(`key-${target}`).classList.add('active');
}

function processMove(r, c) {
    if (isGameOver || cycleFinished) return;
    const timeIdx = 3 - r;
    const currentTime = TIMES[timeIdx];

    soundManager.playEffect('ui_click', 0.5);

    // Сохраняем ход игрока
    playerPath.push({ row: r, loc: c });

    const activeEnemies = getLivingEnemiesInCell(currentTime, c);
    
    if (activeEnemies.length >= 2) {
        addLog(
            t("system.multiEnemyError", { enemies: activeEnemies.join(', ') }),
            "text-red-500 font-bold"
        );
        triggerGameOver(
            t("system.ruleBrokenDeath", { enemies: activeEnemies.join(' и ') })
        );
        return;
    }

    if (c === 0) { // ЛАБОРАТОРИЯ
        if (killed.H) {
            addLog(t("lab.afterKill"), "text-zinc-500");
        } else {
            const isHenriettaInside = activeEnemies.includes("H");
            const isRevengeTurn = charlieKilledOnRow === currentRow + 1;

            if (isRevengeTurn && !isHenriettaInside && !persistentState.solvedClues.labCode) {
                // "Ход мести": Генриетта ушла в спешке, оставив дверь открытой. Находим код.
                persistentState.solvedClues.labCode = true;
                soundManager.playEffect('info_discover');
                savePersistentState();
                addLog(t("lab.findCodeNote"), "text-amber-400 font-bold");
            } else if (isRevengeTurn && !isHenriettaInside && persistentState.solvedClues.labCode) {
                // "Ход мести", но код у нас уже есть. Просто пустая лаборатория.
                addLog(t("lab.emptyWithCode"), "text-zinc-400");
            } else if (isHenriettaInside && persistentState.solvedClues.labCode) {
                // У нас есть код, и Генриетта внутри. Устраняем.
                addLog(t("lab.killWithCode"), "text-magenta-500 font-bold");
                updateKillStatus('H', r, c);
            } else if (!isHenriettaInside && currentTime === "НОЧЬ") {
                // Ночь. Генриетта ушла по расписанию и заперла дверь.
                addLog(t("lab.nightDoorLocked"), "text-zinc-400");
            } else {
                // В остальных случаях (Генриетта внутри, кода нет) дверь заперта.
                addLog(t("lab.dayDoor"), "text-zinc-400");
                if (!persistentState.solvedClues.labCode) {
                    persistentState.clues.labCode = true;
                    soundManager.playEffect('info_discover', 0.4);
                    savePersistentState(); // Сохраняем, чтобы задача осталась после перезагрузки
                }
            }
        }
    }
    else if (c === 1) { // ЛОГОВО ХАКЕРА
        const hasFionaHere = activeEnemies.includes("F");
        const isPasswordChangeTrapSet = sessionState.fionaPasswordChangeInitiatedOnRow !== -1;
        const isPasswordChangeTurn = sessionState.fionaPasswordChangeInitiatedOnRow === r + 2;

        // 1. Проверяем, мертва ли Фиона
        if (killed.F) {
            if (currentTime === "ДЕНЬ") {
                addLog(t("lair.afterKillDay"), "text-zinc-500");
            } else {
                addLog(t("lair.afterKillOther"), "text-zinc-500");
            }
            // BUG FIX: Если мы выходим здесь, nextStep() не вызывается.
            // Вместо return, мы просто пропускаем остальную логику и идем к nextStep().
            // Но так как остальная логика в else, return здесь корректен,
            // но нужно убедиться, что nextStep() вызывается. Проблема в другом месте.
        }

        // 2. Фиона жива. Проверяем, находится ли она здесь.
        if (hasFionaHere) {
            // Сценарий 1: Убийство для получения пароля
            if (isPasswordChangeTurn && !persistentState.solvedClues.fionaPCPassword) {
                addLog(t("lair.fionaKilledGetPassword"), "text-amber-400 font-bold");
                persistentState.solvedClues.fionaPCPassword = true;
                persistentState.information.fionaPassword = "ECHO_77";
                updateKillStatus('F', r, c);
                soundManager.playEffect('info_discover');
                savePersistentState();
            // Сценарий 2: Убийство скорбящей Фионы ночью
            } else if (sessionState.karlDiedInShootout && currentTime === "НОЧЬ") {
                addLog(t("lair.fionaMourningKillNight"), "text-amber-400 font-bold");
                if (!sessionState.karlsKeyTakenByPlayer && !killed.K) {
                    addLog(t("system.doubleKeyFound"), "text-yellow-300");
                    updateKillStatus('K', r, c); // Получаем и ключ Карла!
                }
                updateKillStatus('F', r, c);
                savePersistentState();
            // Сценарий 3: Обычное убийство
            } else {
                 addLog(t("lair.fionaAlone"), "text-magenta-500 font-bold");
                 updateKillStatus('F', r, c);
            }
        // 3. Фионы здесь нет. Взаимодействуем с окружением.
        } else {
            if (sessionState.karlDiedInShootout) {
                addLog(t("lair.fionaGoneMourning"), "text-zinc-400");
            } else if (persistentState.solvedClues.fionaPCPassword) {
                addLog(t("lair.pcUsedToSendMsg"), "text-cyan-400");
                if (currentTime === "ДЕНЬ") sessionState.karlWarned = true;
                if (!persistentState.information.canWarnKarl) {
                    persistentState.information.canWarnKarl = true;
                    soundManager.playEffect('info_discover');
                    savePersistentState();
                }
            } else {
                addLog(t("lair.pcPasswordChange"), "text-blue-400");
                sessionState.fionaPasswordChangeInitiatedOnRow = r;
                persistentState.clues.fionaPCPassword = true;
                soundManager.playEffect('info_discover', 0.4);
                savePersistentState();
            }
        }

        // BUG FIX: Если Фиона была убита, мы выходили из функции processMove раньше,
        // не вызывая nextStep(). Теперь nextStep() будет вызван в любом случае.
        if (killed.F) {
            nextStep();
            return;
        }
    }
    else if (c === 2) { // УЛИЦЫ
        const hasKarlHere = activeEnemies.includes("K");
        const hasFionaHere = activeEnemies.includes("F");

        if (sessionState.karlWarned && currentTime === "СУМЕРКИ" && !killed.K) {
            // Игрок находит тело Карла и может забрать ключ
            addLog(t("streets.kCrossfireDeathAndLoot"), "text-yellow-400 font-bold");
            sessionState.karlDiedInShootout = true; // Фиона теперь изменит поведение
            sessionState.karlsKeyTakenByPlayer = true; // Игрок забрал ключ
            updateKillStatus('K', r, c);
        } else if (hasFionaHere && sessionState.karlDiedInShootout && currentTime === "ВЕЧЕР") {
            // Убийство скорбящей Фионы на Улицах вечером
            if (!sessionState.karlsKeyTakenByPlayer && !killed.K) {
                // Если игрок не брал ключ Карла, Фиона сделала это за него
                addLog(t("streets.fionaMourningKillDoubleKey"), "text-amber-400 font-bold");
                updateKillStatus('K', r, c); // Получаем и ключ Карла!
            } else {
                // Игрок уже забрал ключ Карла, Фиона просто скорбит
                addLog(t("streets.fionaMourningKillSingleKey"), "text-magenta-500 font-bold");
            }
            updateKillStatus('F', r, c);
        } else if (killed.K) {
            addLog(t("streets.kAlreadyDead"), "text-zinc-500");
        } else if (hasKarlHere) {
            // Обычное убийство Карла
            addLog(t("streets.kKilled"), "text-magenta-500 font-bold");
            updateKillStatus('K', r, c);
        } else {
            // Карла здесь нет по расписанию
            addLog(t("streets.kMissing"), "text-zinc-500");
        }
    }
    else if (c === 3) { // БАЗА
        const isCharlieTime = currentTime === "ДЕНЬ" || currentTime === "НОЧЬ";
        const isAssistantTime = currentTime === "СУМЕРКИ" || currentTime === "ВЕЧЕР";

        if (!killed.C && isCharlieTime) {
            addLog(t("base.charlieKilled"), "text-magenta-500");
            addLog(t("base.revengeWarning"), "text-red-500 font-bold");
            updateKillStatus('C', r, c);
            persistentState.information.revengeImminent = true;
            persistentState.information.charlieSpying = true;
            soundManager.playEffect('info_discover');
            savePersistentState();
        } else if (!killed.C && isAssistantTime) {
            if (assistantCrackedAtTwilight && currentTime === "ВЕЧЕР") {
                addLog(t("base.assistantEmptyEvening"), "text-zinc-500");
                nextStep();
                return;
            } 
            addLog(t("base.assistantInterrogatedTwilight"), "text-zinc-500");
            if (!persistentState.information.charlieSpying) {
                persistentState.information.charlieSpying = true;
                soundManager.playEffect('info_discover');
                savePersistentState();
            }
            if (currentTime === "СУМЕРКИ") assistantCrackedAtTwilight = true;
        } else if (killed.C && isAssistantTime && !persistentState.information.charlieSpying) {
            addLog(t("base.assistantPanic"), "text-zinc-500");
            persistentState.information.charlieSpying = true;
            savePersistentState();
        } else if (killed.C) {
            addLog(t("base.charlieAlreadyDead"), "text-zinc-500");
        } else {
            addLog(t("base.baseEmptyGeneric"), "text-zinc-500");
        }
    }

    // Если игрок не был на улицах в сумерках, но Карл был предупрежден, он всё равно умирает "за кадром"
    if (sessionState.karlWarned && currentTime === "СУМЕРКИ" && c !== 2 && !killed.K) {
        sessionState.karlDiedInShootout = true;
        // BUG FIX: Карл должен быть помечен как убитый, даже если это произошло "за кадром".
        // Он погиб на Улицах (loc=2) в Сумерках (row=2).
        updateKillStatus('K', 2, 2);
    }

    nextStep();
}

function nextStep() {
    currentRow--;
    if (currentRow < 0) {
        // Цикл завершен — активируем зону Вышки
        cycleFinished = true;
        bossTrigger.classList.add('final-active');
        bossLabel.style.display = 'block';
        targetHeader.style.display = 'none';

        const allKilled = killed.H && killed.F && killed.K && killed.C;
        bossLabel.innerText = allKilled
            ? t("system.bossLabelOpen")
            : t("system.bossLabelNeedKeys");

        addLog(
            allKilled ? t("system.cycleDoneAll") : t("system.cycleDoneMissing"),
            "text-magenta-500 animate-pulse"
        );

        renderGrid();
    } else {
        const tIdx = 3 - currentRow;
        timeDisplay.innerText = TIMES[tIdx];
        timeDisplay.style.color = TIME_COLORS[tIdx];
        stepInfo.innerText = `ЭТАП: ${tIdx + 1} / 4`;
        renderGrid();
    }
}

function addLog(msg, color = "text-green-500") {
    const div = document.createElement('div');
    div.className = `log-entry ${color}`;
    div.innerText = `> ${msg}`;
    terminal.prepend(div);

    // Запускаем плавное появление после вставки
    requestAnimationFrame(() => {
        div.classList.add('visible');
    });
}

function setupAudioControls() {
    const iconVolumeOn = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>`;
    const iconVolumeOff = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clip-rule="evenodd" /><path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>`;

    function updateIcon(isMuted) {
        musicToggleBtn.innerHTML = isMuted ? iconVolumeOff : iconVolumeOn;
    }

    // Устанавливаем начальную иконку, основываясь на том, играет ли музыка
    updateIcon(!soundManager.sounds.ambiance?.playing());

    musicToggleBtn.onclick = () => {
        const isMuted = soundManager.toggleAmbiance();
        updateIcon(isMuted);
    };
}

window.onload = () => {
    // Загружаем постоянный прогресс при старте игры
    loadPersistentState();

    // Первоначальная отрисовка инвентаря (на случай, если он уже был в localStorage)
    renderInventory();

    // Инициализируем текст в зоне Вышки
    targetHeader.innerText = t("system.bossHeader");
    bossLabel.innerText = t("system.bossLabelClosed");

    // Футер с тех-надписями
    footerLeft.innerText = t("system.footerLeft");
    footerRight.innerText = t("system.footerRight");

    // Инициализируем текст и функционал кнопки сброса
    emergencyMessage.innerText = t("system.emergencyMessage");
    resetCycleBtn.innerText = t("system.resetCycleButton");
    resetConfirmTitle.innerText = t("system.resetConfirmTitle");
    resetConfirmText.innerText = t("system.resetConfirmText");
    resetConfirmYes.innerText = t("system.resetConfirmYes");
    resetConfirmNo.innerText = t("system.resetConfirmNo");

    resetCycleBtn.onclick = () => { resetConfirmModal.style.display = "flex"; };
    resetConfirmYes.onclick = () => {
        soundManager.playEffect('cycle_reset');
        // Небольшая задержка, чтобы звук успел проиграться перед перезагрузкой
        setTimeout(() => location.reload(), 300);
    };
    resetConfirmNo.onclick = () => { resetConfirmModal.style.display = "none"; };

    // --- DEBUG ---
    debugWipeBtn.onclick = () => {
        localStorage.removeItem('echoesOf80s_save');
        location.reload();
    };

    // Настраиваем кнопку управления музыкой
    setupAudioControls();

    // Рендерим поле
    renderGrid();

    // Стартовое системное сообщение в терминале
    addLog(t("system.bootMessage"), "text-zinc-500");

    // Запускаем фоновую музыку
    soundManager.playAmbiance();
};