import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fmtEUR, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/factures")({
  component: FacturesPage,
});

type Row = {
  id: string; facture_number: string; issue_date: string; due_date: string;
  total_ttc: number; status: "draft"|"sent"|"paid"|"overdue"|"cancelled";
  client: { name: string } | null;
};

const STATUS: Record<Row["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-900",
  paid: "bg-green-100 text-green-900",
  overdue: "bg-red-100 text-red-900",
  cancelled: "bg-zinc-200 text-zinc-700",
};

function FacturesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    supabase.from("factures")
      .select("id, facture_number, issue_date, due_date, total_ttc, status, client:clients(name)")
      .order("issue_date", { ascending: false })
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, []);
  const filtered = rows.filter((r) =>
    !search || r.facture_number.toLowerCase().includes(search.toLowerCase()) || r.client?.name?.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Factures</h1>
          <p className="text-sm text-muted-foreground mt-1">Invoices converted from accepted devis.</p>
        </div>
        <Input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left p-3">Number</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Issued</th>
              <th className="text-left p-3">Due</th>
              <th className="text-right p-3">Total TTC</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-accent/50">
                <td className="p-3 font-mono"><Link to="/factures/$id" params={{ id: r.id }} className="text-primary hover:underline">{r.facture_number}</Link></td>
                <td className="p-3">{r.client?.name ?? "—"}</td>
                <td className="p-3">{fmtDate(r.issue_date)}</td>
                <td className="p-3">{fmtDate(r.due_date)}</td>
                <td className="p-3 text-right tabular-nums">{fmtEUR(r.total_ttc)}</td>
                <td className="p-3"><Badge variant="secondary" className={STATUS[r.status]}>{r.status}</Badge></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No factures yet. Convert an accepted devis to create one.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
