import {
  defaultNotificationPreferences,
  mergeNotificationPreferences,
  notificationPreferenceKeys,
  parseNotificationPreferences,
  pickNotificationPreferencePatch,
} from "./notification-preferences";

describe("notification preferences", () => {
  describe("defaults", () => {
    it("opts in to every key, matching what the system does today", () => {
      const defaults = defaultNotificationPreferences();
      expect(Object.keys(defaults).sort()).toEqual(
        [...notificationPreferenceKeys].sort(),
      );
      expect(Object.values(defaults).every((value) => value === true)).toBe(
        true,
      );
    });
  });

  describe("parsing what is stored", () => {
    it("returns the defaults when the column is null", () => {
      expect(parseNotificationPreferences(null)).toEqual(
        defaultNotificationPreferences(),
      );
    });

    it("returns the defaults when the column holds a non-object", () => {
      for (const stored of ["nope", 7, true, [], undefined]) {
        expect(parseNotificationPreferences(stored)).toEqual(
          defaultNotificationPreferences(),
        );
      }
    });

    it("keeps stored booleans and fills the rest from the defaults", () => {
      const parsed = parseNotificationPreferences({
        caseUpdates: false,
        productUpdates: false,
      });
      expect(parsed.caseUpdates).toBe(false);
      expect(parsed.productUpdates).toBe(false);
      expect(parsed.proposalReady).toBe(true);
    });

    it("drops keys it does not know about", () => {
      const parsed = parseNotificationPreferences({
        caseUpdates: false,
        somethingElse: true,
      });
      expect(parsed).not.toHaveProperty("somethingElse");
      expect(Object.keys(parsed).sort()).toEqual(
        [...notificationPreferenceKeys].sort(),
      );
    });

    it("never coerces a non-boolean into an opt-in", () => {
      // "false" is truthy. Coercing it would silently switch a user back on for
      // something they had turned off, which is the one outcome that matters.
      const parsed = parseNotificationPreferences({
        caseUpdates: "false",
        proposalReady: 0,
      });
      expect(parsed.caseUpdates).toBe(true);
      expect(parsed.proposalReady).toBe(true);
    });
  });

  describe("narrowing a caller patch", () => {
    it("keeps only known keys with boolean values", () => {
      expect(
        pickNotificationPreferencePatch({
          caseUpdates: false,
          productUpdates: "yes",
          invented: true,
        }),
      ).toEqual({ caseUpdates: false });
    });

    it("returns an empty patch for a non-object", () => {
      for (const patch of [null, undefined, "x", 3, []]) {
        expect(pickNotificationPreferencePatch(patch)).toEqual({});
      }
    });
  });

  describe("merging", () => {
    it("applies the patch over the stored value and stays complete", () => {
      const merged = mergeNotificationPreferences(
        { caseUpdates: false, proposalReady: false },
        { proposalReady: true },
      );
      expect(merged.caseUpdates).toBe(false);
      expect(merged.proposalReady).toBe(true);
      expect(Object.keys(merged).sort()).toEqual(
        [...notificationPreferenceKeys].sort(),
      );
    });

    it("produces a complete object even from a corrupt stored value", () => {
      const merged = mergeNotificationPreferences("garbage", {
        caseUpdates: false,
      });
      expect(merged.caseUpdates).toBe(false);
      expect(Object.keys(merged).sort()).toEqual(
        [...notificationPreferenceKeys].sort(),
      );
    });
  });
});
