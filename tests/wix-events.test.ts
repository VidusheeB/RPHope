import { describe, it, expect } from "vitest";
import { toRegistrationFields, validateAnswers, extractIdentity } from "@/lib/wix/formSchema";
import { toSiteEvent, registrationStateOf, extractParagraphs } from "@/lib/wix/mapEvent";
import type { wixEventsV2 } from "@wix/events";

// A realistic Wix form: the two system controls Wix always includes, plus a
// custom dropdown and a guest control of the kind Carin can add in the dashboard.
const controls: wixEventsV2.InputControl[] = [
  {
    _id: "c-name",
    type: "NAME",
    orderIndex: 0,
    system: true,
    inputs: [
      { name: "firstName", label: "First name", type: "TEXT", mandatory: true, maxLength: 50 },
      { name: "lastName", label: "Last name", type: "TEXT", mandatory: true, maxLength: 50 },
    ],
  },
  {
    _id: "c-email",
    type: "INPUT",
    orderIndex: 1,
    system: true,
    inputs: [{ name: "email", label: "Email", type: "TEXT", mandatory: true }],
  },
  {
    _id: "c-shirt",
    type: "DROPDOWN",
    orderIndex: 2,
    inputs: [
      {
        name: "shirtSize",
        label: "T-shirt size",
        type: "TEXT",
        mandatory: true,
        options: ["Small", "Medium", "Large"],
      },
    ],
  },
  {
    _id: "c-guests",
    type: "GUEST_CONTROL",
    orderIndex: 3,
    inputs: [
      { name: "guestNames", label: "Additional guests", type: "TEXT_ARRAY", maxSize: 2 },
    ],
  },
];

describe("form schema mapping (Wix owns the questions)", () => {
  const fields = toRegistrationFields(controls);

  it("flattens controls into ordered fields using Wix's stable input names", () => {
    expect(fields.map((f) => f.inputName)).toEqual([
      "firstName",
      "lastName",
      "email",
      "shirtSize",
      "guestNames",
    ]);
  });

  it("carries required state and predefined options through from Wix", () => {
    const shirt = fields.find((f) => f.inputName === "shirtSize")!;
    expect(shirt.required).toBe(true);
    expect(shirt.kind).toBe("dropdown");
    expect(shirt.options).toEqual(["Small", "Medium", "Large"]);
  });

  it("detects email and guest-control kinds", () => {
    expect(fields.find((f) => f.inputName === "email")!.kind).toBe("email");
    const guests = fields.find((f) => f.inputName === "guestNames")!;
    expect(guests.kind).toBe("guestNames");
    expect(guests.maxSize).toBe(2);
  });

  it("respects orderIndex rather than array order", () => {
    const shuffled = [controls[2], controls[0], controls[3], controls[1]];
    expect(toRegistrationFields(shuffled).map((f) => f.inputName)).toEqual([
      "firstName",
      "lastName",
      "email",
      "shirtSize",
      "guestNames",
    ]);
  });

  it("drops controls Wix marked deleted", () => {
    const withDeleted = [...controls, {
      _id: "c-old",
      type: "INPUT" as const,
      orderIndex: 4,
      deleted: true,
      inputs: [{ name: "retired", label: "Retired question", mandatory: true }],
    }];
    expect(toRegistrationFields(withDeleted).some((f) => f.inputName === "retired")).toBe(false);
  });

  it("returns nothing when the event has no form", () => {
    expect(toRegistrationFields(undefined)).toEqual([]);
  });
});

describe("answer validation against the live Wix definition", () => {
  const fields = toRegistrationFields(controls);

  const valid = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    shirtSize: "Medium",
  };

  it("accepts a complete, valid submission", () => {
    expect(validateAnswers(fields, valid)).toEqual({});
  });

  it("flags each missing required field by its input name", () => {
    const errors = validateAnswers(fields, { firstName: "Jane" });
    expect(Object.keys(errors).sort()).toEqual(["email", "lastName", "shirtSize"]);
  });

  it("rejects a value outside Wix's predefined options", () => {
    const errors = validateAnswers(fields, { ...valid, shirtSize: "Extra Large" });
    expect(errors.shirtSize).toBeTruthy();
  });

  it("rejects a malformed email", () => {
    expect(validateAnswers(fields, { ...valid, email: "not-an-email" }).email).toBeTruthy();
  });

  it("enforces maxLength from Wix", () => {
    expect(validateAnswers(fields, { ...valid, firstName: "x".repeat(51) }).firstName).toBeTruthy();
  });

  it("enforces the guest maxSize from Wix", () => {
    const ok = validateAnswers(fields, { ...valid, guestNames: ["A", "B"] });
    expect(ok.guestNames).toBeUndefined();
    const tooMany = validateAnswers(fields, { ...valid, guestNames: ["A", "B", "C"] });
    expect(tooMany.guestNames).toBeTruthy();
  });

  it("treats whitespace-only answers as missing", () => {
    expect(validateAnswers(fields, { ...valid, firstName: "   " }).firstName).toBeTruthy();
  });

  it("extracts the identity fields Wix requires at the top level", () => {
    expect(extractIdentity(valid)).toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    });
  });
});

