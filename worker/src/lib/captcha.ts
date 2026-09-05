export type CaptchaResult =
  | { ok: true }
  | { ok: false; error: string };

const SITEVERIFY_URL = "https://api.hcaptcha.com/siteverify";

export function captchaToken(fields: Record<string, string>): string {
  return (fields["h-captcha-response"] || fields["g-recaptcha-response"] || "").trim();
}

export async function verifyHCaptcha(input: {
  secret: string;
  token: string;
  ip?: string;
}): Promise<CaptchaResult> {
  if (!input.secret) {
    return {
      ok: false,
      error: "Captcha is enabled but HCAPTCHA_SECRET is not configured.",
    };
  }
  if (!input.token) {
    return {
      ok: false,
      error: "This form requires hCaptcha. Complete the captcha and try again.",
    };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", input.secret);
    body.set("response", input.token);
    if (input.ip && input.ip !== "unknown") {
      body.set("remoteip", input.ip);
    }

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const payload = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (!payload.success) {
      const codes = payload["error-codes"]?.filter(Boolean).join(", ");
      console.warn("hCaptcha verification failed", { codes });
      return {
        ok: false,
        error: codes
          ? `hCaptcha verification failed (${codes}). Please try again.`
          : "hCaptcha verification failed. Please try again.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("hCaptcha siteverify request failed:", error);
    return {
      ok: false,
      error: "Unable to verify hCaptcha right now. Please try again.",
    };
  }
}
