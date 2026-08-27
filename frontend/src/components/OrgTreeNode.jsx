import { Camera, PencilSimple, Trash } from "@phosphor-icons/react";

const LEVEL_STYLES = [
  { badge: "bg-[#002FA7]",  lane: "bg-blue-50/60",   border: "border-blue-100",   ring: "ring-blue-200",   defaultLabel: "Executive" },
  { badge: "bg-indigo-600", lane: "bg-indigo-50/60", border: "border-indigo-100", ring: "ring-indigo-200", defaultLabel: "Director"  },
  { badge: "bg-violet-600", lane: "bg-violet-50/60", border: "border-violet-100", ring: "ring-violet-200", defaultLabel: "Manager"   },
  { badge: "bg-purple-600", lane: "bg-purple-50/60", border: "border-purple-100", ring: "ring-purple-200", defaultLabel: "Team Lead" },
  { badge: "bg-slate-600",  lane: "bg-slate-50/60",  border: "border-slate-100",  ring: "ring-slate-200",  defaultLabel: "Employee"  },
  { badge: "bg-slate-400",  lane: "bg-gray-50/60",   border: "border-gray-100",   ring: "ring-gray-200",   defaultLabel: "Associate" },
];

function getStyle(depth) {
  return LEVEL_STYLES[depth] || LEVEL_STYLES[LEVEL_STYLES.length - 1];
}

function getLabel(depth, levelLabels) {
  if (levelLabels && levelLabels.length > 0) {
    const found = levelLabels.find(l => l.level_num === depth);
    if (found) return found.label;
  }
  return getStyle(depth).defaultLabel;
}

// Groups nodes by their assigned level_num (admin-assigned, not parent depth)
function buildLevels(flatNodes) {
  if (!flatNodes || flatNodes.length === 0) return [];
  const grouped = {};
  flatNodes.forEach(n => {
    const lvl = n.level_num ?? 0;
    if (!grouped[lvl]) grouped[lvl] = [];
    // Attach parentName
    const parent = flatNodes.find(p => p.id === n.parent_id);
    grouped[lvl].push({ ...n, parentName: parent ? parent.employee_name : null });
  });
  // Return sorted by level number
  const maxLevel = Math.max(...Object.keys(grouped).map(Number));
  return Array.from({ length: maxLevel + 1 }, (_, i) => grouped[i] || []);
}

