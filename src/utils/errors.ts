export type ErrorDetail = Record<string, unknown>;

export abstract class DomainError extends Error {
    abstract readonly status: number;
    abstract readonly code: string;
    readonly details?: ErrorDetail[];

    constructor(message: string, details?: ErrorDetail[]) {
        super(message);
        this.name = new.target.name;
        this.details = details;
    }
}

export class ValidationError extends DomainError {
    readonly status = 400;
    readonly code: string;
    constructor(message: string, code = 'VALIDATION_ERROR', details?: ErrorDetail[]) {
        super(message, details);
        this.code = code;
    }
}

export class AuthenticationError extends DomainError {
    readonly status = 401;
    readonly code: string;
    constructor(message: string, code = 'UNAUTHENTICATED') {
        super(message);
        this.code = code;
    }
}

export class AuthorizationError extends DomainError {
    readonly status = 403;
    readonly code: string;
    constructor(message: string, code = 'FORBIDDEN') {
        super(message);
        this.code = code;
    }
}

export class NotFoundError extends DomainError {
    readonly status = 404;
    readonly code: string;
    constructor(message: string, code = 'NOT_FOUND') {
        super(message);
        this.code = code;
    }
}

export class ConflictError extends DomainError {
    readonly status = 409;
    readonly code: string;
    constructor(message: string, code = 'CONFLICT') {
        super(message);
        this.code = code;
    }
}

export class BusinessRuleError extends DomainError {
    readonly status = 422;
    readonly code: string;
    constructor(message: string, code = 'BUSINESS_RULE_VIOLATION', details?: ErrorDetail[]) {
        super(message, details);
        this.code = code;
    }
}

export class InternalError extends DomainError {
    readonly status = 500;
    readonly code: string;
    constructor(message = '서버 내부 오류가 발생했습니다.', code = 'INTERNAL_ERROR') {
        super(message);
        this.code = code;
    }
}
