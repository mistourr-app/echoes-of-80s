// Предполагается, что звуковые файлы лежат в папке /assets/audio/

const soundManager = {
    sounds: {},
    isAmbianceMuted: false, // Состояние только для фоновой музыки

    init: function() {
        try {
            // Фоновая музыка
            this.sounds.ambiance = new Howl({
                src: ['./assets/audio/ambiance_loop.mp3'], // ИСПРАВЛЕНО: .wav -> .mp3
                loop: true,
                volume: 0.2,
                html5: true // Рекомендуется для длинных треков
            });
    
            // Звуковые эффекты (ИСПРАВЛЕНО: каждый звук - отдельный объект)
            this.sounds.ui_click = new Howl({ src: ['./assets/audio/ui_click.wav'] });
            this.sounds.kill_success = new Howl({ src: ['./assets/audio/kill_success.wav'] });
            this.sounds.info_discover = new Howl({ src: ['./assets/audio/info_discover.wav'] });
            this.sounds.game_over_fail = new Howl({ src: ['./assets/audio/game_over_fail.wav'] });
            this.sounds.game_over_victory = new Howl({ src: ['./assets/audio/game_over_victory.wav'] });
            this.sounds.cycle_reset = new Howl({ src: ['./assets/audio/cycle_reset.wav'] });
        } catch (e) {
            console.error("Ошибка инициализации звукового менеджера:", e);
            // Отключаем звук, если Howler не загрузился
            this.isAmbianceMuted = true;
        }
    },

    // ИСПРАВЛЕНО: Отдельная функция для эффектов
    playEffect: function(soundName, volume = 0.7) {
        if (!this.sounds[soundName]) return;
        this.sounds[soundName].volume(volume);
        this.sounds[soundName].play();
    },
    
    // ИСПРАВЛЕНО: Отдельная функция для фоновой музыки
    playAmbiance: function() {
        if (this.sounds.ambiance && !this.sounds.ambiance.playing()) this.sounds.ambiance.play();
    },

    toggleAmbiance: function() {
        if (!this.sounds.ambiance) return true; // Возвращаем true (выключено), если звука нет

        if (this.sounds.ambiance.playing()) {
            this.sounds.ambiance.pause();
        } else {
            this.sounds.ambiance.play();
        }
        return !this.sounds.ambiance.playing(); // Возвращаем true, если музыка НЕ играет
    }
};

// Инициализируем звуковой менеджер при загрузке скрипта
soundManager.init();