import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="text-muted-foreground text-sm">
          Scaffold is up. Property board lands in the next milestone.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestone 0 — scaffold</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-1 text-sm">
          <p>Next + Tailwind + shadcn/ui, dark by default with a persisted light toggle.</p>
          <p>
            SQLite is live at <code className="text-foreground">/api/health</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
