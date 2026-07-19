// Auto-derived from Bubble_Hex_Voice_Lines_Manifest.csv — 89 spoken lines split by category.
export type VoiceCategory =
    "startScreen"
  | "playerTaunt"
  | "enemyTaunt"
  | "enemyTrapped"
  | "chainReaction"
  | "doubleJumpReady"
  | "rapidFireActivated"
  | "bubbleRangeIncreased"
  | "secretRoomNearby"
  | "treasureDetected"
  | "checkpointApproaching"
  | "checkpointRestored"
  | "abilityCharged"
  | "shieldWeakening"
  | "timeRunningOut"
  | "dangerAmbient"
  | "projectileIncoming"
  | "bossArmourBroken"
  | "finalPhase"
  | "playerDamage"
  | "lowHealth"
  | "bossArrival"
  | "victoryCampaign"
  | "checkpointSecured"
  | "perfectChain"
  | "secretFound"
  | "bossBubbled"
  | "deathRestart"
  | "finalSecret"
;

export type VoiceLine = { url: string; text: string };

export const VOICE_LINES: Record<VoiceCategory, VoiceLine[]> = {
  startScreen: [
    { url: "/game/audio/voice/01_START_SCREEN_Come_on_bubble_boy_Press_start.mp3", text: "Come on, bubble boy. Press start." },
    { url: "/game/audio/voice/02_START_SCREEN_The_Hex_is_awake.mp3", text: "The Hex is awake." },
    { url: "/game/audio/voice/03_START_SCREEN_One_hero_Hundreds_of_monsters_Seems_fair.mp3", text: "One hero. Hundreds of monsters. Seems fair." },
    { url: "/game/audio/voice/04_START_SCREEN_Insert_courage.mp3", text: "Insert courage." },
    { url: "/game/audio/voice/05_START_SCREEN_Ready_to_make_a_mess.mp3", text: "Ready to make a mess?" },
  ],
  playerTaunt: [
    { url: "/game/audio/voice/06_PLAYER_TAUNT_Catch_this.mp3", text: "Catch this!" },
    { url: "/game/audio/voice/07_PLAYER_TAUNT_Bubble_trouble.mp3", text: "Bubble trouble!" },
    { url: "/game/audio/voice/08_PLAYER_TAUNT_Too_slow_glow_worm.mp3", text: "Too slow, glow-worm!" },
    { url: "/game/audio/voice/09_PLAYER_TAUNT_You_call_that_an_attack.mp3", text: "You call that an attack?" },
    { url: "/game/audio/voice/10_PLAYER_TAUNT_Pop_goes_the_ugly.mp3", text: "Pop goes the ugly!" },
    { url: "/game/audio/voice/11_PLAYER_TAUNT_Back_in_your_bubble.mp3", text: "Back in your bubble!" },
    { url: "/game/audio/voice/12_PLAYER_TAUNT_Hex_this.mp3", text: "Hex this!" },
    { url: "/game/audio/voice/13_PLAYER_TAUNT_Bounce_blast_goodbye.mp3", text: "Bounce, blast, goodbye!" },
    { url: "/game/audio/voice/14_PLAYER_TAUNT_Shouldve_stayed_in_the_cave.mp3", text: "Should’ve stayed in the cave!" },
    { url: "/game/audio/voice/15_PLAYER_TAUNT_Look_out_below.mp3", text: "Look out below!" },
    { url: "/game/audio/voice/16_PLAYER_TAUNT_Nice_projectile_Mines_bubblier.mp3", text: "Nice projectile. Mine’s bubblier." },
    { url: "/game/audio/voice/17_PLAYER_TAUNT_Was_that_supposed_to_hurt.mp3", text: "Was that supposed to hurt?" },
    { url: "/game/audio/voice/18_PLAYER_TAUNT_Consider_yourself_contained.mp3", text: "Consider yourself contained." },
    { url: "/game/audio/voice/19_PLAYER_TAUNT_Pop_first_Ask_questions_never.mp3", text: "Pop first. Ask questions never." },
  ],
  enemyTaunt: [
    { url: "/game/audio/voice/20_ENEMY_TAUNT_Little_bubble_little_chance.mp3", text: "Little bubble… little chance." },
    { url: "/game/audio/voice/21_ENEMY_TAUNT_You_cannot_climb_forever.mp3", text: "You cannot climb forever." },
    { url: "/game/audio/voice/22_ENEMY_TAUNT_We_learned_your_jumps.mp3", text: "We learned your jumps." },
    { url: "/game/audio/voice/23_ENEMY_TAUNT_Every_bubble_eventually_bursts.mp3", text: "Every bubble eventually bursts." },
    { url: "/game/audio/voice/24_ENEMY_TAUNT_Come_closer_tiny_hero.mp3", text: "Come closer, tiny hero." },
    { url: "/game/audio/voice/25_ENEMY_TAUNT_The_checkpoint_will_not_save_you.mp3", text: "The checkpoint will not save you." },
    { url: "/game/audio/voice/26_ENEMY_TAUNT_You_are_already_inside_the_Hex.mp3", text: "You are already inside the Hex." },
    { url: "/game/audio/voice/27_ENEMY_TAUNT_Run_bounce_struggleit_changes_nothing.mp3", text: "Run, bounce, struggle—it changes nothing." },
    { url: "/game/audio/voice/28_ENEMY_TAUNT_We_have_been_waiting.mp3", text: "We have been waiting." },
    { url: "/game/audio/voice/29_ENEMY_TAUNT_Your_fear_makes_us_stronger.mp3", text: "Your fear makes us stronger." },
  ],
  enemyTrapped: [
    { url: "/game/audio/voice/30_GAMEPLAY_CALLOUT_Enemy_trapped.mp3", text: "Enemy trapped!" },
  ],
  chainReaction: [
    { url: "/game/audio/voice/31_GAMEPLAY_CALLOUT_Chain_reaction.mp3", text: "Chain reaction!" },
  ],
  doubleJumpReady: [
    { url: "/game/audio/voice/32_GAMEPLAY_CALLOUT_Double_jump_ready.mp3", text: "Double jump ready!" },
  ],
  rapidFireActivated: [
    { url: "/game/audio/voice/33_GAMEPLAY_CALLOUT_Rapid_fire_activated.mp3", text: "Rapid fire activated!" },
  ],
  bubbleRangeIncreased: [
    { url: "/game/audio/voice/34_GAMEPLAY_CALLOUT_Bubble_range_increased.mp3", text: "Bubble range increased!" },
  ],
  secretRoomNearby: [
    { url: "/game/audio/voice/35_GAMEPLAY_CALLOUT_Secret_room_nearby.mp3", text: "Secret room nearby." },
  ],
  treasureDetected: [
    { url: "/game/audio/voice/36_GAMEPLAY_CALLOUT_Treasure_detected.mp3", text: "Treasure detected." },
  ],
  checkpointApproaching: [
    { url: "/game/audio/voice/37_GAMEPLAY_CALLOUT_Checkpoint_approaching.mp3", text: "Checkpoint approaching." },
  ],
  checkpointRestored: [
    { url: "/game/audio/voice/38_GAMEPLAY_CALLOUT_Checkpoint_restored.mp3", text: "Checkpoint restored!" },
  ],
  abilityCharged: [
    { url: "/game/audio/voice/39_GAMEPLAY_CALLOUT_Ability_charged.mp3", text: "Ability charged!" },
  ],
  shieldWeakening: [
    { url: "/game/audio/voice/40_GAMEPLAY_CALLOUT_Shield_weakening.mp3", text: "Shield weakening!" },
  ],
  timeRunningOut: [
    { url: "/game/audio/voice/41_GAMEPLAY_CALLOUT_Time_running_out.mp3", text: "Time running out!" },
  ],
  dangerAmbient: [
    { url: "/game/audio/voice/42_GAMEPLAY_CALLOUT_Danger_above.mp3", text: "Danger above!" },
    { url: "/game/audio/voice/44_GAMEPLAY_CALLOUT_Floor_collapsing.mp3", text: "Floor collapsing!" },
  ],
  projectileIncoming: [
    { url: "/game/audio/voice/43_GAMEPLAY_CALLOUT_Projectile_incoming.mp3", text: "Projectile incoming!" },
  ],
  bossArmourBroken: [
    { url: "/game/audio/voice/45_GAMEPLAY_CALLOUT_Boss_armour_broken.mp3", text: "Boss armour broken!" },
  ],
  finalPhase: [
    { url: "/game/audio/voice/46_GAMEPLAY_CALLOUT_Final_phase.mp3", text: "Final phase!" },
  ],
  playerDamage: [
    { url: "/game/audio/voice/47_PLAYER_DAMAGE_Ow_Rude.mp3", text: "Ow! Rude!" },
    { url: "/game/audio/voice/48_PLAYER_DAMAGE_That_one_counted.mp3", text: "That one counted." },
    { url: "/game/audio/voice/49_PLAYER_DAMAGE_I_meant_to_do_that.mp3", text: "I meant to do that." },
    { url: "/game/audio/voice/50_PLAYER_DAMAGE_Still_bubbling.mp3", text: "Still bubbling!" },
    { url: "/game/audio/voice/51_PLAYER_DAMAGE_Okay_now_Im_annoyed.mp3", text: "Okay… now I’m annoyed." },
    { url: "/game/audio/voice/52_PLAYER_DAMAGE_Tiny_setback.mp3", text: "Tiny setback!" },
    { url: "/game/audio/voice/53_PLAYER_DAMAGE_Bubble_integrity_questionable.mp3", text: "Bubble integrity questionable!" },
  ],
  lowHealth: [
    { url: "/game/audio/voice/54_LOW_HEALTH_Warning_last_bubble.mp3", text: "Warning: last bubble." },
    { url: "/game/audio/voice/55_LOW_HEALTH_Hero_integrity_critical.mp3", text: "Hero integrity critical." },
    { url: "/game/audio/voice/56_LOW_HEALTH_One_more_hit_will_end_the_run.mp3", text: "One more hit will end the run." },
    { url: "/game/audio/voice/57_LOW_HEALTH_Find_cover_Find_courage_Find_something.mp3", text: "Find cover. Find courage. Find something!" },
    { url: "/game/audio/voice/58_LOW_HEALTH_Do_not_let_the_last_bubble_burst.mp3", text: "Do not let the last bubble burst." },
  ],
  bossArrival: [
    { url: "/game/audio/voice/59_BOSS_ARRIVAL_HEX_GUARDIAN_DETECTED.mp3", text: "HEX GUARDIAN DETECTED." },
    { url: "/game/audio/voice/60_BOSS_ARRIVAL_Large_monster_Small_arena_Bad_combination.mp3", text: "Large monster. Small arena. Bad combination." },
    { url: "/game/audio/voice/61_BOSS_ARRIVAL_Boss_battle_initiated.mp3", text: "Boss battle initiated." },
    { url: "/game/audio/voice/62_BOSS_ARRIVAL_Survival_probability_unavailable.mp3", text: "Survival probability unavailable." },
    { url: "/game/audio/voice/63_BOSS_ARRIVAL_The_Guardian_has_awakened.mp3", text: "The Guardian has awakened." },
    { url: "/game/audio/voice/64_BOSS_ARRIVAL_Break_the_armour.mp3", text: "Break the armour!" },
    { url: "/game/audio/voice/65_BOSS_ARRIVAL_Watch_the_mouth.mp3", text: "Watch the mouth!" },
    { url: "/game/audio/voice/66_BOSS_ARRIVAL_Jump_NOW.mp3", text: "Jump… NOW!" },
  ],
  victoryCampaign: [
    { url: "/game/audio/voice/67_VICTORY_HEX_CLEARED.mp3", text: "HEX CLEARED!" },
    { url: "/game/audio/voice/68_VICTORY_Monster_population_dramatically_reduced.mp3", text: "Monster population: dramatically reduced." },
    { url: "/game/audio/voice/73_VICTORY_That_is_how_you_pop_a_nightmare.mp3", text: "That is how you pop a nightmare." },
  ],
  checkpointSecured: [
    { url: "/game/audio/voice/69_VICTORY_Checkpoint_secured.mp3", text: "Checkpoint secured!" },
  ],
  perfectChain: [
    { url: "/game/audio/voice/70_VICTORY_Perfect_chain.mp3", text: "Perfect chain!" },
  ],
  secretFound: [
    { url: "/game/audio/voice/71_VICTORY_Kingdom_fragment_restored.mp3", text: "Kingdom fragment restored!" },
    { url: "/game/audio/voice/81_SECRET_The_wall_is_lying.mp3", text: "The wall is lying." },
    { url: "/game/audio/voice/82_SECRET_There_is_something_beneath_this_level.mp3", text: "There is something beneath this level." },
    { url: "/game/audio/voice/83_SECRET_Not_every_enemy_wants_to_fight.mp3", text: "Not every enemy wants to fight." },
    { url: "/game/audio/voice/84_SECRET_The_bubbles_remember_the_old_kingdom.mp3", text: "The bubbles remember the old kingdom." },
    { url: "/game/audio/voice/85_SECRET_You_have_been_here_before.mp3", text: "You have been here before." },
    { url: "/game/audio/voice/86_SECRET_The_Hex_is_watching_the_player.mp3", text: "The Hex is watching the player." },
    { url: "/game/audio/voice/87_SECRET_Do_not_trust_the_final_door.mp3", text: "Do not trust the final door." },
  ],
  bossBubbled: [
    { url: "/game/audio/voice/72_VICTORY_Boss_bubbled.mp3", text: "Boss bubbled!" },
  ],
  deathRestart: [
    { url: "/game/audio/voice/74_DEATH_RESTART_The_last_bubble_burst.mp3", text: "The last bubble burst." },
    { url: "/game/audio/voice/75_DEATH_RESTART_Good_attempt_Terrible_landing.mp3", text: "Good attempt. Terrible landing." },
    { url: "/game/audio/voice/76_DEATH_RESTART_The_Hex_remembers.mp3", text: "The Hex remembers." },
    { url: "/game/audio/voice/77_DEATH_RESTART_Try_again_bubble_boy.mp3", text: "Try again, bubble boy." },
    { url: "/game/audio/voice/78_DEATH_RESTART_Failure_collected.mp3", text: "Failure collected." },
    { url: "/game/audio/voice/79_DEATH_RESTART_You_nearly_looked_heroic.mp3", text: "You nearly looked heroic." },
    { url: "/game/audio/voice/80_DEATH_RESTART_Press_start_Fix_your_mistake.mp3", text: "Press start. Fix your mistake." },
  ],
  finalSecret: [
    { url: "/game/audio/voice/88_FINAL_SECRET_You_thought_you_were_playing_the_Hex.mp3", text: "You thought you were playing the Hex?" },
    { url: "/game/audio/voice/89_FINAL_SECRET_The_Hex_has_been_playing_you.mp3", text: "The Hex has been playing you." },
  ],
};
