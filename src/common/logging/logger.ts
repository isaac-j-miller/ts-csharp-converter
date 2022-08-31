import { ILogger, LogLevel } from "./types";

type ConsoleLogLevel = "trace" | "debug" | "info" | "warn" | "error";

export class Logger implements ILogger {
  constructor(private source: string, private level: LogLevel) {}
  private log(level: LogLevel, args: any[]) {
    if (this.level > level) {
      return;
    }
    let levelKey = LogLevel[level].toLowerCase() as ConsoleLogLevel;
    if(levelKey === "trace") {
      levelKey = "debug"
    }
    // eslint-disable-next-line no-console
    console[levelKey](
      `${new Date().toISOString()}\t[${this.source}]\t${LogLevel[level]}\t`,
      ...args
    );
  }
  trace(...args: any[]) {
    this.log(LogLevel.TRACE, args);
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
