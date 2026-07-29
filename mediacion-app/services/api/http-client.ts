import { ApiError, codeNetworkUnavailable, toApiError } from './api-error';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * Resolves the bearer token for the next request. It is a function rather than
 * a value because Supabase refreshes the access token in the background — a
 * captured string would go stale mid-session.
 */
export type TokenProvider = () => Promise<string | null>;

export type HttpClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
};

export type HttpClientDeps = {
  baseUrl: string;
  getToken: TokenProvider;
  fetchImpl?: typeof fetch;
};

const noContentStatus = 204;

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\/+/, '')}`;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === noContentStatus) {
    return undefined;
  }
  const text = await response.text();
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function createHttpClient({
  baseUrl,
  getToken,
  fetchImpl,
}: HttpClientDeps): HttpClient {
  const doFetch = fetchImpl ?? fetch;

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const method = options.method ?? 'GET';
      const token = await getToken();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (token !== null) {
        headers.Authorization = `Bearer ${token}`;
      }
      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      let response: Response;
      try {
        response = await doFetch(joinUrl(baseUrl, path), {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: options.signal,
        });
      } catch (cause) {
        // A DNS failure or a dropped connection is not an API contract error,
        // so it gets its own code instead of being reported as internal_error.
        throw new ApiError(
          codeNetworkUnavailable,
          cause instanceof Error ? cause.message : 'Network request failed',
          0,
        );
      }

      const body = await readBody(response);
      if (!response.ok) {
        throw toApiError(response.status, body);
      }
      return body as T;
    },
  };
}
