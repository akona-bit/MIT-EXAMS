import sys

file_path = "src/pages/admin/KnowledgePage.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# The file currently has header ending at 833, then jumps to right sidebar content at 834.
# Let's verify the content at 833:
if "</div>" in lines[832]:
    pass
else:
    print("Warning: structure not as expected")

prefix = lines[:833]

layout = """      </header>

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
        {/* --- Toolbar / Sidebar Left --- */}
        <aside className="lg:col-span-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Danh sách Tri thức
            </h2>
            <button
              onClick={() => setShowNewNote(true)}
              className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
              title="Thêm Node mới"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Tìm kiếm node..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="ALL">Tất cả phân loại</option>
              <option value="TOPIC">Chủ đề (Topic)</option>
              <option value="CONCEPT">Khái niệm (Concept)</option>
              <option value="SKILL">Kỹ năng (Skill)</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
            {visibleNodes.map((node) => (
              <NodePill
                key={node.id}
                node={node}
                active={selectedId === node.id}
                onClick={() => setSelectedId(node.id)}
              />
            ))}
            {visibleNodes.length === 0 && (
              <div className="text-center p-4 text-sm text-slate-500 italic">
                Không tìm thấy node nào
              </div>
            )}
          </div>
        </aside>

        {/* --- Graph Canvas Center --- */}
        <div className="lg:col-span-2 relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-800 overflow-hidden">
          <GraphCanvas
            nodes={allNodes}
            edges={allEdges}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isDarkMode={isDarkMode}
          />

          {/* New Note Overlay */}
          <AnimatePresence>
            {showNewNote && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-50 p-6 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thêm Node Tri thức</h3>
                  <button onClick={() => setShowNewNote(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateNote} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tên Node</label>
                    <input type="text" required value={noteName} onChange={e => setNoteName(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mô tả</label>
                    <textarea value={noteDescription} onChange={e => setNoteDescription(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Loại Node</label>
                      <select value={noteType} onChange={e => setNoteType(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2">
                        <option value="TOPIC">Chủ đề</option>
                        <option value="CONCEPT">Khái niệm</option>
                        <option value="SKILL">Kỹ năng</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Môn học</label>
                      <input type="text" required value={noteSubject} onChange={e => setNoteSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Node Cha</label>
                    <select value={noteParentId} onChange={e => setNoteParentId(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2">
                      <option value="none">-- Không có node cha (Gốc) --</option>
                      {allNodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                  </div>
                  {noteError && <p className="text-red-500 text-sm">{noteError}</p>}
                  <button type="submit" disabled={createNoteMutation.isPending} className="w-full bg-primary-600 text-white rounded-xl px-4 py-2 font-bold">
                    {createNoteMutation.isPending ? "Đang tạo..." : "Tạo Node"}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- Details Sidebar Right --- */}
        <aside className="lg:col-span-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 dark:border-slate-800 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              {selectedNode ? "Chi tiết Node" : "Chi tiết"}
            </h2>
            {selectedNode && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                {levelLabels[selectedNode.type] ?? selectedNode.type}
              </span>
            )}
          </div>

          {selectedNode ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedNode.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    {selectedNode.label}
                  </h2>
"""

suffix = lines[833:]

with open(file_path, "w", encoding="utf-8") as f:
    for line in prefix:
        f.write(line)
    f.write(layout)
    for line in suffix:
        f.write(line)

print("Done")
