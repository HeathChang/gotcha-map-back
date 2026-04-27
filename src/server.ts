import app from './app';
import { env } from './config/env';
import pool from './config/database';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.ping();
        logger.info('Database connection verified');
    } catch (err) {
        logger.error('Database connection failed', { err });
        process.exit(1);
    } finally {
        if (conn) conn.release();
    }

    const server = app.listen(env.PORT, () => {
        logger.info(`GachaMap API listening on :${env.PORT} (${env.NODE_ENV})`);
    });

    const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully`);
        server.close(async () => {
            try {
                await pool.end();
                logger.info('Database pool closed');
                process.exit(0);
            } catch (err) {
                logger.error('Error during shutdown', { err });
                process.exit(1);
            }
        });
        setTimeout(() => {
            logger.error('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000).unref();
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection', { reason });
    });
    process.on('uncaughtException', (err) => {
        logger.error('Uncaught exception', { err });
        process.exit(1);
    });
}

bootstrap();
