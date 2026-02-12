import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineStage {
  id: string;
  pipeline: string;
  key: string;
  label: string;
  display_order: number;
  column_class: string | null;
  header_class: string | null;
  is_active: boolean;
}

interface UsePipelineStagesResult {
  stages: PipelineStage[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches active portal stages for a given portal identifier,
 * ordered by display_order ascending.
 */
export function usePipelineStages(portal: string): UsePipelineStagesResult {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStages = async () => {
      setLoading(true);
      setError(null);

      const { data: stagesData, error: stagesError } = await supabase
        .from("portal_stages")
        .select("*")
        .eq("pipeline", portal)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (!cancelled) {
        if (stagesError) {
          setError(stagesError.message);
        } else {
          setStages((stagesData as unknown as PipelineStage[]) ?? []);
        }
        setLoading(false);
      }
    };

    fetchStages();

    return () => {
      cancelled = true;
    };
  }, [portal]);

  return { stages, loading, error };
}
