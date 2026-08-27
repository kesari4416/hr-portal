import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Check, X } from "@phosphor-icons/react";

const AUTO_APPLY_TYPES = ["Salary Revision", "Leave Adjustment", "Shift Change"];

function parseMeta(metadata) {
  if (!metadata) return null;
  try {
    return typeof metadata === "string" ? JSON.parse(metadata) : metadata;
  } catch {
    return null;
  }
}

export function CRApproveDialog({ open, onOpenChange, cr, applyData, onApplyDataChange, onConfirm }) {
  if (!cr) return null;
  const meta = parseMeta(cr.metadata);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-['Outfit']">Review &amp; Approve Change Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* CR Details */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#002FA7] font-semibold">{cr.cr_type}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                cr.priority === "high" ? "bg-red-50 text-red-600" :
                cr.priority === "low" ? "bg-green-50 text-green-600" :
                "bg-yellow-50 text-yellow-600"
              }`}>{cr.priority}</span>
            </div>
            <p className="font-semibold text-slate-900 text-sm">{cr.title}</p>
            <p className="text-xs text-slate-500">{cr.description}</p>
            <p className="text-xs text-slate-400">
              Requested by: <span className="font-medium text-slate-600">{cr.requester_name}</span>
            </p>
            {meta?.requested_value && (
              <p className="text-xs text-slate-500">
                Requested value: <span className="font-bold text-slate-700">{meta.requested_value}</span>
              </p>
            )}
          </div>

          {/* Auto-apply value field */}
          {AUTO_APPLY_TYPES.includes(cr.cr_type) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {cr.cr_type === "Salary Revision" && "New Salary (₹)"}
                {cr.cr_type === "Leave Adjustment" && "Casual Leave Days to Set"}
                {cr.cr_type === "Shift Change" && "New Shift (HH:MM-HH:MM)"}
              </Label>
              <Input
                data-testid="cr-apply-value-input"
                type={cr.cr_type === "Shift Change" ? "text" : "number"}
                min="0"
                placeholder={
                  cr.cr_type === "Salary Revision" ? "e.g. 50000" :
                  cr.cr_type === "Leave Adjustment" ? "e.g. 15" :
                  "e.g. 09:30-17:30"
                }
                value={applyData.apply_value}
                onChange={e => onApplyDataChange({ ...applyData, apply_value: e.target.value })}
                className="rounded-xl h-11"
              />
              <p className="text-xs text-slate-400">This value will be auto-applied to the employee record on approval.</p>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Notes (optional)</Label>
            <Input
              data-testid="cr-admin-notes-input"
              placeholder="Add notes..."
              value={applyData.notes}
              onChange={e => onApplyDataChange({ ...applyData, notes: e.target.value })}
              className="rounded-xl h-11"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              data-testid="cr-confirm-approve-btn"
              onClick={() => onConfirm("approve")}
              className="flex-1 bg-[#002FA7] hover:bg-[#001F70] text-white rounded-xl"
            >
              <Check className="h-4 w-4 mr-2" /> Approve &amp; Apply
            </Button>
            <Button
              data-testid="cr-confirm-reject-btn"
              variant="ghost"
              onClick={() => onConfirm("reject")}
              className="flex-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200"
            >
              <X className="h-4 w-4 mr-2" /> Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
