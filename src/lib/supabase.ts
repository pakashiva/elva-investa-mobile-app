/**
 * The ELVA CAPITA mobile app talks to Express, not Supabase.
 * Remaining VT screens that still import this module will get a clear error
 * instead of crashing Expo at boot for a missing Supabase URL.
 */
function unusedFeature(): never {
  throw new Error(
    'This screen is still being connected to the ELVA CAPITA API.'
  );
}

export const supabase = new Proxy(
  {},
  {
    get() {
      return unusedFeature;
    },
  }
) as never;
