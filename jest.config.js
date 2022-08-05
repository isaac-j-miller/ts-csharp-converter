module.exports = {
  automock: false,
  clearMocks: true,
  collectCoverage: false,
  testEnvironment: "node",
  //   roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^src/(.*)": "<rootDir>/src/$1",
  },
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/tsconfig.json",
    },
  },
};
