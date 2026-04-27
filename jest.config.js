/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    rootDir: '.',
    testMatch: ['<rootDir>/tests/**/*.test.ts'],
    setupFiles: ['<rootDir>/tests/setupEnv.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/server.ts',
        '!src/types/**',
        '!src/scripts/**',
    ],
    coverageDirectory: 'coverage',
    clearMocks: true,
    resetModules: true,
};
