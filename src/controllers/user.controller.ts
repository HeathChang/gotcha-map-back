import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { AuthRequest } from '../types';
import { AuthenticationError } from '../utils/errors';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import {
    SignupInput,
    LoginInput,
    UpdateUserInput,
    ChangePasswordInput,
    ResetPasswordInput,
} from '../validators/user.schema';

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, nickname, gender } = req.body as SignupInput;
    const user = await userService.signup(email, password, nickname, gender);
    success(res, user, '회원가입이 완료되었습니다.', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginInput;
    const result = await userService.login(email, password);
    success(res, result);
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.query as { userId: string };
    const user = await userService.getUser(userId);
    success(res, user);
});

export const updateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AuthenticationError('인증이 필요합니다.', 'UNAUTHENTICATED');
    const user = await userService.updateUser(userId, req.body as UpdateUserInput);
    success(res, user, '회원정보가 수정되었습니다.');
});

export const changePassword = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AuthenticationError('인증이 필요합니다.', 'UNAUTHENTICATED');
    const { oldPassword, newPassword } = req.body as ChangePasswordInput;
    await userService.changePassword(userId, oldPassword, newPassword);
    success(res, null, '비밀번호가 변경되었습니다.');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { userId, email, newPassword } = req.body as ResetPasswordInput;
    await userService.resetPassword(userId, email, newPassword);
    success(res, null, '비밀번호가 재설정되었습니다.');
});
