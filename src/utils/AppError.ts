import { DomainError, ErrorDetail } from './errors';

export class AppError extends DomainError {
    readonly status: number;
    readonly code: string;

    constructor(message: string, status = 400, code = 'APP_ERROR', details?: ErrorDetail[]) {
        super(message, details);
        this.status = status;
        this.code = code;
    }
}
