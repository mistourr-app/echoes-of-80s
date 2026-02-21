const TEXT_RU = window.GAME_TEXT_RU || {};
let currentScenarioId = 'echoes'; // ID текущего сценария по умолчанию

function t(key, params) {
    if (!key) return "";
    const parts = key.split('.');
    
    // Пытаемся найти ключ в текстах текущего сценария
    let value = parts.reduce((obj, part) => (obj && obj[part] !== 'undefined') ? obj[part] : undefined, TEXT_RU[currentScenarioId]);

    // Если не нашли, ищем в общих текстах
    if (value === undefined) {
        value = parts.reduce((obj, part) => (obj && obj[part] !== 'undefined') ? obj[part] : undefined, TEXT_RU);
    }

    // Если ключ так и не найден, возвращаем сам ключ
    if (typeof value !== 'string') value = key;

    if (params) {
        for (const [k, v] of Object.entries(params)) {
            value = value.replace(`{${k}}`, String(v));
        }
    }
    return value;
}

// --- DOM Элементы ---
let scenarioSelectModal, scenarioList, changeScenarioBtn, grid, terminal, timeDisplay, stepInfo,
    scenarioTitleDisplay, modal, modalText, modalTitle, modalButton, bossTrigger, bossLabel,
    targetHeader, footerLeft, footerRight, emergencyMessage, resetCycleBtn, resetConfirmModal,
    resetConfirmTitle, resetConfirmText, resetConfirmYes, resetConfirmNo, inventoryDisplay,
    inventoryItems, debugWipeBtn, musicToggleBtn;

// --- Глобальные переменные состояния игры ---
let gameConfig = {}; // Конфигурация текущего сценария

const TIMES = ["ДЕНЬ", "СУМЕРКИ", "ВЕЧЕР", "НОЧЬ"];
const TIME_CLASSES = ["day", "twilight", "evening", "night"];
const TIME_COLORS = ["#fbbf24", "#f97316", "#a855f7", "#3b82f6"];

let currentRow = 3;
let killed = {};
let playerPath = [];
let killLocations = [];
let isGameOver = false;
let cycleFinished = false;

// --- Переменные состояния для сценария "Echoes of 80s" ---
let charlieInfoRevealed = false;
let assistantCrackedAtTwilight = false;
let charlieKilledOnRow = -1; // -1 означает, что Чарли еще жив или убит не на прошлом ходу

// --- Постоянное хранилище (Инвентарь) ---
const defaultPersistentState = {
    // Активные задачи для игрока
    clues: {
        labCode: false,
        fionaPCPassword: false,
        vanceServer: false,
        dameLocation: false,
    },
    // Решенные задачи
    solvedClues: {
        labCode: false,
        fionaPCPassword: false,
        encryptionKey: false,
    },
    // Постоянная информация о мире
    information: {
        charlieSpying: false,
        fionaPassword: null,
        canWarnKarl: false,
        revengeImminent: false,
        dameLocationKnown: false,
        byteAmbushKnown: false,
    }
};
let persistentState = JSON.parse(JSON.stringify(defaultPersistentState));

function getSaveKey() {
    return `echoesOf80s_save_${currentScenarioId}`; // Убедимся, что currentScenarioId всегда актуален
}

// --- Временное хранилище (сбрасывается при перезагрузке) ---
let sessionState = {
    fionaPasswordChangeInitiatedOnRow: -1,
    karlWarned: false, // Флаг, что Карл предупрежден
    karlDiedInShootout: false, // Флаг, что Карл погиб в перестрелке
    karlsKeyTakenByPlayer: false, // Флаг, что игрок сам забрал ключ Карла
    // Для "Призрака в машине"
    vanceSecurityDisabled: false,
    chenKilledOnRow: -1,
};

function savePersistentState() {
    localStorage.setItem(getSaveKey(), JSON.stringify(persistentState));
    renderInventory(); // Обновляем инвентарь при сохранении
}

