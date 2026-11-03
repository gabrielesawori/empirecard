// Load the provided soundtrack only after the player enables music.
export function createBgm() {
  let audio;
  let enabled = false;
  let pageInactive = false;
  let revision = 0;

  async function sync() {
    const current = ++revision;
    if (!enabled || document.hidden || pageInactive) {
      audio?.pause();
      return;
    }
    if (!audio) {
      audio = new Audio('/assets/Audios/BGM.mp3');
      audio.loop = true;
      audio.volume = 0.25;
      audio.preload = 'none';
    }
    try {
      await audio.play();
    } catch {
      // A later toggle or tab change can cancel a pending play request.
      if (current !== revision) return;
      throw new Error('Musik belum bisa diputar. Coba aktifkan BGM kembali.');
    }
    if (!enabled || document.hidden || pageInactive) audio.pause();
  }

  document.addEventListener('visibilitychange', () => { sync().catch(() => {}); });
  window.addEventListener('pagehide', () => { pageInactive = true; revision++; audio?.pause(); });
  window.addEventListener('pageshow', () => { pageInactive = false; sync().catch(() => {}); });
  return {
    async setEnabled(value) { enabled = value; await sync(); },
    get playing() { return enabled && Boolean(audio && !audio.paused); },
  };
}
