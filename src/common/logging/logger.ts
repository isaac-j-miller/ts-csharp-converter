import { ILogger, LogLevel } from "./types";

type ConsoleLogLevel = "debug" | "info" | "warn" | "error";

export class Logger implements ILogger {
  constructor(private source: string, private level: LogLevel) {}
  private log(level: LogLevel, args: any[]) {
    if (this.level > level) {
      return;
    }
    const levelKey = LogLevel[level].toLowerCase() as ConsoleLogLevel;
    // eslint-disable-next-line no-console
    console[levelKey](
      `${new Date().toISOString()}\t[${this.source}]\t${LogLevel[level]}\t`,
      ...args
    );
  }
  debug(...args: any[]) {
    this.log(LogLevel.DEBUG, args);
  }
  info(...args: any[]) {
    this.log(LogLevel.INFO, args);
  }
  warn(...args: any[]) {
    this.log(LogLevel.WARN, args);
  }
  error(...args: any[]) {
    this.log(LogLevel.ERROR, args);
  }
}
