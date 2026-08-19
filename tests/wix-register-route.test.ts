import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RegistrationField, SiteEvent } from "@/lib/wix/types";

// Mock at the Wix boundary so no test can touch a real guest list.
const mocks = vi.hoisted(() => ({
  wixConfigured: true,
  getEventForRegistration: vi.fn(),
  createRsvp: vi.fn(),
}));

vi.mock("@/lib/wix/client", () => ({
  get wixConfigured() {
    return mocks.wixConfigured;
  },
  wixClient: null,
}));
vi.mock("@/lib/wix/events", () => ({
  getEventForRegistration: mocks.getEventForRegistration,
}));
vi.mock("@/lib/wix/rsvp", () => ({ createRsvp: mocks.createRsvp }));

const fields: RegistrationField[] = [
  { inputName: "firstName", label: "First name", kind: "text", required: true, options: [] },
  { inputName: "lastName", label: "Last name", kind: "text", required: true, options: [] },
  { inputName: "email", label: "Email", kind: "email", required: true, options: [] },
  {
    inputName: "shirtSize",
    label: "T-shirt size",
    kind: "dropdown",
    required: true,
    options: ["Small", "Large"],
  },
];

const openEvent: SiteEvent = {
  id: "evt-1",
  slug: "spring-fundraiser",
  title: "Spring Fundraiser",
  shortDescription: null,
  descriptionParagraphs: [],
  imageUrl: null,
  imageAlt: null,
  start: "2026-04-26T11:00:00.000Z",
  end: null,
  timeZone: "America/New_York",
  hideEndDate: false,
  dateTbd: false,
  dateTbdMessage: null,
  locationType: "ONLINE",
  locationName: "Virtual",
  locationAddress: null,
  registrationState: "open",
  externalUrl: null,
  allowsNoResponse: false,
  fields,
};

const validValues = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  shirtSize: "Small",
};

async function post(body: unknown, eventId = "evt-1") {
  const { POST } = await import("@/app/api/events/[eventId]/register/route");
  return POST(
    new Request("http://test/api/events/evt-1/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": randomIp() },
      body: JSON.stringify(body),
    }),
    { params: { eventId } },
  );
}

// The route is rate limited per client IP and the limiter is module-level
// state, so each request uses a distinct IP.
let ipCounter = 0;
function randomIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.wixConfigured = true;
  mocks.getEventForRegistration.mockResolvedValue(openEvent);
  mocks.createRsvp.mockResolvedValue({ ok: true, status: "confirmed" });
});

describe("registration route: configuration", () => {
  it("returns a clean 503 when Wix isn't configured, without calling Wix", async () => {
    mocks.wixConfigured = false;
    const res = await post({ values: validValues });
    expect(res.status).toBe(503);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });
});

describe("registration route: success", () => {
  it("creates the RSVP and returns only the resulting state", async () => {
    const res = await post({ values: validValues });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "confirmed" });
    expect(mocks.createRsvp).toHaveBeenCalledTimes(1);
  });

  it("echoes back none of the submitted personal details", async () => {
    const res = await post({ values: validValues });
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("jane@example.com");
    expect(body).not.toContain("Jane");
    expect(body).not.toContain("Doe");
  });

  it("passes Wix's stable input names, not labels", async () => {
    await post({ values: validValues });
    const arg = mocks.createRsvp.mock.calls[0][0];
    expect(Object.keys(arg.values)).toEqual(["firstName", "lastName", "email", "shirtSize"]);
    expect(arg.eventId).toBe("evt-1");
  });

  it("reports a waitlisted result when Wix waitlists the guest", async () => {
    mocks.createRsvp.mockResolvedValue({ ok: true, status: "waitlisted" });
    const res = await post({ values: validValues });
    expect(await res.json()).toEqual({ status: "waitlisted" });
  });
});

