import { Logger } from "./logger";
import { ILogger, LogLevel } from "./types";

export class LoggerFactory {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    private constructor() { }
    private static cache: Record<string, ILogger> = {}
    private static getCacheKey(source: string, level: LogLevel) {
        return `${source}.${level}`
    }
    static getLogger(source: string, level: LogLevel=LogLevel.INFO): ILogger {
        const key = this.getCacheKey(source, level)
        const fromCache = this.cache[key];
        if(fromCache) {
            return fromCache
        }
        const logger = new Logger(source, level);
        this.cache[key] = logger;
        return logger;
    }
}