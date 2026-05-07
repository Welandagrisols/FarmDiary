import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { hasMigrated } from "@/lib/supabase-storage";

export default function Index() {
  const { user, isLoading } = useAuth();
  const [migrationChecked, setMigrationChecked] = useState(false);
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    if (user) {
      hasMigrated().then((done) => {
        setMigrated(done);
        setMigrationChecked(true);
      });
    }
  }, [user]);

  if (isLoading) return null;
  if (!user) return <Redirect href="/auth" />;
  if (!migrationChecked) return null;
  if (!migrated) return <Redirect href="/migration" />;
  return <Redirect href="/farm-picker" />;
}
