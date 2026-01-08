import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type AttorneyProfile = {
  user_id: string;
  full_name: string | null;
  primary_email: string | null;
  availability_status: string | null;
};

export const useAttorneys = () => {
  const [attorneys, setAttorneys] = useState<AttorneyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await (supabase as any)
        .from("attorney_profiles")
        .select("user_id,full_name,primary_email,availability_status")
        .order("full_name", { ascending: true, nullsFirst: false });

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message ?? "Failed to load attorneys");
        setAttorneys([]);
        setLoading(false);
        return;
      }

      setAttorneys((data ?? []) as AttorneyProfile[]);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { attorneys, loading, error };
};