function loadPersistentState() {
    const savedData = localStorage.getItem(getSaveKey());
    // Сначала сбрасываем состояние до дефолтного, чтобы избежать переноса данных между сценариями в памяти
    let freshState = JSON.parse(JSON.stringify(defaultPersistentState));

    // Функция для "глубокого" слияния объектов, чтобы избежать перезаписи вложенных состояний (например, information)
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key]) {
                    Object.assign(target, { [key]: {} });
                }
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
        return target;
    }

    // А затем загружаем сохраненные данные для этого цикла, если они есть
    if (savedData) {
        // Используем deepMerge вместо Object.assign для корректного слияния вложенных объектов
        try {
            persistentState = deepMerge(freshState, JSON.parse(savedData));
        } catch (e) {
            persistentState = freshState; // В случае ошибки парсинга, сбрасываемся к чистому состоянию
        }
    } else {
        persistentState = freshState;
    }
    renderInventory(); // Обновляем инвентарь при загрузке
}

function renderInventory() {
    inventoryItems.innerHTML = '';

    // 1. Рендерим РЕШЕННЫЕ ЗАЦЕПКИ (золотой цвет)
    // --- Echoes of 80s ---
    if (persistentState.solvedClues.labCode) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-amber-900/50 border border-amber-500 text-amber-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.inventoryLabCodeFound");
        inventoryItems.appendChild(itemEl);
    }

    if (persistentState.solvedClues.fionaPCPassword) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-amber-900/50 border border-amber-500 text-amber-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.inventoryFionaPasswordFound");
        inventoryItems.appendChild(itemEl);
    }

    // --- Ghost in the Machine ---
    if (persistentState.solvedClues.encryptionKey) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-amber-900/50 border border-amber-500 text-amber-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.solvedEncryptionKey");
        inventoryItems.appendChild(itemEl);
    }
    // 2. Рендерим АКТИВНЫЕ ЗАЦЕПКИ (синий цвет), только если они не решены
    // --- Echoes of 80s ---
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

    // --- Ghost in the Machine ---
    if (persistentState.clues.vanceServer && !sessionState.vanceSecurityDisabled) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-blue-900/50 border border-blue-500 text-blue-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.clueVanceServer");
        inventoryItems.appendChild(itemEl);
    }
    if (persistentState.clues.dameLocation && !persistentState.information.dameLocationKnown) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-blue-900/50 border border-blue-500 text-blue-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.clueDameLocation");
        inventoryItems.appendChild(itemEl);
    }


    // 3. Рендерим ИНФОРМАЦИЮ (серый/белый цвет)
    // --- Echoes of 80s ---
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

    // --- Ghost in the Machine ---
    if (persistentState.information.dameLocationKnown) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.infoDameLocation");
        inventoryItems.appendChild(itemEl);
    }

    if (persistentState.information.byteAmbushKnown) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-red-900/50 border border-red-500 text-red-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.infoByteAmbush");
        inventoryItems.appendChild(itemEl);
    }

    if (sessionState.vanceSecurityDisabled) {
        const itemEl = document.createElement('div');
        itemEl.className = 'py-1 px-2 bg-blue-900/50 border border-blue-500 text-blue-300 rounded-sm text-[11px]';
        itemEl.innerText = t("system.infoVanceServerDisabled");
        inventoryItems.appendChild(itemEl);
    }
}
// -----------------------------------------

function getLivingEnemiesInCell(time, locIdx) {
    let enemies = [];

    if (currentScenarioId === 'echoes') {
        const isRevengeTurn = charlieKilledOnRow === currentRow + 1;
        if (isRevengeTurn) {
            if (locIdx === 3) { // База
                if (!killed.H) enemies.push("H");
                if (!killed.F) enemies.push("F");
                if (!killed.K) enemies.push("K");
            }
            return enemies.filter(e => !killed[e]);
        }

        // Генриетта (H)
        if (locIdx === 0 && (time === "ДЕНЬ" || time === "СУМЕРКИ" || time === "ВЕЧЕР")) enemies.push("H");

        // Фиона (F)
        if (sessionState.karlDiedInShootout) {
            if (time === "ВЕЧЕР" && locIdx === 2) enemies.push("F");
            else if (time === "НОЧЬ" && locIdx === 1) enemies.push("F");
        } else if ((time === "СУМЕРКИ" || time === "ВЕЧЕР") && locIdx === 1) {
            enemies.push("F");
        }

        // Карл (K)
        if (sessionState.karlWarned) {
            if (time !== "СУМЕРКИ" && locIdx === 2) enemies.push("K");
        } else {
            if (time === "СУМЕРКИ" && locIdx === 1) enemies.push("K");
            else if (time !== "СУМЕРКИ" && locIdx === 2) enemies.push("K");
        }

        // Чарли (C)
        if (locIdx === 3 && (time === "ДЕНЬ" || time === "НОЧЬ")) enemies.push("C");

    } else if (currentScenarioId === 'ghost') {
        const isByteTrapTurn = sessionState.chenKilledOnRow === currentRow + 1;

        // (A) Артур Вэнс
        if (locIdx === 0 && (time === "ДЕНЬ" || time === "ВЕЧЕР")) enemies.push("V");

        // (B) "Байт"
        if (isByteTrapTurn) {
            // На следующий ход после убийства Чена, Байт идет в Клинику
            if (locIdx === 2) enemies.push("B");
        } else {
            // Стандартное расписание
            if (locIdx === 1 && (time === "СУМЕРКИ" || time === "НОЧЬ")) enemies.push("B");
        }

        // (C) Доктор Чен
        if (locIdx === 2 && (time === "ДЕНЬ" || time === "СУМЕРКИ")) enemies.push("C");

        // (D) "Дама"
        // Она появляется только если игрок знает где искать
        if (persistentState.information.dameLocationKnown && locIdx === 3 && time === "ВЕЧЕР") {
            enemies.push("D");
        }
    }

    return enemies.filter(e => !killed[e] && gameConfig.targetKeys.includes(e));
}

