import { useState } from "react";
import { toast } from "sonner";
import { Trash } from "@phosphor-icons/react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "./ui/dialog";
import { Button } from "./ui/button";

export function ResetPortalButton({ api, onDone }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (confirm !== "RESET") return;
    setLoading(true);
    try {
      const res = await api.post("/admin/reset-portal");
      toast.success(res.data.message || "Portal reset complete");
      setOpen(false);
      setConfirm("");
      onDone?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        data-testid="reset-portal-btn"
        onClick={() => { setConfirm(""); setOpen(true); }}
        className="w-full mt-1 flex items-center gap-2 px-3 h-9 rounded-xl text-sm font-medium text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash className="h-4 w-4" />
        Reset Portal Data
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash className="h-5 w-5" /> Reset Portal Data
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400 space-y-2 pt-1">
              <span className="block">This will permanently delete:</span>
              <ul className="list-disc pl-4 text-sm space-y-1">
                <li>All employees (except your admin account)</li>
                <li>All attendance, leave &amp; payroll records</li>
                <li>All change requests and media uploads</li>
              </ul>
              <span className="block font-medium text-slate-700 dark:text-slate-300 mt-2">
                Worker Tree data is <span className="text-green-600">preserved</span>.
              </span>
              <span className="block mt-3">
                Type <strong>RESET</strong> to confirm:
              </span>
              <input
                data-testid="reset-confirm-input"
                value={confirm}
                onChange={e => setConfirm(e.target.value.toUpperCase())}
                placeholder="Type RESET"
                className="mt-1 w-full border border-red-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-slate-800 dark:text-white"
              />
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="reset-confirm-btn"
              disabled={confirm !== "RESET" || loading}
              onClick={handleReset}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
            >
              {loading ? "Resetting…" : "Reset Everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
