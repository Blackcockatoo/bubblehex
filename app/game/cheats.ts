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

  /** True if a cheat sequence is already mid-entry (used to suppress the "press start to
   * begin" confirmation when a Start token is really an embedded step of a code). A buffer
   * containing only Start tokens is a plain repeated/impatient press, not cheat progress. */
  hasPending(at: number): boolean {
    if (this.lastInput && at - this.lastInput > 1500) return false;
    return this.buffer.some(token => token !== "START");
  }
}

