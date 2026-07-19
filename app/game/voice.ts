/**
 * 10 of the 89 supplied "GAMEPLAY_CALLOUT" lines were dropped rather than
 * force-mapped (checkpoints, ability charge, shield "weakening", proximity
 * warnings, etc.) — BUBBLE HEX has no matching mechanic for those, so they'd
 * be barks about a system that doesn't exist. The rest of that category maps
 * one clip per event (not a random pool) since each is a singular occurrence.
 */
export type VoiceCategory =
  | "startScreen"
  | "playerTaunt"
  | "enemyTaunt"
  | "trapped"
  | "megaChain"
  | "doubleJump"
  | "rapidFire"
  | "rangeUp"
  | "hurryUp"
  | "bossArmourBroken"
  | "playerDamage"
  | "lowHealth"
  | "bossArrival"
  | "victory"
  | "deathRestart"
  | "secret"
  | "finalSecret";

const v = (name: string) => `/game/voice/${name}`;

export const VOICE_LINES: Record<VoiceCategory, string[]> = {
  startScreen: [v("01_START_SCREEN_Come_on_bubble_boy_Press_start.mp3"), v("02_START_SCREEN_The_Hex_is_awake.mp3"), v("03_START_SCREEN_One_hero_Hundreds_of_monsters_Seems_fair.mp3"), v("04_START_SCREEN_Insert_courage.mp3"), v("05_START_SCREEN_Ready_to_make_a_mess.mp3")],
  playerTaunt: [v("06_PLAYER_TAUNT_Catch_this.mp3"), v("07_PLAYER_TAUNT_Bubble_trouble.mp3"), v("08_PLAYER_TAUNT_Too_slow_glow_worm.mp3"), v("09_PLAYER_TAUNT_You_call_that_an_attack.mp3"), v("10_PLAYER_TAUNT_Pop_goes_the_ugly.mp3"), v("11_PLAYER_TAUNT_Back_in_your_bubble.mp3"), v("12_PLAYER_TAUNT_Hex_this.mp3"), v("13_PLAYER_TAUNT_Bounce_blast_goodbye.mp3"), v("14_PLAYER_TAUNT_Shouldve_stayed_in_the_cave.mp3"), v("15_PLAYER_TAUNT_Look_out_below.mp3"), v("16_PLAYER_TAUNT_Nice_projectile_Mines_bubblier.mp3"), v("17_PLAYER_TAUNT_Was_that_supposed_to_hurt.mp3"), v("18_PLAYER_TAUNT_Consider_yourself_contained.mp3"), v("19_PLAYER_TAUNT_Pop_first_Ask_questions_never.mp3")],
  enemyTaunt: [v("20_ENEMY_TAUNT_Little_bubble_little_chance.mp3"), v("21_ENEMY_TAUNT_You_cannot_climb_forever.mp3"), v("22_ENEMY_TAUNT_We_learned_your_jumps.mp3"), v("23_ENEMY_TAUNT_Every_bubble_eventually_bursts.mp3"), v("24_ENEMY_TAUNT_Come_closer_tiny_hero.mp3"), v("25_ENEMY_TAUNT_The_checkpoint_will_not_save_you.mp3"), v("26_ENEMY_TAUNT_You_are_already_inside_the_Hex.mp3"), v("27_ENEMY_TAUNT_Run_bounce_struggleit_changes_nothing.mp3"), v("28_ENEMY_TAUNT_We_have_been_waiting.mp3"), v("29_ENEMY_TAUNT_Your_fear_makes_us_stronger.mp3")],
  trapped: [v("30_GAMEPLAY_CALLOUT_Enemy_trapped.mp3")],
  megaChain: [v("31_GAMEPLAY_CALLOUT_Chain_reaction.mp3")],
  doubleJump: [v("32_GAMEPLAY_CALLOUT_Double_jump_ready.mp3")],
  rapidFire: [v("33_GAMEPLAY_CALLOUT_Rapid_fire_activated.mp3")],
  rangeUp: [v("34_GAMEPLAY_CALLOUT_Bubble_range_increased.mp3")],
  hurryUp: [v("41_GAMEPLAY_CALLOUT_Time_running_out.mp3")],
  bossArmourBroken: [v("45_GAMEPLAY_CALLOUT_Boss_armour_broken.mp3")],
  playerDamage: [v("47_PLAYER_DAMAGE_Ow_Rude.mp3"), v("48_PLAYER_DAMAGE_That_one_counted.mp3"), v("49_PLAYER_DAMAGE_I_meant_to_do_that.mp3"), v("50_PLAYER_DAMAGE_Still_bubbling.mp3"), v("51_PLAYER_DAMAGE_Okay_now_Im_annoyed.mp3"), v("52_PLAYER_DAMAGE_Tiny_setback.mp3"), v("53_PLAYER_DAMAGE_Bubble_integrity_questionable.mp3")],
  lowHealth: [v("54_LOW_HEALTH_Warning_last_bubble.mp3"), v("55_LOW_HEALTH_Hero_integrity_critical.mp3"), v("56_LOW_HEALTH_One_more_hit_will_end_the_run.mp3"), v("57_LOW_HEALTH_Find_cover_Find_courage_Find_something.mp3"), v("58_LOW_HEALTH_Do_not_let_the_last_bubble_burst.mp3")],
  bossArrival: [v("59_BOSS_ARRIVAL_HEX_GUARDIAN_DETECTED.mp3"), v("60_BOSS_ARRIVAL_Large_monster_Small_arena_Bad_combination.mp3"), v("61_BOSS_ARRIVAL_Boss_battle_initiated.mp3"), v("62_BOSS_ARRIVAL_Survival_probability_unavailable.mp3"), v("63_BOSS_ARRIVAL_The_Guardian_has_awakened.mp3"), v("64_BOSS_ARRIVAL_Break_the_armour.mp3"), v("65_BOSS_ARRIVAL_Watch_the_mouth.mp3"), v("66_BOSS_ARRIVAL_Jump_NOW.mp3")],
  victory: [v("67_VICTORY_HEX_CLEARED.mp3"), v("68_VICTORY_Monster_population_dramatically_reduced.mp3"), v("69_VICTORY_Checkpoint_secured.mp3"), v("70_VICTORY_Perfect_chain.mp3"), v("71_VICTORY_Kingdom_fragment_restored.mp3"), v("72_VICTORY_Boss_bubbled.mp3"), v("73_VICTORY_That_is_how_you_pop_a_nightmare.mp3")],
  deathRestart: [v("74_DEATH_RESTART_The_last_bubble_burst.mp3"), v("75_DEATH_RESTART_Good_attempt_Terrible_landing.mp3"), v("76_DEATH_RESTART_The_Hex_remembers.mp3"), v("77_DEATH_RESTART_Try_again_bubble_boy.mp3"), v("78_DEATH_RESTART_Failure_collected.mp3"), v("79_DEATH_RESTART_You_nearly_looked_heroic.mp3"), v("80_DEATH_RESTART_Press_start_Fix_your_mistake.mp3")],
  secret: [v("81_SECRET_The_wall_is_lying.mp3"), v("82_SECRET_There_is_something_beneath_this_level.mp3"), v("83_SECRET_Not_every_enemy_wants_to_fight.mp3"), v("84_SECRET_The_bubbles_remember_the_old_kingdom.mp3"), v("85_SECRET_You_have_been_here_before.mp3"), v("86_SECRET_The_Hex_is_watching_the_player.mp3"), v("87_SECRET_Do_not_trust_the_final_door.mp3")],
  finalSecret: [v("88_FINAL_SECRET_You_thought_you_were_playing_the_Hex.mp3"), v("89_FINAL_SECRET_The_Hex_has_been_playing_you.mp3")],
};
