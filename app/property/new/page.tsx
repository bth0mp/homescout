import Link from "next/link";
import { createProperty } from "@/app/actions";
import { PropertyForm } from "@/components/property-form";

export const metadata = { title: "Add property — HomeScout" };

export default function NewProperty() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          ← Back
        </Link>
        <h1 className="font-display mt-1 text-[2rem] leading-none font-semibold">Add property</h1>
      </div>
      <PropertyForm action={createProperty} submitLabel="Save property" />
    </div>
  );
}
