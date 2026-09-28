export class CooperApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly code: string;
  readonly param?: string;
  readonly docsUrl?: string;

  constructor(options: {
    status: number;
    type: string;
    code: string;
    message: string;
    param?: string;
    docsUrl?: string;
  }) {
    super(options.message);
    this.name = "CooperApiError";
    this.status = options.status;
    this.type = options.type;
    this.code = options.code;
    this.param = options.param;
    this.docsUrl = options.docsUrl;
  }

  static fromResponse(status: number, body: string): CooperApiError {
    try {
      const parsed = JSON.parse(body) as {
        error?: {
          type?: string;
          code?: string;
          message?: string;
          param?: string;
          docs_url?: string;
        };
      };
      const error = parsed.error;
      if (error?.message) {
        return new CooperApiError({
          status,
          type: error.type ?? "api_error",
          code: error.code ?? "api_error",
          message: error.message,
          param: error.param,
          docsUrl: error.docs_url,
        });
      }
    } catch {
      // Non-JSON error body.
    }
    return new CooperApiError({
      status,
      type: "api_error",
      code: "api_error",
      message: body.trim() || `Cooper Email returned HTTP ${status}.`,
    });
  }
}
