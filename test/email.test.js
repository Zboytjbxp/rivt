import assert from "node:assert/strict";
import test from "node:test";
import { emailInternals, sendTransactionalEmail } from "../server/email.js";

test("transactional email fails with a bounded, explicit timeout", async () => {
  assert.equal(emailInternals.EMAIL_REQUEST_TIMEOUT_MS, 8_000);
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  process.env.EMAIL_DELIVERY_MODE = "resend";
  process.env.RESEND_API_KEY = "re_test_placeholder";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  const signal = AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
  const stalledFetch = (_url, options) => Promise.reject(options.signal.reason);
  try {
    await assert.rejects(
      () => sendTransactionalEmail({
        to: "recipient@example.test",
        subject: "Test",
        text: "Test",
        html: "<p>Test</p>",
      }, { fetchImpl: stalledFetch, signal }),
      (error) => error.status === 504 && error.code === "EMAIL_DELIVERY_TIMEOUT",
    );
  } finally {
    for (const [name, value] of Object.entries({
      EMAIL_DELIVERY_MODE: previous.mode,
      RESEND_API_KEY: previous.key,
      EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("transactional email creates and enforces its default timeout signal", async () => {
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  process.env.EMAIL_DELIVERY_MODE = "resend";
  process.env.RESEND_API_KEY = "re_test_placeholder";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  try {
    await assert.rejects(
      () => sendTransactionalEmail({
        to: "recipient@example.test",
        subject: "Test",
        text: "Test",
        html: "<p>Test</p>",
      }, {
        timeoutMs: 5,
        fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
        }),
      }),
      (error) => error.status === 504 && error.code === "EMAIL_DELIVERY_TIMEOUT",
    );
  } finally {
    for (const [name, value] of Object.entries({
      EMAIL_DELIVERY_MODE: previous.mode,
      RESEND_API_KEY: previous.key,
      EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("transactional email does not claim success when the response body times out", async () => {
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  process.env.EMAIL_DELIVERY_MODE = "resend";
  process.env.RESEND_API_KEY = "re_test_placeholder";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  const signal = AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
  try {
    await assert.rejects(
      () => sendTransactionalEmail({
        to: "recipient@example.test",
        subject: "Test",
        text: "Test",
        html: "<p>Test</p>",
      }, {
        signal,
        fetchImpl: async () => ({
          ok: true,
          json: async () => { throw signal.reason; },
        }),
      }),
      (error) => error.status === 504 && error.code === "EMAIL_DELIVERY_TIMEOUT",
    );
  } finally {
    for (const [name, value] of Object.entries({
      EMAIL_DELIVERY_MODE: previous.mode,
      RESEND_API_KEY: previous.key,
      EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("transactional email drains a rejected provider response before failing", async () => {
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  process.env.EMAIL_DELIVERY_MODE = "resend";
  process.env.RESEND_API_KEY = "re_test_placeholder";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  let bodyConsumed = false;
  try {
    await assert.rejects(
      () => sendTransactionalEmail({
        to: "recipient@example.test",
        subject: "Test",
        text: "Test",
        html: "<p>Test</p>",
      }, {
        fetchImpl: async () => ({
          ok: false,
          text: async () => { bodyConsumed = true; return "provider rejected request"; },
        }),
      }),
      (error) => error.status === 502 && error.code === "EMAIL_DELIVERY_FAILED",
    );
    assert.equal(bodyConsumed, true);
  } finally {
    for (const [name, value] of Object.entries({
      EMAIL_DELIVERY_MODE: previous.mode,
      RESEND_API_KEY: previous.key,
      EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("transactional email reports a timeout while draining a rejected response", async () => {
  const previous = {
    mode: process.env.EMAIL_DELIVERY_MODE,
    key: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
  process.env.EMAIL_DELIVERY_MODE = "resend";
  process.env.RESEND_API_KEY = "re_test_placeholder";
  process.env.EMAIL_FROM = "RIVT Test <noreply@example.test>";
  const signal = AbortSignal.abort(new DOMException("deadline", "TimeoutError"));
  try {
    await assert.rejects(
      () => sendTransactionalEmail({
        to: "recipient@example.test",
        subject: "Test",
        text: "Test",
        html: "<p>Test</p>",
      }, {
        signal,
        fetchImpl: async () => ({
          ok: false,
          text: async () => { throw signal.reason; },
        }),
      }),
      (error) => error.status === 504 && error.code === "EMAIL_DELIVERY_TIMEOUT",
    );
  } finally {
    for (const [name, value] of Object.entries({
      EMAIL_DELIVERY_MODE: previous.mode,
      RESEND_API_KEY: previous.key,
      EMAIL_FROM: previous.from,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
