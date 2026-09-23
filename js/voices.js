// Falas da Hérica (voz clonada), dos vilões, e legendas.
import { audio } from './audio.js';

export const VOICES = {
  intro: {
    text: 'Miguel! O monstro Constipador raptou eu e o Simba! Você precisa fazer cocô nos monstros para destruí-los. Somente fazendo cocô você conseguirá nos salvar. Faça cocô e nos salve, Miguel!',
    // legendas sincronizadas (segundos)
    cues: [
      [0, 'MIGUEL! O MONSTRO CONSTIPADOR RAPTOU EU E O SIMBA!'],
      [4.4, 'VOCÊ PRECISA FAZER COCÔ NOS MONSTROS PARA DESTRUÍ-LOS.'],
      [8.3, 'SOMENTE FAZENDO COCÔ VOCÊ CONSEGUIRÁ NOS SALVAR.'],
      [11.6, 'FAÇA COCÔ E NOS SALVE, MIGUEL!'],
    ],
  },
  socorro: { text: 'Socorro, Miguel!' },
  boss1: { text: 'Cuidado, Miguel! É o General Rolha! Faz cocô nele pra salvar o Simba!' },
  simba: { text: 'Muito bem, Miguel! Você salvou o Simba! Agora vem me salvar!' },
  fase2: { text: 'Estou aqui, Miguel! Continua fazendo cocô nos monstros!' },
  boss2: { text: 'É o Constipador! Faz muito cocô nele, Miguel!' },
  final: {
    text: 'Você conseguiu, Miguel! Você salvou a mamãe e o Simba! Eu tenho muito orgulho de você! Eu te amo!',
    cues: [
      [0, 'VOCÊ CONSEGUIU, MIGUEL! VOCÊ SALVOU A MAMÃE E O SIMBA!'],
      [4.6, 'EU TENHO MUITO ORGULHO DE VOCÊ! EU TE AMO!'],
    ],
  },
  moral: {
    text: 'E lembra: quando der vontade, corre pro banheiro e faz cocô, tá bom? Você é o meu super-herói!',
    cues: [
      [0, 'E LEMBRA: QUANDO DER VONTADE, CORRE PRO BANHEIRO E FAZ COCÔ, TÁ BOM?'],
      [7.6, 'VOCÊ É O MEU SUPER-HERÓI!'],
    ],
  },
  retry: { text: 'Não desiste, Miguel! Tenta de novo!' },
  cheer: { text: 'Isso, Miguel! Muito bem!' },
  super: { text: 'Brócolis! Agora é super cocô!' },
  fruta: { text: 'Fruta e água ajudam a fazer cocô!' },
  // Vilões (antes da luta)
  taunt1: {
    who: 'rolha',
    text: 'Rá! Eu sou o General Rolha! Com refrigerante, pizza e batata frita, você nunca mais vai fazer cocô, Miguel! Tropa, atacar!',
    cues: [
      [0, 'RÁ! EU SOU O GENERAL ROLHA!'],
      [2.0, 'COM REFRIGERANTE, PIZZA E BATATA FRITA...'],
      [5.0, 'VOCÊ NUNCA MAIS VAI FAZER COCÔ, MIGUEL!'],
      [7.7, 'TROPA, ATACAR!'],
    ],
  },
  taunt2: {
    who: 'constipador',
    text: 'Muá há há há! Eu sou o Constipador! Com chocolate, hambúrguer e muito refrigerante, eu vou trancar o seu cocô pra sempre, Miguel!',
    cues: [
      [0, 'MUÁ-HÁ-HÁ-HÁ! EU SOU O CONSTIPADOR!'],
      [3.8, 'COM CHOCOLATE, HAMBÚRGUER E MUITO REFRIGERANTE...'],
      [6.9, 'EU VOU TRANCAR O SEU COCÔ PRA SEMPRE, MIGUEL!'],
    ],
  },
};

export function loadVoices() {
  return Promise.all(
    Object.entries(VOICES).map(([name, v]) => audio.loadVoice(name, `assets/voice/${name}.mp3`, v.text))
  );
}

// Legenda atual de uma fala, dado o tempo decorrido (s).
export function cueAt(name, t) {
  const v = VOICES[name];
  if (!v) return '';
  if (!v.cues) return v.text.toUpperCase();
  let cur = v.cues[0][1];
  for (const [at, txt] of v.cues) if (t >= at) cur = txt;
  return cur;
}

// Toca uma fala e mantém o estado para desenhar legenda + retrato.
export class Speaker {
  constructor() {
    this.name = null;
    this.t0 = 0;
    this.promise = null;
    this.onDone = null;
  }
  get speaking() {
    return this.name != null;
  }
  get who() {
    return (this.name && VOICES[this.name]?.who) || 'herica';
  }
  say(name) {
    this.name = name;
    this.t0 = performance.now();
    const p = audio.playVoice(name).then(() => {
      if (this.name === name) this.name = null;
    });
    this.promise = p;
    return p;
  }
  stop() {
    audio.stopVoice();
    this.name = null;
  }
  get text() {
    if (!this.name) return '';
    return cueAt(this.name, (performance.now() - this.t0) / 1000);
  }
}