describe("registration route: server re-validates against live Wix state", () => {
  it("rejects a stale page whose event has since closed", async () => {
    mocks.getEventForRegistration.mockResolvedValue({
      ...openEvent,
      registrationState: "closed",
    });
    const res = await post({ values: validValues });
    expect(res.status).toBe(409);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("rejects registration that hasn't opened yet", async () => {
    mocks.getEventForRegistration.mockResolvedValue({
      ...openEvent,
      registrationState: "scheduled",
    });
    expect((await post({ values: validValues })).status).toBe(409);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("rejects an event that has ended", async () => {
    mocks.getEventForRegistration.mockResolvedValue({ ...openEvent, registrationState: "ended" });
    expect((await post({ values: validValues })).status).toBe(409);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("404s when Wix has no such event", async () => {
    mocks.getEventForRegistration.mockResolvedValue(null);
    expect((await post({ values: validValues })).status).toBe(404);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("forces a waitlist RSVP when Wix says the event is waitlist-only", async () => {
    mocks.getEventForRegistration.mockResolvedValue({
      ...openEvent,
      registrationState: "waitlist",
    });
    await post({ values: validValues, status: "YES" });
    expect(mocks.createRsvp.mock.calls[0][0].status).toBe("WAITLIST");
  });

  it("rejects a 'no' response on a yes-only event", async () => {
    const res = await post({ values: validValues, status: "NO" });
    expect(res.status).toBe(400);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("validates against the fields Wix returns now, not what the client sent", async () => {
    // Wix has since added a required question the browser never rendered.
    mocks.getEventForRegistration.mockResolvedValue({
      ...openEvent,
      fields: [
        ...fields,
        {
          inputName: "accessNeeds",
          label: "Access needs",
          kind: "text" as const,
          required: true,
          options: [],
        },
      ],
    });
    const res = await post({ values: validValues });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("accessNeeds");
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });
});

describe("registration route: input validation happens before Wix is called", () => {
  it("rejects a missing required field with per-field messages", async () => {
    const res = await post({ values: { firstName: "Jane" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.fieldErrors).sort()).toEqual(["email", "lastName", "shirtSize"]);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("rejects an invalid email", async () => {
    const res = await post({ values: { ...validValues, email: "nope" } });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors).toHaveProperty("email");
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("rejects an option outside Wix's list", async () => {
    const res = await post({ values: { ...validValues, shirtSize: "Enormous" } });
    expect(res.status).toBe(400);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const { POST } = await import("@/app/api/events/[eventId]/register/route");
    const res = await POST(
      new Request("http://test/api", {
        method: "POST",
        headers: { "x-forwarded-for": randomIp() },
        body: "not json",
      }),
      { params: { eventId: "evt-1" } },
    );
    expect(res.status).toBe(400);
    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });
});

describe("registration route: Wix failures surface as friendly messages", () => {
  it("maps a duplicate registration to 409 with a reassuring message", async () => {
    mocks.createRsvp.mockResolvedValue({
      ok: false,
      reason: "already_registered",
      message: "That email address is already registered for this event — you're all set.",
    });
    const res = await post({ values: validValues });
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe("already_registered");
  });

  it("never reports success when Wix rejected the RSVP", async () => {
    mocks.createRsvp.mockResolvedValue({
      ok: false,
      reason: "closed",
      message: "Registration for this event has closed.",
    });
    const res = await post({ values: validValues });
    expect(res.status).not.toBe(200);
    expect(await res.json()).not.toHaveProperty("status");
  });

  it("maps a capacity failure to a friendly message", async () => {
    mocks.createRsvp.mockResolvedValue({
      ok: false,
      reason: "full",
      message: "This event is now full.",
    });
    const res = await post({ values: validValues });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("This event is now full.");
  });
});

describe("registration route: abuse protection", () => {
  it("rate limits repeated attempts from one client", async () => {
    const ip = "198.51.100.42";
    const { POST } = await import("@/app/api/events/[eventId]/register/route");
    const send = () =>
      POST(
        new Request("http://test/api", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
          body: JSON.stringify({ values: validValues }),
        }),
        { params: { eventId: "evt-1" } },
      );

    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) statuses.push((await send()).status);
    expect(statuses).toContain(429);
  });
});
