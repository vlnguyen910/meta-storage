export interface ResendAdapterOptions {
  apiKey?: string;
  fromEmail?: string;
  fetcher?: typeof fetch;
}

export interface ResendResponse {
  id?: string;
  message?: string;
}
