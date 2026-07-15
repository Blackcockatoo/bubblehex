export type Token = "LEFT" | "RIGHT" | "JUMP" | "BUBBLE" | "START";
export type CheatKey = "power" | "super" | "extra";

export const CODES: Record<CheatKey, Token[]> = {
  power: ["LEFT","JUMP","LEFT","START","LEFT","BUBBLE","LEFT","START"],
  super: ["START","JUMP","BUBBLE","LEFT","RIGHT","JUMP","START","RIGHT"],
  extra: ["BUBBLE","JUMP","BUBBLE","JUMP","BUBBLE","JUMP","RIGHT","START"],
};

export const mirrorCode = (code: Token[]) => code.map(token => token === "LEFT" ? "RIGHT" : token === "RIGHT" ? "LEFT" : token) as Token[];

export class CheatReader {
  private buffer: Token[] = [];
  private lastInput = 0;

  feed(token: Token, at: number, active: Record<CheatKey, boolean>): CheatKey | null {
    if (this.lastInput && at - this.lastInput > 1500) this.buffer = [];
    this.lastInput = at;
    this.buffer.push(token);
    this.buffer = this.buffer.slice(-12);
    for (const key of Object.keys(CODES) as CheatKey[]) {
      if (active[key]) continue;
      for (const code of [CODES[key], mirrorCode(CODES[key])]) {
        if (code.every((entry, index) => this.buffer[this.buffer.length - code.length + index] === entry)) {
          this.buffer = [];
          return key;
        }
      }
    }
    return null;
  }

  reset() { this.buffer = []; this.lastInput = 0; }
}

const START_GRACE_SECONDS = 0.24;

/**
 * Every title-screen keypress that feeds the cheat reader must recompute the
 * "begin run" grace window from scratch. Codes like SUPER embed a START
 * token mid-sequence (`START,JUMP,BUBBLE,LEFT,RIGHT,JUMP,START,RIGHT`); if
 * that mid-sequence START were allowed to keep a stale grace timer ticking
 * in the background, it would fire a few frames after the code finishes
 * confirming and silently kick the player into character select right
 * after they activated the cheat.
 */
export function nextTitleStartGrace(codeJustCompleted: boolean, isStartToken: boolean): number {
  return isStartToken && !codeJustCompleted ? START_GRACE_SECONDS : 0;
}

