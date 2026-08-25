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
  /**
   * For the one endpoint that does not answer with JSON:
   * `GET /acuerdos/:id/exportar` sets `Content-Type: text/plain` and returns
   * the document itself. `request` would hand back `undefined` for it — the
   * JSON parse fails and the body is dropped — so reading text needs its own
   * door rather than a flag that makes `request`'s return type a lie.
   *
   * Errors still travel as the JSON envelope, so failures are parsed exactly
   * like everywhere else.
   */
  requestText(path: string, options?: RequestOptions): Promise<string>;
};

export type HttpClientDeps = {
  baseUrl: string;
  getToken: TokenProvider;
  fetchImpl?: typeof fetch;
};

const noContentStatus = 204;
const jsonMediaType = 'application/json';
const textMediaType = 'text/plain';

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

  /**
   * Everything both readers share: auth, headers, transport failures and the
   * error envelope. Only the success body is left to the caller, because that
   * is the only part that differs — and it is untouched here, so the stream is
   * still unread when a reader gets the response.
   */
  async function send(
    path: string,
    options: RequestOptions,
    accept: string,
  ): Promise<Response> {
    const method = options.method ?? 'GET';
    const token = await getToken();
    const headers: Record<string, string> = { Accept: accept };
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

    if (!response.ok) {
      // Failures are JSON on every route, including the text one: the
      // exception filter answers before the text handler ever runs.
      throw toApiError(response.status, await readBody(response));
    }
    return response;
  }

  return {
    async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
      const response = await send(path, options, jsonMediaType);
      return (await readBody(response)) as T;
    },

    async requestText(path: string, options: RequestOptions = {}): Promise<string> {
      const response = await send(path, options, textMediaType);
      // No 204 special case: an endpoint that answers text and sends no
      // content has produced an empty document, and '' says exactly that.
      return response.text();
    },
  };
}
