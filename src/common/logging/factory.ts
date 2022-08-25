import { Logger } from "./logger";
import { ILogger, LogLevel } from "./types";

export class LoggerFactory {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  private static cache: Record<string, ILogger> = {};
  private static getCacheKey(source: string, level: LogLevel) {
    return `${source}.${level}`;
  }
  private static getLogLevelFromEnv(): LogLevel|undefined {
    const fromEnv = process.env.LOG_LEVEL;
    if(fromEnv === undefined) return
    const asInt = Number.parseInt(fromEnv, 10);
    if(!Number.isInteger(asInt)) {
        const toUppercase = fromEnv.toUpperCase();
        const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
        const index = levels.indexOf(toUppercase);
        if(index === -1) return;
        return index as LogLevel
    }
    if(asInt >= LogLevel.DEBUG && asInt <= LogLevel.ERROR) {
        return asInt as LogLevel;
    }
    return
  }
  private static getLogLevelFromEnvOrDefault(): LogLevel {
    return this.getLogLevelFromEnv() ?? LogLevel.INFO
  }
  static getLogger(source: string, level?: LogLevel): ILogger {
    level = level ?? this.getLogLevelFromEnvOrDefault()
    const key = this.getCacheKey(source, level);
    const fromCache = this.cache[key];
    if (fromCache) {
      return fromCache;
    }
    const logger = new Logger(source, level);
    this.cache[key] = logger;
    return logger;
  }
}
