import logger from '../config/logger';

/**
 * Decorator for logging errors in service methods
 * @param context - Context string to identify where the error occurred
 */
export function logErrors(context: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        logger.error(`${context} error:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}