function renderGrid() {
    grid.innerHTML = '';
    // Обновляем индикаторы ключей
    const keyContainer = document.querySelector('.boss-keys-container');
    keyContainer.innerHTML = '';
    for (const key of gameConfig.targetKeys) {
        const keyEl = document.createElement('div');
        keyEl.id = `key-${key}`;
        keyEl.className = 'boss-key-indicator';
        keyEl.innerText = key;
        if (killed[key]) {
            keyEl.classList.add('active');
        }
        keyContainer.appendChild(keyEl);
    }

    for (let r = 0; r < 4; r++) {
        const timeIdx = 3 - r;
        for (let c = 0; c < 4; c++) {
            const cell = document.createElement('div');
            const isActive = r === currentRow && !cycleFinished;
            
            cell.className = `cell ${TIME_CLASSES[timeIdx]} ${isActive ? 'active-row' : 'locked'}`;
            cell.dataset.row = r;
            cell.dataset.loc = c;
            
            let content = `<span class="loc-label">${gameConfig.locNames[c]}</span>`;
            
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

    const allKilled = gameConfig.targetKeys.every(key => killed[key]);
    
    if (allKilled) {
        isGameOver = true;
        const modalContent = modal.querySelector('.modal-content');

        // Применяем "праздничные" стили
        modalContent.classList.add('victory');
        modalButton.className = "w-full border-2 border-green-500 py-4 text-green-400 font-bold hover:bg-green-500 hover:text-black transition-all uppercase";
        modalButton.innerText = "НАЧАТЬ НОВУЮ ИГРУ";

        modalTitle.innerText = t("common.protocolDoneTitle");
        modalTitle.style.color = "#00ff41";
        modalText.innerText = t("system.bossAllKilledText");
        modal.style.display = "flex";
        soundManager.playEffect('game_over_victory', 0.8);

        // Финальный штрих: стираем все данные после полной победы
        localStorage.removeItem(getSaveKey());
        // Привязываем к кнопке перезапуск текущего сценария, а не просто перезагрузку
        modalButton.onclick = () => {
            initGameForScenario(currentScenarioId);
            modal.style.display = "none";
        };
    } else {
        const missing = Object.entries(killed).filter(([k, v]) => !v).map(([k]) => k).join(', ');
        triggerGameOver(t("system.bossMissingKeysText", { missing }));
    }
}

function triggerGameOver(reason) {
    isGameOver = true;
    modalTitle.innerText = t("common.modalFailureTitle");
    modalText.innerText = reason;
    modal.style.display = "flex";

    // Сброс стилей на случай, если до этого была победа
    const modalContent = modal.querySelector('.modal-content');
    modalContent.classList.remove('victory');
    modalButton.className = "w-full border-2 border-red-500 py-4 text-red-500 font-bold hover:bg-red-500 hover:text-black transition-all uppercase";
    modalButton.innerText = t("common.modalRetryButton");
    modalTitle.style.color = ""; // Сбрасываем цвет заголовка на дефолтный из CSS

    soundManager.playEffect('game_over_fail');
}

function updateKillStatus(target, row, loc) {
    killed[target] = true;
    killLocations.push({ row, loc });
    // Специфичная логика для сценариев
    if (currentScenarioId === 'echoes' && target === 'C') charlieKilledOnRow = row;
    if (currentScenarioId === 'ghost' && target === 'C') sessionState.chenKilledOnRow = row;

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
            t("common.multiEnemyError", { enemies: activeEnemies.join(', ') }),
            "text-red-500 font-bold"
        );
        triggerGameOver(
            t("system.ruleBrokenDeath", { enemies: activeEnemies.join(' и ') })
        );
        return; // Важно!
    }

    if (currentScenarioId === 'echoes') {
        if (c === 0) { // ЛАБОРАТОРИЯ
            if (killed.H) {
                addLog(t("lab.afterKill"), "text-zinc-500");
            } else {
                const isHenriettaInside = activeEnemies.includes("H");
                const isRevengeTurn = charlieKilledOnRow === currentRow + 1;

                if (isRevengeTurn && !isHenriettaInside && !persistentState.solvedClues.labCode) {
                    persistentState.solvedClues.labCode = true;
                    soundManager.playEffect('info_discover');
                    savePersistentState();
                    addLog(t("lab.findCodeNote"), "text-amber-400 font-bold");
                } else if (isRevengeTurn && !isHenriettaInside && persistentState.solvedClues.labCode) {
                    addLog(t("lab.emptyWithCode"), "text-zinc-400");
                } else if (isHenriettaInside && persistentState.solvedClues.labCode) {
                    addLog(t("lab.killWithCode"), "text-magenta-500 font-bold");
                    updateKillStatus('H', r, c);
                } else if (!isHenriettaInside && currentTime === "НОЧЬ") {
                    addLog(t("lab.nightDoorLocked"), "text-zinc-400");
                } else {
                    addLog(t("lab.dayDoor"), "text-zinc-400");
                    if (!persistentState.solvedClues.labCode) {
                        persistentState.clues.labCode = true;
                        soundManager.playEffect('info_discover', 0.4);
                        savePersistentState();
                    }
                }
            }
        }
        else if (c === 1) { // ЛОГОВО ХАКЕРА
            const hasFionaHere = activeEnemies.includes("F");
            const isPasswordChangeTurn = sessionState.fionaPasswordChangeInitiatedOnRow === r + 2;

            if (killed.F) {
                if (currentTime === "ДЕНЬ") addLog(t("lair.afterKillDay"), "text-zinc-500");
                else addLog(t("lair.afterKillOther"), "text-zinc-500");
            } else if (hasFionaHere) {
                if (isPasswordChangeTurn && !persistentState.solvedClues.fionaPCPassword) {
                    addLog(t("lair.fionaKilledGetPassword"), "text-amber-400 font-bold");
                    persistentState.solvedClues.fionaPCPassword = true;
                    persistentState.information.fionaPassword = "ECHO_77";
                    updateKillStatus('F', r, c);
                    soundManager.playEffect('info_discover');
                    savePersistentState();
                } else if (sessionState.karlDiedInShootout && currentTime === "НОЧЬ") {
                    addLog(t("lair.fionaMourningKillNight"), "text-amber-400 font-bold");
                    if (!sessionState.karlsKeyTakenByPlayer && !killed.K) {
                        addLog(t("system.doubleKeyFound"), "text-yellow-300");
                        updateKillStatus('K', r, c);
                    }
                    updateKillStatus('F', r, c);
                    savePersistentState();
                } else {
                     addLog(t("lair.fionaAlone"), "text-magenta-500 font-bold");
                     updateKillStatus('F', r, c);
                }
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
        }
        else if (c === 2) { // УЛИЦЫ
            const hasKarlHere = activeEnemies.includes("K");
            const hasFionaHere = activeEnemies.includes("F");

            if (sessionState.karlWarned && currentTime === "СУМЕРКИ" && !killed.K) {
                addLog(t("streets.kCrossfireDeathAndLoot"), "text-yellow-400 font-bold");
                sessionState.karlDiedInShootout = true;
                sessionState.karlsKeyTakenByPlayer = true;
                updateKillStatus('K', r, c);
            } else if (hasFionaHere && sessionState.karlDiedInShootout && currentTime === "ВЕЧЕР") {
                if (!sessionState.karlsKeyTakenByPlayer && !killed.K) {
                    addLog(t("streets.fionaMourningKillDoubleKey"), "text-amber-400 font-bold");
                    updateKillStatus('K', r, c);
                } else {
                    addLog(t("streets.fionaMourningKillSingleKey"), "text-magenta-500 font-bold");
                }
                updateKillStatus('F', r, c);
            } else if (killed.K) {
                addLog(t("streets.kAlreadyDead"), "text-zinc-500");
            } else if (hasKarlHere) {
                addLog(t("streets.kKilled"), "text-magenta-500 font-bold");
                updateKillStatus('K', r, c);
            } else {
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
                } else {
                    addLog(t("base.assistantInterrogatedTwilight"), "text-zinc-500");
                    if (!persistentState.information.charlieSpying) {
                        persistentState.information.charlieSpying = true;
                        soundManager.playEffect('info_discover');
                        savePersistentState();
                    }
                    if (currentTime === "СУМЕРКИ") assistantCrackedAtTwilight = true;
                }
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
    }

    // --- Логика для "Призрака в машине" ---
    if (currentScenarioId === 'ghost') {
        if (c === 0) { // КОРП-БАШНЯ (V)
            const hasVanceHere = activeEnemies.includes("V");
            if (killed.V) {
                addLog(t("corp_tower.vanceDead"), "text-zinc-500");
            } else if (hasVanceHere) {
                if (sessionState.vanceSecurityDisabled) {
                    addLog(t("corp_tower.vanceKilled"), "text-magenta-500 font-bold");
                    updateKillStatus('V', r, c);
                } else if (persistentState.solvedClues.encryptionKey) {
                    addLog(t("corp_tower.vanceKilledRemote"), "text-amber-400 font-bold");
                    updateKillStatus('V', r, c);
                } else {
                    addLog(t("corp_tower.vancePresentSecure"), "text-red-500 font-bold");
                    triggerGameOver(t("system.ruleBrokenDeath"));
                    return;
                }
            } else {
                addLog(t("corp_tower.vanceAbsent"), "text-zinc-400");
                if (!sessionState.vanceSecurityDisabled && !persistentState.solvedClues.encryptionKey) {
                    persistentState.clues.vanceServer = true;
                    savePersistentState();
                }
            }
        } else if (c === 1) { // ДАТА-ЦЕНТР (B)
            const hasByteHere = activeEnemies.includes("B");
            if (killed.B) {
                addLog(t("data_hub.byteDead"), "text-zinc-500");
            } else if (hasByteHere) {
                addLog(t("data_hub.bytePresent"), "text-magenta-500 font-bold");
                updateKillStatus('B', r, c);
            } else { // Байта нет
                // Если мы еще не знаем, где Дама, то при первом визите в Дата-Центр мы это узнаем.
                if (!persistentState.information.dameLocationKnown) {
                    addLog(t("data_hub.serverHackDay"), "text-cyan-400 font-bold");
                    persistentState.information.dameLocationKnown = true;
                    soundManager.playEffect('info_discover');
                    savePersistentState();
                // Если мы УЖЕ знаем где Дама, и пришли Вечером, то можем отключить сервер.
                } else if (persistentState.information.dameLocationKnown && currentTime === "ВЕЧЕР" && !sessionState.vanceSecurityDisabled) {
                    addLog(t("data_hub.serverHackEvening"), "text-blue-400 font-bold");
                    sessionState.vanceSecurityDisabled = true;
                    renderInventory(); // Обновляем инвентарь, чтобы показать временное состояние
                } else { // Если все возможные действия уже выполнены
                    addLog(t("data_hub.serverAlreadyHacked"), "text-zinc-400");
                }
                if (!persistentState.information.dameLocationKnown) {
                    persistentState.clues.dameLocation = true;
                    savePersistentState();
                }
            }
        } else if (c === 2) { // КЛИНИКА (C)
            const hasChenHere = activeEnemies.includes("C");
            const hasByteHere = activeEnemies.includes("B"); // Проверка на ловушку
            if (hasByteHere) {
                // Игрок попал в ловушку.
                addLog(t("clinic.byteArrived"), "text-red-500 font-bold");
                // Сохраняем знание о ловушке для будущих циклов.
                persistentState.information.byteAmbushKnown = true;
                savePersistentState();
                triggerGameOver(t("system.gameOverByteAmbush"));
                return;
            }

            if (killed.C) {
                addLog(t("clinic.chenDead"), "text-zinc-500");
            } else if (hasChenHere) {
                addLog(t("clinic.chenPresent"), "text-magenta-500 font-bold");
                updateKillStatus('C', r, c);
            } else {
                addLog(t("clinic.chenAbsent"), "text-zinc-400");
            }
        } else if (c === 3) { // АРХИВ (D)
            const hasDameHere = activeEnemies.includes("D");
            if (killed.D) {
                addLog(t("archives.dameDead"), "text-zinc-500");
            } else if (hasDameHere) {
                addLog(t("archives.dameEncounter"), "text-amber-400 font-bold");
                persistentState.solvedClues.encryptionKey = true;
                updateKillStatus('D', r, c);
                soundManager.playEffect('info_discover');
                savePersistentState();
            } else {
                addLog(t("archives.dameAbsent"), "text-zinc-400");
                if (!persistentState.information.dameLocationKnown) {
                    persistentState.clues.dameLocation = true;
                    savePersistentState();
                }
            }
        }
    }

    // Если игрок не был на улицах в сумерках, но Карл был предупрежден, он всё равно умирает "за кадром"
    if (currentScenarioId === 'echoes') {
        if (sessionState.karlWarned && currentTime === "СУМЕРКИ" && c !== 2 && !killed.K) {
            sessionState.karlDiedInShootout = true;
            // BUG FIX: Карл должен быть помечен как убитый, даже если это произошло "за кадром".
            // Он погиб на Улицах (loc=2) в Сумерках (row=2).
            updateKillStatus('K', 2, 2);
        }
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

        const allKilled = gameConfig.targetKeys.every(key => killed[key]);
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
    const iconChangeScenario = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`;

    function updateIcon(isMuted) {
        musicToggleBtn.innerHTML = isMuted ? iconVolumeOff : iconVolumeOn;
    }
    changeScenarioBtn.innerHTML = iconChangeScenario;

    // Устанавливаем начальную иконку, основываясь на том, играет ли музыка
    updateIcon(!soundManager.sounds.ambiance?.playing());

    musicToggleBtn.onclick = () => {
        const isMuted = soundManager.toggleAmbiance();
        updateIcon(isMuted);
    };

    changeScenarioBtn.onclick = () => {
        scenarioSelectModal.style.display = 'flex';
    };
}

function resetGameSession() {
    currentRow = 3;
    killed = {};
    gameConfig.targetKeys.forEach(key => killed[key] = false);
    playerPath = [];
    killLocations = [];
    isGameOver = false;
    cycleFinished = false;

    // Сброс состояний для "Echoes of 80s"
    charlieInfoRevealed = false;
    assistantCrackedAtTwilight = false;
    charlieKilledOnRow = -1;

    // Полностью сбрасываем персистентное состояние до дефолтного
    persistentState = JSON.parse(JSON.stringify(defaultPersistentState));

    // Сброс сессионного состояния
    sessionState = {
        fionaPasswordChangeInitiatedOnRow: -1,
        karlWarned: false,
        karlDiedInShootout: false,
        karlsKeyTakenByPlayer: false,
        vanceSecurityDisabled: false,
        chenKilledOnRow: -1,
    };
}

function initGameForScenario(id) {
    currentScenarioId = id;
    gameConfig = scenarios[id]; // Сначала устанавливаем ID, потом работаем с сохранениями

    // Сброс и загрузка состояний
    resetGameSession();
    loadPersistentState();
    renderInventory();

    // --- Специальные стартовые условия для сценариев ---

    // Обновляем UI текстами и настройками сценария
    scenarioTitleDisplay.innerText = gameConfig.name;
    targetHeader.innerText = t("system.bossHeader");
    bossLabel.innerText = t("system.bossLabelClosed");
    bossLabel.style.display = 'none';
    targetHeader.style.display = 'block';
    bossTrigger.classList.remove('final-active');

    footerLeft.innerText = t("system.footerLeft");
    footerRight.innerText = t("system.footerRight");

    // Очищаем терминал
    terminal.innerHTML = '';
    addLog(t("common.bootMessage"), "text-zinc-500");

    // Устанавливаем начальное состояние без сдвига хода
    const tIdx = 3 - currentRow;
    timeDisplay.innerText = TIMES[tIdx];
    timeDisplay.style.color = TIME_COLORS[tIdx];
    stepInfo.innerText = `ЭТАП: ${tIdx + 1} / 4`;
    renderGrid();
}

const scenarios = {
    'echoes': {
        locNames: ["Лаборатория", "Логово Хакера", "Улицы", "База"],
        name: "Echoes of 80s",
        targetKeys: ["H", "F", "K", "C"],
    },
    'ghost': {
        locNames: ["Корп-Башня", "Дата-Центр", "Клиника", "Архив"],
        name: "Призрак в машине",
        targetKeys: ["V", "B", "C", "D"],
    }
};

window.onload = () => {
    // --- Инициализация кнопок и модальных окон ---
    // Переносим поиск всех элементов сюда, чтобы гарантировать, что DOM загружен
    scenarioSelectModal = document.getElementById('scenario-select-modal');
    scenarioList = document.getElementById('scenario-list');
    changeScenarioBtn = document.getElementById('change-scenario-btn');
    grid = document.getElementById('grid');
    terminal = document.getElementById('terminal-content');
    timeDisplay = document.getElementById('time-display');
    stepInfo = document.getElementById('step-info');
    scenarioTitleDisplay = document.getElementById('scenario-title-display');
    modal = document.getElementById('game-modal');
    modalText = document.getElementById('modal-text');
    modalTitle = document.getElementById('modal-title');
    modalButton = document.getElementById('modal-button');
    bossTrigger = document.getElementById('boss-trigger');
    bossLabel = document.getElementById('boss-label');
    targetHeader = document.getElementById('target-header');
    footerLeft = document.getElementById('footer-left');
    footerRight = document.getElementById('footer-right');
    emergencyMessage = document.getElementById('emergency-message');
    resetCycleBtn = document.getElementById('reset-cycle-btn');
    resetConfirmModal = document.getElementById('reset-confirm-modal');
    resetConfirmTitle = document.getElementById('reset-confirm-title');
    resetConfirmText = document.getElementById('reset-confirm-text');
    resetConfirmYes = document.getElementById('reset-confirm-yes');
    resetConfirmNo = document.getElementById('reset-confirm-no');
    inventoryDisplay = document.getElementById('inventory-display');
    inventoryItems = document.getElementById('inventory-items');
    debugWipeBtn = document.getElementById('debug-wipe-btn');
    musicToggleBtn = document.getElementById('music-toggle-btn');
    
    // Выбор сценария
    scenarioList.addEventListener('click', (e) => {
        const button = e.target.closest('button[data-scenario-id]');
        if (!button) return;

        const scenarioId = button.dataset.scenarioId;

        // Принудительно очищаем сохранение для выбранного сценария перед запуском
        localStorage.removeItem(`echoesOf80s_save_${scenarioId}`);

        scenarioSelectModal.style.display = 'none';
        initGameForScenario(scenarioId);
    });

    resetCycleBtn.onclick = () => {
        // Передаем ID текущего сценария в кнопку подтверждения
        resetConfirmYes.dataset.scenarioId = currentScenarioId;
        resetConfirmModal.style.display = "flex";
    };
    resetConfirmYes.onclick = () => {
        soundManager.playEffect('cycle_reset');
        setTimeout(() => {
            // Перезапускаем текущий сценарий, не перезагружая страницу
            initGameForScenario(currentScenarioId);
            resetConfirmModal.style.display = "none";
        }, 300);
    };
    resetConfirmNo.onclick = () => { resetConfirmModal.style.display = "none"; };

    modalButton.onclick = () => {
        // При проигрыше перезапускаем текущий сценарий
        initGameForScenario(currentScenarioId);
        modal.style.display = "none";
    };

    // --- DEBUG ---
    debugWipeBtn.onclick = () => {
        localStorage.removeItem(getSaveKey());
        location.reload();
    };

    // Настраиваем кнопки управления
    setupAudioControls();

    // Устанавливаем заголовки модальных окон
    modalTitle.innerText = t("common.modalFailureTitle");
    // Инициализируем тексты, которые не зависят от сценария
    emergencyMessage.innerText = t("common.emergencyMessage");
    resetCycleBtn.innerText = t("common.resetCycleButton");
    resetConfirmTitle.innerText = t("common.resetConfirmTitle");
    resetConfirmText.innerText = t("common.resetConfirmText");
    resetConfirmYes.innerText = t("common.resetConfirmYes");
    resetConfirmNo.innerText = t("common.resetConfirmNo");

    // Устанавливаем заголовок по умолчанию при первой загрузке
    scenarioTitleDisplay.innerText = scenarios[currentScenarioId].name;

    // Запускаем фоновую музыку
    soundManager.playAmbiance();

    // По умолчанию ничего не запускаем, ждем выбора сценария
};
