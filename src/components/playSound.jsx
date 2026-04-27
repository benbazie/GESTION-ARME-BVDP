// src/utils/sound.js
import { Howl } from "howler";

/**
 * Joue un son depuis un chemin donné.
 *
 * @param {string} src — URL ou chemin relatif vers le fichier audio.
 * @param {object} [options]
 * @param {number} [options.volume=1] — Volume entre 0 et 1.
 * @param {boolean} [options.loop=false] — Si true, le son est en boucle.
 * @returns {Promise<HTMLAudioElement|Howl>} — L’instance Audio ou Howl.
 */
export async function playSound(
  src,
  { volume = 1, loop = false } = {}
) {
  if (!src) {
    console.warn("playSound: src manquant");
    return;
  }

  // 1. Essayer avec l’API standard HTMLAudioElement
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.loop = loop;

    // Attendre que le son se lance (nécessaire sur certains navigateurs)
    await audio.play();
    return audio;
  } catch (err) {
    console.warn("playSound: HTMLAudioElement a échoué, fallback sur Howler", err);
  }

  // 2. Fallback : Howler.js
  const sound = new Howl({
    src: [src],
    volume,
    loop
  });
  sound.play();
  return sound;
}
