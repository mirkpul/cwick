/**
 * Shared Winston logger configuration
 */
import winston from 'winston';

export interface LoggerConfig {
  service: string;
  level?: string;
  console?: boolean;
  file?: boolean;
  filePath?: string;
}

export function createLogger(config: LoggerConfig): winston.Logger {
  const { service, level = 'info', console = true, file = false, filePath } = config;

  const transports: winston.transport[] = [];

  // Console transport
  if (console) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${service}] ${level}: ${message} ${metaString}`;
          })
        ),
      })
    );
  }

  // File transport
  if (file && filePath) {
    transports.push(
      new winston.transports.File({
        filename: filePath,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      })
    );
  }

  return winston.createLogger({
    level,
    defaultMeta: { service },
    transports,
  });
}
