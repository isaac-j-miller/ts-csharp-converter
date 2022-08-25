export type LogFn = (...args: any[]) => void
export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR
}
export interface ILogger {
    debug: LogFn;
    info: LogFn;
    warn: LogFn;
    error: LogFn;
}