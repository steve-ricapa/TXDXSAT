import { useEffect, useState } from "react";
import { myLiveResults, type MyLiveResult } from "@/modules/live-sessions/lib/api";

export function useEmployeeResults() {
  const [results, setResults] = useState<MyLiveResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    myLiveResults()
      .then(({ results: entries }) => { if (mounted) setResults(entries); })
      .catch(() => { if (mounted) setError(true); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return { results, loading, error };
}

export function sortEmployeeResults(results: MyLiveResult[]) {
  return [...results].sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
}
