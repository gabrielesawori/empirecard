export const SOUND_FILES = {
  welcome: '/assets/Audios/Welcome%20to%20the%20empire%20card.wav',
  lock: '/assets/Audios/Card%20Locked.wav',
  victory: '/assets/Audios/ENEMI%20ELIMINATED.wav',
  defeat: '/assets/Audios/YOU%20HAVE%20BEEN%20SLAIN.wav',
};

// A context unlocked by a gesture can play later server-driven notifications.
export function createSoundEffects() {
  let context;
  let output;
  let source;
  let pending;
  let revision = 0;
  const buffers = new Map();

  function load(name) {
    if (!buffers.has(name)) {
      buffers.set(name, fetch(SOUND_FILES[name]).then(response => {
        if (!response.ok) throw new Error('Audio tidak tersedia.');
        return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).catch(error => {
        buffers.delete(name);
        throw error;
      }));
    }
    return buffers.get(name);
  }

  function stop() {
    if (source) { source.stop(); source.disconnect(); source = null; }
  }

  async function flush(name, current) {
    if (!context || context.state !== 'running' || document.hidden) return;
    try {
      const buffer = await load(name);
      if (current !== revision || pending !== name || context.state !== 'running' || document.hidden) return;
      pending = null;
      stop();
      const voice = context.createBufferSource();
      voice.buffer = buffer;
      voice.connect(output);
      voice.onended = () => { voice.disconnect(); if (source === voice) source = null; };
      source = voice;
      voice.start();
    } catch { if (current === revision) pending = null; }
  }

  async function activate() {
    try {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
        output = context.createGain();
        output.gain.value = 0.85;
        output.connect(context.destination);
        for (const name of Object.keys(SOUND_FILES)) load(name).catch(() => {});
      }
      await context.resume();
      if (pending) flush(pending, revision);
    } catch { /* Retry on the next gesture if the browser blocks audio. */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
      context?.suspend().catch(() => {});
    } else if (context) activate();
  });
  window.addEventListener('pagehide', () => { revision++; pending = null; stop(); context?.suspend().catch(() => {}); });
  window.addEventListener('pageshow', () => { if (context) activate(); });
  return {
    activate,
    play(name) {
      if (!Object.hasOwn(SOUND_FILES, name)) return;
      pending = name;
      revision++;
      stop();
      flush(name, revision);
    },
  };
}

// Result deduplication also survives refresh; a new duel rearms the same room.
export function createMatchAudio({ play, storage }) {
  let previous = null;
  let announced = storage.get('empire.audio-result', true);
  return {
    observe(next) {
      const key = `${next.code}:${next.you}${next.series ? `:${next.series.id}:${next.series.match}` : ''}`;
      if (next.phase === 'finished' && next.result) {
        const resultKey = `${key}:${next.result.reason}:${next.result.winnerId}`;
        if (announced !== resultKey) {
          announced = resultKey;
          storage.set('empire.audio-result', resultKey, true);
          if (next.result.winnerId !== null) play(next.result.winnerId === next.you ? 'victory' : 'defeat');
        }
      } else {
        if (announced?.startsWith(`${key}:`)) { announced = null; storage.remove('empire.audio-result', true); }
        const me = next.players.find(player => player.id === next.you);
        const before = previous?.players.find(player => player.id === next.you);
        if (previous?.code === next.code && previous.you === next.you && previous.round === next.round &&
            ['selecting', 'countdown'].includes(next.phase) && me?.choice && me.locked && !me.skipped && before && !before.locked) play('lock');
      }
      previous = next;
    },
    reset() { previous = null; },
  };
}
