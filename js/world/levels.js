// Desenho das duas fases. Dificuldade pensada para uma criança de 5 anos:
// sem buracos mortais, inimigos lentos, muitas frutas e checkpoints frequentes.
import { LevelBuilder } from './level.js';

// Fase 1 — Esplanada dos Ministérios. Chefão: General Rolha (guarda o Simba).
export function buildLevel1() {
  const b = new LevelBuilder(222, 'esplanada');
  b.ground(0, 222).start(3);

  // Começo tranquilo: um inimigo só para aprender a fazer cocô.
  b.spawn('refri', 14);
  b.block(19, 9);
  b.platform(23, 7, 4).item('papaya', 25, 6);
  b.spawn('refri', 30).spawn('refri', 36);

  b.hill(40, 48, 9);
  b.spawn('cookie', 45, 9);
  b.spawn('salgadinho', 54, 10, { fly: 52 });
  b.checkpoint(58);

  b.platform(62, 8, 3).platform(66, 6, 3).item('broccoli', 67, 5);
  b.spawn('refri', 72).spawn('refri', 77).spawn('cookie', 81);
  b.block(86, 9).block(87, 8, 1, 2).block(88, 9);
  b.spawn('salgadinho', 95, 10, { fly: 60 }).spawn('refri', 99);
  b.item('water', 102);

  b.hill(105, 113, 9).spawn('cookie', 109, 9);
  b.spawn('salgadinho', 118, 10, { fly: 55 }).spawn('salgadinho', 125, 10, { fly: 70 });
  b.checkpoint(129);

  b.spawn('refri', 134).spawn('refri', 139).spawn('cookie', 143);
  b.platform(148, 7, 4).item('orange', 150, 6);
  b.spawn('salgadinho', 155, 10, { fly: 58 }).spawn('refri', 159);
  b.block(164, 9);
  b.spawn('refri', 170).spawn('cookie', 175).spawn('salgadinho', 179, 10, { fly: 62 });
  b.item('plum', 186);
  b.checkpoint(190);

  // Arena do chefão
  b.arena(202, 222);
  b.spawn('boss_rolha', 213);
  b.spawn('captive_simba', 219);
  return b.done();
}

// Fase 2 — Ponte JK e Lago Paranoá. Chefão: Constipador (prendeu a Hérica).
export function buildLevel2() {
  const b = new LevelBuilder(242, 'ponte');
  b.ground(0, 242).start(3);

  b.spawn('refri', 13).spawn('salgadinho', 18, 10, { fly: 56 });
  b.platform(21, 8, 3).platform(25, 6, 3).item('pear', 26, 5);
  b.spawn('cookie', 31).spawn('cookie', 35);

  b.hill(39, 51, 9);
  b.spawn('refri', 43, 9).spawn('refri', 48, 9);
  b.spawn('salgadinho', 56, 10, { fly: 54 }).spawn('salgadinho', 61, 10, { fly: 68 });
  b.checkpoint(65);

  b.block(69, 9).block(70, 8, 1, 2).block(71, 7, 1, 3).block(72, 9);
  b.spawn('refri', 77).spawn('refri', 81).spawn('cookie', 85);
  b.platform(89, 7, 5).item('broccoli', 91, 6);
  b.spawn('salgadinho', 93, 10, { fly: 60 });
  b.spawn('refri', 99).spawn('cookie', 103).spawn('salgadinho', 106, 10, { fly: 64 });
  b.item('water', 110);

  b.hill(113, 125, 9).spawn('cookie', 117, 9).spawn('cookie', 121, 9);
  b.checkpoint(130);

  b.spawn('salgadinho', 136, 10, { fly: 56 }).spawn('refri', 139);
  b.spawn('salgadinho', 142, 10, { fly: 70 }).spawn('refri', 146);
  b.platform(150, 8, 3).platform(155, 6, 3).platform(160, 8, 3).item('watermelon', 156, 5);
  b.spawn('refri', 168).spawn('refri', 172).spawn('cookie', 176).spawn('salgadinho', 180, 10, { fly: 60 });
  b.block(188, 9).block(193, 9);
  b.spawn('pizza', 199).spawn('refri', 203);
  b.item('apple', 208);
  b.checkpoint(211);

  b.arena(222, 242);
  b.spawn('boss_constipador', 233);
  b.spawn('captive_herica', 239);
  return b.done();
}

export const LEVELS = [
  {
    build: buildLevel1,
    name: 'FASE 1',
    title: 'ESPLANADA DOS MINISTÉRIOS',
    music: 'level1',
    bossVoice: 'boss1',
    tauntVoice: 'taunt1',
    bossName: 'GENERAL ROLHA',
  },
  {
    build: buildLevel2,
    name: 'FASE 2',
    title: 'PONTE JK',
    music: 'level2',
    bossVoice: 'boss2',
    tauntVoice: 'taunt2',
    bossName: 'CONSTIPADOR',
  },
];
