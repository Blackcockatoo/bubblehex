// Multiple fingers, keyboard aliases and gamepads may hold the same action.
// Releasing one source must never cancel another source's held action.
export class InputSources<Action extends string> {
  private sources = new Map<Action, Set<string>>();
  press(action: Action, source: string): boolean {
    const holders = this.sources.get(action) ?? new Set<string>();
    const first = holders.size === 0;
    holders.add(source);
    this.sources.set(action, holders);
    return first;
  }
  release(action: Action, source: string): boolean {
    const holders = this.sources.get(action);
    holders?.delete(source);
    return !!holders?.size;
  }
  clear() { this.sources.clear(); }
}
