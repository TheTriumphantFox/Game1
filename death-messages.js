// Death messages. One table of 100 short lines, grouped by how the hero died, read
// by respawn (player.js) with the kind passed to it plus, for a creature, the name
// of the thing that landed the hit. Lines say what and how, never where: the game
// knows nothing about the scenery at the moment of death.

const DEATH_MESSAGES = {
  melee: [
    '{Killer} struck you down where you stood.',
    '{Killer} cut you down.',
    '{Killer} overpowered you.',
    '{Killer} felled you with a single blow.',
    '{Killer} beat you in a short, hard fight.',
    '{Killer} brought you to the ground and finished you.',
    '{Killer} hunted you down and finished you.',
    '{Killer} wore you down and finished you.',
    '{Killer} caught you with your guard down.',
    '{Killer} broke through your guard.',
    '{Killer} laid you low.',
    '{Killer} ran you down.',
    '{Killer} landed the final blow on you.',
    '{Killer} was too much for you.',
    '{Killer} hit you one time too many.',
    '{Killer} knocked the last of the fight out of you.',
    '{Killer} got in close and ended you.',
    '{Killer} left you where you fell.',
    '{Killer} finished you off.',
    '{Killer} ended you with one last strike.',
    '{Killer} ended your journey up close.',
    'You never saw {killer} move.',
    'You turned a step too late for {killer}.',
    'You gave ground and {killer} took it all.',
    'You stood fast and {killer} was faster.',
    'You fell to {killer} in close combat.',
  ],
  shot: [
    '{Killer} shot you from a distance.',
    '{Killer} shot you before you could close in.',
    '{Killer} shot you down from afar.',
    '{Killer} shot you and you did not get up.',
    '{Killer} fired from afar and you dropped.',
    '{Killer} shot you out of nowhere.',
    'You never got close before {killer} shot you.',
    '{Killer} fired from range and you fell.',
    '{Killer} fired from afar and found you.',
    '{Killer} fired a bolt through your guard.',
    '{Killer} sent a bolt into your chest.',
    '{Killer} loosed a missile and struck you.',
    '{Killer} kept its aim on you and fired.',
    '{Killer} took aim and shot you where you stood.',
    'You ran out of luck when {killer} fired.',
    'A bolt from {killer} found your throat.',
    'A projectile from {killer} struck you mid-step.',
    '{Killer} shot you from range before you could run.',
  ],
  breath: [
    '{Killer} bathed you in fire.',
    '{Killer} caught you in a cone of fire.',
    '{Killer} scorched you with a breath of fire.',
    '{Killer} burned you where its breath found you.',
    '{Killer} wrapped you in its flame.',
    '{Killer} met you with a wall of flame.',
    '{Killer} drowned you in flame.',
    '{Killer} breathed fire and you burned.',
  ],
  spores: [
    'The spores of {killer} took you where you stood.',
    'You breathed in the spores of {killer} and fell.',
    '{Killer} filled the air with spores and you with them.',
    '{Killer} choked you with a cloud of spores.',
    '{Killer} took you in a burst of spores.',
  ],
  bomb: [
    'Your own bomb went off too close and took you.',
    'Your own bomb landed too close to you.',
    'Your own bomb caught you inside the blast.',
    'You threw your own bomb too short and the blast took you.',
    'You stood too close to your own bomb blast.',
    'Your own bomb burst and you took the full blast.',
    'Your own bomb burst before you got clear.',
  ],
  miasma: [
    'The miasma filled you and you fell.',
    'You breathed the miasma too long.',
    'The toxic air closed over you.',
    'Poison fumes took you where you stood.',
    'The poison in the fumes took your breath.',
    'The miasma ate away at you until you fell.',
  ],
  heat: [
    'The heat took you where you stood.',
    'The heat built in you until you fell.',
    'You could not shed the heat and you fell.',
    'The heat dried you out and stopped you.',
    'Heat filled you and left you on the ground.',
    'You pushed on until the heat dropped you.',
  ],
  quicksand: [
    'The quicksand pulled you under.',
    'The sand closed over you and you stopped.',
    'You sank into the sand and did not come up.',
    'The sand took you to the bottom.',
    'You went under the sand where you stood.',
    'The sand filled your mouth and you sank.',
  ],
  lightning: [
    'A lightning bolt took you where you stood.',
    'The storm struck you and you did not rise.',
    'Lightning found you in the open.',
    'A bolt from the storm ended you.',
    'Lightning went through you and out again.',
    'The storm caught you with a bolt of lightning.',
  ],
  cursed: [
    'The cursed ground drained you and you fell.',
    'The curse in the ground took your strength.',
    'Cursed earth drank you where you stood.',
    'You walked the cursed ground and it kept you.',
    'The curse took your legs and then you.',
    'Cursed ground wore you down to nothing.',
  ],
  whirlpool: [
    'The whirlpool dragged you under.',
    'The whirlpool took you down and held you.',
    'The whirlpool pulled you down and you stopped.',
  ],
  shrine: [
    'The shrine trial ended you where you stood.',
    'The shrine trap caught you and you fell.',
    'A hazard in the trial finished you.',
  ],
};

// How a creature's name reads in a sentence.
function deathKillerName(raw) {
  if (!raw) return 'something';
  let name = String(raw).split(',')[0].trim();   // drop ", Guild Quarry", ", the Man-Eater"
  if (/^\w+' /.test(name)) return name;          // "Hendricks' Dog" takes no article
  if (name === name.toUpperCase()) {             // bosses are stored in capitals
    name = name.split(' ').map(w => w === 'OF' ? 'of' : w[0] + w.slice(1).toLowerCase()).join(' ');
  }
  return 'the ' + name;
}

let lastDeathLine = null;
function deathMessage(kind, killerName) {
  const pool = DEATH_MESSAGES[kind];
  if (!pool) return 'You died.';
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && line === lastDeathLine) line = pool[(pool.indexOf(line) + 1) % pool.length];
  lastDeathLine = line;
  const who = deathKillerName(killerName);
  return line.replace('{killer}', who)
             .replace('{Killer}', who[0].toUpperCase() + who.slice(1));
}
