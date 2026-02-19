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

const LOC_NAMES = ["Лаборатория", "Логово Хакера", "Улицы", "База"];
const TIMES = ["ДЕНЬ", "СУМЕРКИ", "ВЕЧЕР", "НОЧЬ"];
const TIME_CLASSES = ["day", "twilight", "evening", "night"];
const TIME_COLORS = ["#fbbf24", "#f97316", "#a855f7", "#3b82f6"];

let currentRow = 3;
let killed = { H: false, F: false, K: false, C: false };
let playerPath = []; // Новый массив для отслеживания пути игрока
let killLocations = [];
let hasLabCode = false;
let isGameOver = false;
let cycleFinished = false;
let charlieInfoRevealed = false;
let assistantCrackedAtTwilight = false;
let charlieKilledOnRow = -1; // -1 означает, что Чарли еще жив или убит не на прошлом ходу

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
        // Остальные локации пусты
    } else {
        // Стандартное расписание
        if (locIdx === 0 && (time === "ДЕНЬ" || time === "СУМЕРКИ" || time === "ВЕЧЕР")) enemies.push("H");
        if (locIdx === 1) {
            if (time === "СУМЕРКИ" || time === "ВЕЧЕР") enemies.push("F");
            if (time === "СУМЕРКИ") enemies.push("K");
        }
        if (locIdx === 2 && time !== "СУМЕРКИ") enemies.push("K");
        if (locIdx === 3 && (time === "ДЕНЬ" || time === "НОЧЬ")) enemies.push("C");
    }
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
                content += `<span class="player-avatar">👤</span>`;
            }
            
            const wasKillHere = killLocations.find(k => k.row === r && k.loc === c);
            if (wasKillHere) {
                content += `<span class="skull-icon">💀</span>`;
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
        modalTitle.innerText = t("system.protocolDoneTitle");
        modalTitle.style.color = "#00ff41";
        modalTitle.className = "text-3xl font-black mb-4 uppercase";
        modalText.innerText = t("system.bossAllKilledText");
        modal.style.display = "flex";
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
}

function updateKillStatus(target, row, loc) {
    killed[target] = true;
    killLocations.push({ row, loc });
    if (target === 'C') charlieKilledOnRow = row;
    document.getElementById(`key-${target}`).classList.add('active');
}

function processMove(r, c) {
    if (isGameOver || cycleFinished) return;
    const timeIdx = 3 - r;
    const currentTime = TIMES[timeIdx];

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
        if (currentTime === "НОЧЬ") {
            addLog(t("lab.nightNote"), "text-zinc-400");
        } else if (charlieKilledOnRow === currentRow + 1) {
            // Если сейчас ход "мести", лаборатория пуста и открыта
            addLog(t("lab.revengeEmpty"), "text-zinc-400");
        } else {
            // Стандартная логика для лаборатории
            addLog(t("lab.dayDoor"), "text-zinc-400"); // Дверь заперта
        }
    }
    else if (c === 1) { // ЛОГОВО ХАКЕРА
        const hasFionaHere = activeEnemies.includes("F");

        if (hasFionaHere) {
            addLog(t("lair.fionaAlone"), "text-magenta-500 font-bold");
            updateKillStatus('F', r, c);
        } else if (killed.F) {
            if (currentTime === "ДЕНЬ") {
                addLog(t("lair.afterKillDay"), "text-zinc-500");
            } else {
                addLog(t("lair.afterKillOther"), "text-zinc-500");
            }
        } else {
            addLog(t("lair.pcOnly"), "text-zinc-500");
        }
    }
    else if (c === 2) { // УЛИЦЫ
        if (killed.K) {
            addLog(t("streets.kAlreadyDead"), "text-zinc-500");
        } else if (currentTime !== "СУМЕРКИ") {
            addLog(t("streets.kKilled"), "text-magenta-500 font-bold");
            updateKillStatus('K', r, c);
        } else {
            addLog(t("streets.kMissingTwilight"), "text-zinc-500");
        }
    }
    else if (c === 3) { // БАЗА
        const isCharlieTime = currentTime === "ДЕНЬ" || currentTime === "НОЧЬ";
        const isAssistantTime = currentTime === "СУМЕРКИ" || currentTime === "ВЕЧЕР";

        if (!killed.C && isCharlieTime) {
            addLog(t("base.charlieKilled"), "text-magenta-500 font-bold");
            updateKillStatus('C', r, c);
            charlieInfoRevealed = true;
        } else if (!killed.C && isAssistantTime) {
            if (assistantCrackedAtTwilight && currentTime === "ВЕЧЕР") {
                addLog(t("base.assistantEmptyEvening"), "text-zinc-500");
                nextStep();
                return;
            }
            addLog(t("base.assistantInterrogatedTwilight"), "text-zinc-500");
            charlieInfoRevealed = true;
            if (currentTime === "СУМЕРКИ") assistantCrackedAtTwilight = true;
        } else if (killed.C && isAssistantTime && !charlieInfoRevealed) {
            addLog(t("base.assistantPanic"), "text-zinc-500");
            charlieInfoRevealed = true;
        } else if (killed.C) {
            addLog(t("base.charlieAlreadyDead"), "text-zinc-500");
        } else {
            addLog(t("base.baseEmptyGeneric"), "text-zinc-500");
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

window.onload = () => {
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
    resetConfirmYes.onclick = () => { location.reload(); };
    resetConfirmNo.onclick = () => { resetConfirmModal.style.display = "none"; };

    // Рендерим поле
    renderGrid();

    // Стартовое системное сообщение в терминале
    addLog(t("system.bootMessage"), "text-zinc-500");
};