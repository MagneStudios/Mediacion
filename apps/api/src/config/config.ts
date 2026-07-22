export type AppConfig = {
  port: number;
};

const defaultPort = 3000;
const minimumPort = 1;
const maximumPort = 65535;

function parsePort(rawPort: string): number {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < minimumPort || port > maximumPort) {
    throw new Error(
      `PORT must be a valid port number between ${minimumPort} and ${maximumPort}, received: ${rawPort}`,
    );
  }
  return port;
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const port = environment.PORT ? parsePort(environment.PORT) : defaultPort;
  return { port };
}
