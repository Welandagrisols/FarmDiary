import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { hasMigrated } from "@/lib/supabase-storage";

export default function Index() {
  const [checked, setChecked] = useState(false);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    hasMigrated().then((done) => {
      setMigrated(done);
      setChecked(true);
    });
  }, []);

  if (!checked) return null;
  if (!migrated) return <Redirect href="/migration" />;
  return <Redirect href="/farm-picker" />;
}
