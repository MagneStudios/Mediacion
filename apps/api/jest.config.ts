import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "@swc/jest",
  },
  transformIgnorePatterns: ["node_modules/(?!.*jose)"],
  testEnvironment: "node",
};

export default config;
