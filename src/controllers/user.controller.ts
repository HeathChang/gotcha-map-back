import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { AuthRequest } from '../types';
import { AuthenticationError } from '../utils/errors';
import { success } from '../utils/response';
import { asyncHandler } from '../utils/asyncHandler';
import { setRefreshCookie } from '../utils/cookies';
import {
    SignupInput,
    LoginInput,
    UpdateUserInput,
    ChangePasswordInput,
    RequestPasswordResetInput,
    ConfirmPasswordResetInput,
} from '../validators/user.schema';

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, nickname, gender } = req.body as SignupInput;
    const user = await userService.signup(email, password, nickname, gender);
    success(res, user, '회원가입이 완료되었습니다.', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginInput;
    const result = await userService.login(email, password, {
        userAgent: req.get('user-agent') ?? undefined,
        ip: req.ip,
    });
    // 클라이언트별 권장 저장소:
    //   - Web (BFF/같은 도메인): httpOnly 쿠키 사용 (자동). body의 refreshToken 무시.
    //   - Native (React Native 등): 쿠키 영속화가 까다로워 body의 refreshToken을 secure storage에 저장.
    // Refresh Rotation + 재사용 감지가 1차 방어선이며, 둘 다 같은 보안 모델로 동작한다.
    setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
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

export const withdrawUser = asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new AuthenticationError('인증이 필요합니다.', 'UNAUTHENTICATED');
    await userService.withdrawUser(userId);
    success(res, null, '회원탈퇴가 완료되었습니다.');
});

export const requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body as RequestPasswordResetInput;
    await userService.requestPasswordReset(email);
    // 계정 존재 여부 노출 금지(auth.md). 항상 동일한 응답.
    success(res, null, '재설정 안내 메일을 발송했습니다.', 202);
});

export const confirmPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body as ConfirmPasswordResetInput;
    await userService.confirmPasswordReset(token, newPassword);
    success(res, null, '비밀번호가 재설정되었습니다.');
});
