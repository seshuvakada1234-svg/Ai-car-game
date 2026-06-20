export class RoomCodeGenerator {
  private static activeCodes = new Set<string>();

  public static generate(): string {
    const prefixes = ['DRAGON', 'NEON', 'SPEED', 'VIPER', 'PHANTOM', 'APEX', 'CARBON', 'NITRO', 'BLAZE', 'PULSE'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(100 + Math.random() * 900); // 3 digit number, e.g. 123
    const code = `${prefix}${num}`;

    if (this.activeCodes.has(code)) {
      return this.generate();
    }

    this.activeCodes.add(code);
    return code;
  }

  public static release(code: string): void {
    this.activeCodes.delete(code.toUpperCase());
  }

  public static reserve(code: string): boolean {
    const uppercase = code.toUpperCase();
    if (this.activeCodes.has(uppercase)) return false;
    this.activeCodes.add(uppercase);
    return true;
  }
}