import { Response } from 'express';
import { ApiResponse } from '../types';

export function success<T>(res: Response, data: T, message?: string, statusCode = 200): void {
    const body: ApiResponse<T> = { data };
    if (message) body.message = message;
    res.status(statusCode).json(body);
}