describe("registration state derivation", () => {
  const state = (event: wixEventsV2.Event) => registrationStateOf(event);

  it("maps Wix registration statuses to what the visitor can do", () => {
    expect(state({ status: "UPCOMING", registration: { status: "OPEN_RSVP" } })).toBe("open");
    expect(state({ status: "UPCOMING", registration: { status: "OPEN_RSVP_WAITLIST_ONLY" } })).toBe("waitlist");
    expect(state({ status: "UPCOMING", registration: { status: "SCHEDULED_RSVP" } })).toBe("scheduled");
    expect(state({ status: "UPCOMING", registration: { status: "CLOSED_MANUALLY" } })).toBe("closed");
    expect(state({ status: "UPCOMING", registration: { status: "CLOSED_AUTOMATICALLY" } })).toBe("closed");
    expect(state({ status: "UPCOMING", registration: { status: "OPEN_TICKETS" } })).toBe("tickets");
    expect(state({ status: "UPCOMING", registration: { status: "OPEN_EXTERNAL" } })).toBe("external");
  });

  it("treats an ended or canceled event as ended regardless of registration", () => {
    expect(state({ status: "ENDED", registration: { status: "OPEN_RSVP" } })).toBe("ended");
    expect(state({ status: "CANCELED", registration: { status: "OPEN_RSVP" } })).toBe("ended");
  });

  it("honors paused and disabled registration", () => {
    expect(state({ status: "UPCOMING", registration: { status: "OPEN_RSVP", registrationPaused: true } })).toBe("closed");
    expect(state({ status: "UPCOMING", registration: { status: "OPEN_RSVP", registrationDisabled: true } })).toBe("none");
  });

  it("falls back to closed rather than showing a form it cannot confirm is open", () => {
    expect(state({ status: "UPCOMING", registration: { type: "RSVP", status: "UNKNOWN_REGISTRATION_STATUS" } })).toBe("closed");
    expect(state({ status: "UPCOMING" })).toBe("none");
  });
});

describe("event mapping", () => {
  const wixEvent: wixEventsV2.Event = {
    _id: "evt-1",
    slug: "spring-fundraiser",
    title: "Spring Fundraiser",
    status: "UPCOMING",
    shortDescription: "Walk, run, or cycle any distance.",
    dateAndTimeSettings: {
      startDate: new Date("2026-04-26T11:00:00Z"),
      endDate: new Date("2026-04-26T23:00:00Z"),
      timeZoneId: "America/New_York",
    },
    location: { type: "ONLINE", name: "Global · Virtual" },
    registration: { type: "RSVP", status: "OPEN_RSVP", rsvp: { responseType: "YES_AND_NO" } },
    form: { controls },
  };

  it("maps a Wix event into the site's narrow shape", () => {
    const mapped = toSiteEvent(wixEvent)!;
    expect(mapped.id).toBe("evt-1");
    expect(mapped.slug).toBe("spring-fundraiser");
    expect(mapped.title).toBe("Spring Fundraiser");
    expect(mapped.start).toBe("2026-04-26T11:00:00.000Z");
    expect(mapped.timeZone).toBe("America/New_York");
    expect(mapped.locationType).toBe("ONLINE");
    expect(mapped.registrationState).toBe("open");
    expect(mapped.allowsNoResponse).toBe(true);
    expect(mapped.fields).toHaveLength(5);
  });

  it("skips events with no id or slug, since there is nothing to link or register against", () => {
    expect(toSiteEvent({ ...wixEvent, _id: undefined })).toBeNull();
    expect(toSiteEvent({ ...wixEvent, slug: undefined })).toBeNull();
  });

  it("marks a yes-only event as not allowing a no response", () => {
    const yesOnly = toSiteEvent({
      ...wixEvent,
      registration: { type: "RSVP", status: "OPEN_RSVP", rsvp: { responseType: "YES_ONLY" } },
    })!;
    expect(yesOnly.allowsNoResponse).toBe(false);
  });
});

describe("rich content extraction (no raw HTML is ever rendered)", () => {
  it("pulls plain text out of Wix's Ricos node tree", () => {
    const content = {
      nodes: [
        { type: "PARAGRAPH", nodes: [{ type: "TEXT", textData: { text: "First paragraph." } }] },
        {
          type: "PARAGRAPH",
          nodes: [
            { type: "TEXT", textData: { text: "Second " } },
            { type: "TEXT", textData: { text: "paragraph." } },
          ],
        },
      ],
    } as wixEventsV2.RichContent;
    expect(extractParagraphs(content)).toEqual(["First paragraph.", "Second paragraph."]);
  });

  it("keeps markup-looking source text as inert text, never as HTML", () => {
    const content = {
      nodes: [
        {
          type: "PARAGRAPH",
          nodes: [{ type: "TEXT", textData: { text: "<script>alert(1)</script>" } }],
        },
      ],
    } as wixEventsV2.RichContent;
    // The value stays a plain string; React escapes it on render, and no
    // dangerouslySetInnerHTML path exists for it anywhere.
    expect(extractParagraphs(content)).toEqual(["<script>alert(1)</script>"]);
  });

  it("returns nothing for empty or absent content", () => {
    expect(extractParagraphs(undefined)).toEqual([]);
    expect(extractParagraphs({ nodes: [] })).toEqual([]);
  });
});
