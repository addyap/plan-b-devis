import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

type Client = {
  id: string; name: string; contact_name: string | null; email: string | null; phone: string | null;
  address_line1: string | null; address_line2: string | null; postcode: string | null; city: string | null; country: string | null;
};

const EMPTY: Omit<Client, "id"> = {
  name: "", contact_name: "", email: "", phone: "",
  address_line1: "", address_line2: "", postcode: "", city: "", country: "France",
};

function ClientsPage() {
  const { data, refetch } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(EMPTY);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({ ...EMPTY, ...c });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (editing) {
      const { error } = await supabase.from("clients").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("clients").insert(form);
      if (error) return toast.error(error.message);
    }
    setOpen(false);
    refetch();
    toast.success("Saved");
  };

  const del = async (c: Client) => {
    if (!confirm(`Delete client "${c.name}"?`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    refetch();
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.length ?? 0} clients</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="size-4" /> New client</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Contact name" value={form.contact_name ?? ""} onChange={(v) => setForm({ ...form, contact_name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
                <Field label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
              </div>
              <Field label="Address" value={form.address_line1 ?? ""} onChange={(v) => setForm({ ...form, address_line1: v })} />
              <Field label="Address line 2" value={form.address_line2 ?? ""} onChange={(v) => setForm({ ...form, address_line2: v })} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Postcode" value={form.postcode ?? ""} onChange={(v) => setForm({ ...form, postcode: v })} />
                <Field label="City" value={form.city ?? ""} onChange={(v) => setForm({ ...form, city: v })} />
                <Field label="Country" value={form.country ?? ""} onChange={(v) => setForm({ ...form, country: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Contact</th>
              <th className="text-left px-4 py-3">City</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3">{c.contact_name}</td>
                <td className="px-4 py-3">{c.city}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(c)}><Trash2 className="size-4" /></Button>
                </td>
              </tr>
            ))}
            {(data ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
