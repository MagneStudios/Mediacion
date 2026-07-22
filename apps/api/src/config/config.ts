export type AppConfig = {
  port: number;
};

const defaultPort = 3000;

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const port = environment.PORT ? Number(environment.PORT) : defaultPort;
  return { port };
}
