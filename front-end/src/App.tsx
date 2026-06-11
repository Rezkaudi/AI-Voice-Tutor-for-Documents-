import { AuthGate } from "@/components/AuthGate";
import { TeachingApp } from "@/components/TeachingApp";

/** Root component. */
export function App() {
  return (
    <AuthGate>
      <TeachingApp />
    </AuthGate>
  );
}