function AdminCard({ node, cfg, onEdit, onDelete, onImageUpload }) {
  return (
    <div
      data-testid={`org-node-${node.id}`}
      className="relative group bg-white rounded-2xl border-2 border-slate-200 hover:border-[#002FA7] hover:shadow-xl transition-all duration-200 p-4 flex items-center gap-3 cursor-default"
      style={{ minWidth: 210, maxWidth: 250 }}
    >
      <div className="relative flex-shrink-0">
        {node.image_url ? (
          <img src={node.image_url} alt={node.employee_name} className={`w-12 h-12 rounded-full object-cover ring-2 ${cfg.ring}`} />
        ) : (
          <div className={`w-12 h-12 rounded-full ${cfg.badge} flex items-center justify-center ring-2 ring-white`}>
            <span className="text-lg font-extrabold text-white">{node.employee_name?.[0] || "?"}</span>
          </div>
        )}
        {onImageUpload && (
          <label className="absolute -bottom-1 -right-1 bg-[#002FA7] text-white rounded-full p-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shadow">
            <Camera className="h-3 w-3" weight="bold" />
            <input type="file" className="hidden" accept="image/*"
              onChange={e => e.target.files[0] && onImageUpload(node.id, e.target.files[0])} />
          </label>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm leading-tight truncate">{node.employee_name}</p>
        {node.job_title && <p className="text-xs font-semibold text-[#002FA7] truncate mt-0.5">{node.job_title}</p>}
        {node.parentName && (
          <p className="text-xs text-slate-400 truncate mt-1 flex items-center gap-1">
            <span className="inline-block w-3 h-px bg-slate-300" />
            {node.parentName}
          </p>
        )}
        {node.description && <p className="text-xs text-slate-400 truncate mt-0.5">{node.description}</p>}
      </div>
      {onEdit && (
        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button data-testid={`edit-org-${node.id}`} onClick={() => onEdit(node)} className="p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 shadow-sm">
            <PencilSimple className="h-3 w-3 text-[#002FA7]" />
          </button>
          <button data-testid={`delete-org-${node.id}`} onClick={() => onDelete(node.id)} className="p-1.5 bg-white rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 shadow-sm">
            <Trash className="h-3 w-3 text-red-500" />
          </button>
        </div>
      )}
    </div>
  );
}

function ViewCard({ node, cfg }) {
  return (
    <div
      data-testid={`org-node-view-${node.id}`}
      className="bg-white rounded-2xl border-2 border-slate-200 p-4 flex items-center gap-3"
      style={{ minWidth: 210, maxWidth: 250 }}
    >
      <div className="flex-shrink-0">
        {node.image_url ? (
          <img src={node.image_url} alt={node.employee_name} className={`w-12 h-12 rounded-full object-cover ring-2 ${cfg.ring}`} />
        ) : (
          <div className={`w-12 h-12 rounded-full ${cfg.badge} flex items-center justify-center ring-2 ring-white`}>
            <span className="text-lg font-extrabold text-white">{node.employee_name?.[0] || "?"}</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-900 text-sm leading-tight truncate">{node.employee_name}</p>
        {node.job_title && <p className="text-xs font-semibold text-[#002FA7] truncate mt-0.5">{node.job_title}</p>}
        {node.parentName && (
          <p className="text-xs text-slate-400 truncate mt-1 flex items-center gap-1">
            <span className="inline-block w-3 h-px bg-slate-300" />
            {node.parentName}
          </p>
        )}
      </div>
    </div>
  );
}

function SwimlaneRow({ depth, levelNodes, levelLabels, isAdmin, onEdit, onDelete, onImageUpload }) {
  const cfg = getStyle(depth);
  const label = getLabel(depth, levelLabels);
  return (
    <div className={`flex items-stretch ${depth > 0 ? "border-t border-slate-200" : ""}`}>
      <div className={`flex-shrink-0 w-28 flex flex-col items-center justify-center gap-1.5 py-5 px-3 ${cfg.lane} border-r ${cfg.border}`}>
        <span className={`${cfg.badge} text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full`}>L{depth + 1}</span>
        <p className="text-[11px] text-slate-600 font-semibold text-center leading-tight">{label}</p>
        <p className="text-[10px] text-slate-400 text-center">{levelNodes.length} {levelNodes.length === 1 ? "person" : "people"}</p>
      </div>
      <div className={`flex-1 flex items-center flex-wrap gap-3 px-6 py-4 ${cfg.lane}`}>
        {levelNodes.map(n => (
          isAdmin
            ? <AdminCard key={n.id} node={n} cfg={cfg} onEdit={onEdit} onDelete={onDelete} onImageUpload={onImageUpload} />
            : <ViewCard key={n.id} node={n} cfg={cfg} />
        ))}
      </div>
    </div>
  );
}

// Admin org chart (editable)
export function OrgTreeNode({ nodes, levelLabels, isAdmin, onEdit, onDelete, onImageUpload }) {
  const levels = buildLevels(nodes);
  if (levels.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {levels.map((levelNodes, depth) => (
        levelNodes.length > 0 && (
          <SwimlaneRow key={depth} depth={depth} levelNodes={levelNodes} levelLabels={levelLabels}
            isAdmin={isAdmin} onEdit={onEdit} onDelete={onDelete} onImageUpload={onImageUpload} />
        )
      ))}
    </div>
  );
}

// View-only org chart (employees / managers)
export function OrgTreeView({ nodes, levelLabels }) {
  const levels = buildLevels(nodes);
  if (levels.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {levels.map((levelNodes, depth) => (
        levelNodes.length > 0 && (
          <SwimlaneRow key={depth} depth={depth} levelNodes={levelNodes} levelLabels={levelLabels}
            isAdmin={false} />
        )
      ))}
    </div>
  );
}

// Kept for backward compat
export function buildOrgTree(nodes) {
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach(n => {
    if (n.parent_id && nodeMap[n.parent_id]) nodeMap[n.parent_id].children.push(nodeMap[n.id]);
    else roots.push(nodeMap[n.id]);
  });
  return roots;
}
