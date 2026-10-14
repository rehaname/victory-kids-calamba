import { isEnvironmentSetupError } from "@/lib/data/setup-error";

type Props = {
  configError?: string | null;
  missingEnv?: string[];
  dataSource?: "supabase" | "memory" | "error";
};

export function DatabaseStatusBanner({
  configError = null,
  missingEnv = [],
  dataSource = "supabase",
}: Props) {
  const showSetupHelp = missingEnv.length > 0 || isEnvironmentSetupError(configError);

  return (
    <>
      {configError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
          <p className="font-semibold">Database not connected — sessions will not be saved</p>
          <p className="mt-1">{configError}</p>
          {missingEnv.length > 0 && (
            <p className="mt-2 font-mono text-xs text-red-700">
              Missing on Vercel: {missingEnv.join(", ")}
            </p>
          )}
          {showSetupHelp && (
            <p className="mt-2 text-red-700/80">
              Vercel → Project Settings → Environment Variables → add the Supabase keys, set
              KIDS_DATA_SOURCE=supabase, then Redeploy.
            </p>
          )}
        </div>
      )}
      {dataSource === "memory" && !configError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Demo mode (in-memory). Start/Close session is temporary and disappears on refresh.
          Set Supabase env vars on Vercel to save sessions permanently.
        </div>
      )}
    </>
  );
}
