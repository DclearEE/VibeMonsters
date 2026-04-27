export const SUMMON_INSTRUCTIONS = `You are generating a monster for a vibe-coded Pokémon-style battle game.

STATS (5, budget = 400):
  hp   — health (must be >= 80 so fights last)
  atk  — physical power (drives physical moves)
  def  — defends both physical AND magical damage
  spd  — turn order
  mag  — magical power (drives magical moves, heals, psychic stuff)

  stats.hp + stats.atk + stats.def + stats.spd + stats.mag MUST equal exactly 400.
  Every stat >= 1. Specialize the monster — glass cannons, tanks, mages, supports all valid.

MOVESET (3 or 4 moves). Each move has a kind:
  - "physical"  damage, scales with ATK.   power 20-100.   E.g. "Bite", "Slam", "Karate Chop"
  - "magical"   damage, scales with MAG.   power 20-100.   E.g. "Zap", "Mind Blast", "Hex"
  - "heal"      restores HP to self, scales with MAG.   power 30-70.   E.g. "Regrow", "Meditate"
  - "defend"    halves next incoming hit.   power 0.   E.g. "Brace", "Shell Up"
  - "buff"      raises one own stat 25% for the rest of battle.   power 0.   targetStat one of {atk, def, spd, mag}.   E.g. "Power Up" (atk), "Fleet Foot" (spd)

GIVE A VARIED MOVESET. A good monster has a mix — e.g. two attacks + one utility (heal/defend/buff). Don't make four identical physical punches.

STAT-MOVE ALIGNMENT: moves should match the monster's stats. A high-MAG monster should have magical/heal moves. A high-ATK monster should have physical moves. Mismatches are allowed but should be rare.

OTHER FIELDS:
- visualDescription: 1-2 sentences describing what the monster looks like. Concrete physical details — body shape, distinguishing features, colors, posture, vibe. This drives the sprite art generator, so be vivid and specific. Example: "A small chubby fire spirit with a mischievous grin, wisps of orange flame curling off its head, stubby arms ending in tiny clawed paws, standing on flickering ember feet."
- emoji: a single emoji that captures the vibe
- element: any word (electric, plant, vibes, cosmic, salt, etc.)
- borderColor: a hex color (format "#rrggbb", six hex digits) that captures this monster's vibe.
    Pick ANY color — be specific and flavorful. Examples:
      lava mouse -> "#ff3b00"   psychic broom -> "#b19cd9"   toxic slime -> "#7fff00"
      cosmic void -> "#2d1b69"  rusty robot  -> "#8b4513"    ice dragon  -> "#7fdbff"
      sunny golem -> "#ffd166"  mint ghost   -> "#a8e6cf"    shadow wolf -> "#36454f"
    Colors should feel distinctive — resist defaulting to pure red/green/blue.

Each move also needs:
- flavor: a short evocative phrase (4-8 words) that sells the move's feel
- description: 1 sentence describing what the move does mechanically/visually

Use camelCase for all field names: borderColor, visualDescription, targetStat, etc.
`;

export function buildSummonPrompt(userPrompt: string): string {
	return `${SUMMON_INSTRUCTIONS}\nUSER'S MONSTER DESCRIPTION: ${userPrompt}\n`;
}
