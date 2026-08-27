import { Camera, PencilSimple, Trash } from "@phosphor-icons/react";

export function buildOrgTree(nodes) {
  const nodeMap = {};
  nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach(n => {
    if (n.parent_id && nodeMap[n.parent_id]) {
      nodeMap[n.parent_id].children.push(nodeMap[n.id]);
    } else {
      roots.push(nodeMap[n.id]);
    }
  });
  return roots;
}

// Render a single node card (no recursion)
export function OrgNodeCard({ node, isAdmin, onEdit, onDelete, onImageUpload }) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 160 }}>
      <div
        data-testid={`org-node-${node.id}`}
        className="relative bg-white border-2 border-slate-200 rounded-xl p-4 flex flex-col items-center text-center hover:border-[#002FA7] hover:shadow-md transition-all cursor-default group"
        style={{ width: 152 }}
      >
        <div className="relative mb-2">
          {node.image_url ? (
            <img src={node.image_url} alt={node.employee_name} className="w-14 h-14 rounded-full object-cover border-2 border-slate-200" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center">
              <span className="text-xl font-bold text-[#002FA7]">{node.employee_name?.[0] || "?"}</span>
            </div>
          )}
          {isAdmin && (
            <label className="absolute -bottom-1 -right-1 bg-[#002FA7] text-white rounded-full p-1 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="h-3 w-3" weight="bold" />
              <input type="file" className="hidden" accept="image/*"
                onChange={e => e.target.files[0] && onImageUpload(node.id, e.target.files[0])} />
            </label>
          )}
        </div>
        <p className="font-bold text-slate-900 text-sm leading-tight">{node.employee_name}</p>
        {node.job_title && <p className="text-xs text-[#002FA7] font-semibold mt-0.5">{node.job_title}</p>}
        {node.description && <p className="text-xs text-slate-400 mt-1 leading-snug line-clamp-2">{node.description}</p>}
        {isAdmin && (
          <div className="absolute top-1.5 right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button data-testid={`edit-org-${node.id}`} onClick={() => onEdit(node)} className="p-1 bg-white rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200">
              <PencilSimple className="h-3 w-3 text-[#002FA7]" />
            </button>
            <button data-testid={`delete-org-${node.id}`} onClick={() => onDelete(node.id)} className="p-1 bg-white rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200">
              <Trash className="h-3 w-3 text-red-500" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Iterative full tree rendering using level-by-level BFS layout
export function OrgTreeNode({ node, isAdmin, onEdit, onDelete, onImageUpload }) {
  // Collect all nodes in BFS order grouped by depth
  const levels = [];
  const queue = [{ node, depth: 0 }];
  while (queue.length > 0) {
    const { node: n, depth } = queue.shift();
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(n);
    (n.children || []).forEach(c => queue.push({ node: c, depth: depth + 1 }));
  }

  const props = { isAdmin, onEdit, onDelete, onImageUpload };

  return (
    <div className="flex flex-col items-center gap-0">
      {levels.map((levelNodes, depth) => (
        <div key={depth} className="flex flex-col items-center">
          {depth > 0 && <div className="w-0.5 h-6 bg-slate-300" />}
          <div className="flex gap-8 relative">
            {levelNodes.length > 1 && depth > 0 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: "calc(100% - 80px)", height: 1, background: "#CBD5E1" }} />
            )}
            {levelNodes.map(n => (
              <div key={n.id} className="flex flex-col items-center">
                {depth > 0 && <div className="w-0.5 h-6 bg-slate-300" />}
                <OrgNodeCard node={n} {...props} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
