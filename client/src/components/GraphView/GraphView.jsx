import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useApp, buildSelection } from '../../store/AppContext';
import ScopePicker from '../shared/ScopePicker';

const DIFF_COLORS = { 1: '#00ff88', 2: '#88ff00', 3: '#ffff00', 4: '#ff8800', 5: '#ff0044' };
const GROUP_COLORS = {
  'AI/ML': '#00ffff', 'Systems': '#ff8800', 'Math': '#ffff00',
  'Data Science': '#00ff88', 'NLP': '#aa88ff', 'CV': '#ff88aa',
  'RL': '#ff0088', 'Deep Learning': '#0088ff', 'Electives': '#888888',
  'CS': '#66ccff', 'Capstone': '#ff4488', default: '#00ffff'
};

export default function GraphView() {
  const svgRef = useRef(null);
  const { graphData, graphLoaded, refreshGraph, completedCourseIds, selectedProgramId, targetCourseId } = useApp();
  const [tooltip, setTooltip] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const simulationRef = useRef(null);
  const selectedIdRef = useRef(null);

  useEffect(() => {
    // Scoped when a selection exists (graph shows the planning scope);
    // otherwise the full catalog overview for dataset browsing.
    if (!graphLoaded) refreshGraph(buildSelection({ selectedProgramId, targetCourseId }));
  }, [graphLoaded, refreshGraph, selectedProgramId, targetCourseId]);

  const buildGraph = useCallback(() => {
    if (!graphData?.nodes?.length || !svgRef.current) return;

    // Stop any prior simulation to avoid stacking CPU work
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    const container = svgRef.current.parentElement;
    const W = container.clientWidth || 900;
    const H = container.clientHeight || 600;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', W).attr('height', H);

    // Defs: arrowhead + glow filter
    const defs = svg.append('defs');

    // Arrowhead
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 28)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(0,255,255,0.5)');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);

    // Filter nodes
    let nodes = graphData.nodes.map(n => ({ ...n }));
    let edges = graphData.edges.map(e => ({ ...e }));

    // Force simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(100).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide().radius(35))
      .force('x', d3.forceX(W / 2).strength(0.05))
      .force('y', d3.forceY(H / 2).strength(0.05));

    simulationRef.current = sim;

    // Links
    const link = g.append('g').selectAll('line')
      .data(edges).enter().append('line')
      .attr('stroke', 'rgba(0,255,255,0.2)')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Node groups
    const node = g.append('g').selectAll('g')
      .data(nodes).enter().append('g')
      .attr('class', 'graph-node')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    // Circle
    node.append('circle')
      .attr('class', 'node-body')
      .attr('r', d => 14 + d.credits * 1.5)
      .attr('fill', d => {
        const base = GROUP_COLORS[d.group] || GROUP_COLORS.default;
        const isCompleted = completedCourseIds.includes(d.id);
        return isCompleted ? 'rgba(0,255,136,0.2)' : `${base}18`;
      })
      .attr('stroke', d => {
        const isCompleted = completedCourseIds.includes(d.id);
        return isCompleted ? '#00ff88' : (GROUP_COLORS[d.group] || GROUP_COLORS.default);
      })
      .attr('stroke-width', 1.5)
      .style('filter', 'none');

    // Difficulty ring
    node.append('circle')
      .attr('class', 'node-ring')
      .attr('r', d => 14 + d.credits * 1.5 + 4)
      .attr('fill', 'none')
      .attr('stroke', d => DIFF_COLORS[d.difficulty] || '#00ffff')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '3,4')
      .attr('opacity', 0.4);

    // Label
    node.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('font-family', 'Share Tech Mono')
      .style('fill', '#e0f8ff')
      .style('pointer-events', 'none')
      .text(d => d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name);

    // Credits badge
    node.append('text')
      .attr('dy', d => (14 + d.credits * 1.5) + 12)
      .attr('text-anchor', 'middle')
      .style('font-size', '7px')
      .style('font-family', 'Share Tech Mono')
      .style('fill', 'rgba(0,255,255,0.5)')
      .text(d => `${d.credits}cr`);

    // Interactions
    node
      .on('mouseover', (e, d) => {
        setTooltip({ x: e.offsetX, y: e.offsetY, data: d });
        d3.select(e.currentTarget).select('circle')
          .attr('stroke-width', 2.5)
          .style('filter', 'url(#glow)');
      })
      .on('mousemove', (e) => {
        setTooltip(t => t ? { ...t, x: e.offsetX, y: e.offsetY } : null);
      })
      .on('mouseout', (e, d) => {
        setTooltip(null);
        const isSelected = selectedIdRef.current === d.id;
        d3.select(e.currentTarget).select('circle.node-body')
          .attr('stroke-width', isSelected ? 2.5 : 1.5)
          .style('filter', isSelected ? 'url(#glow)' : 'none');
      })
      .on('click', (e, d) => {
        setSelectedNode(prev => prev?.id === d.id ? null : d);
        e.stopPropagation();
      });

    svg.on('click', () => setSelectedNode(null));

    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

  }, [graphData, completedCourseIds]);

  useEffect(() => { buildGraph(); }, [buildGraph]);

  useEffect(() => {
    selectedIdRef.current = selectedNode?.id || null;
    if (!svgRef.current) return;
    const selectedId = selectedIdRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('g.graph-node').each(function(d) {
      const isSelected = selectedId && d.id === selectedId;
      d3.select(this).select('circle.node-body')
        .attr('stroke-width', isSelected ? 2.5 : 1.5)
        .style('filter', isSelected ? 'url(#glow)' : 'none');
    });
  }, [selectedNode]);

  useEffect(() => () => {
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }
  }, []);

  const stats = graphData?.stats || {};
  const graphScope = graphData?.scope || null;

  return (
    <div className="flex flex-col h-full gap-4 max-w-7xl mx-auto">
      <ScopePicker compact />
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">◎ Prerequisite Graph</h2>
        {graphScope
          ? <span className="text-[10px] font-mono text-cyan-500">Scoped: {graphScope.selectedName} · {graphScope.size} courses · {graphScope.edgeCount} relationships</span>
          : <span className="text-[10px] font-mono text-cyan-700">Full catalog overview — select a scope to plan</span>}
        <div className="flex gap-2 ml-auto">
          <span className="tag tag-cyan">{stats.totalCourses || 0} nodes</span>
          <span className="tag tag-blue">{stats.totalEdges || 0} edges</span>
          <button onClick={() => refreshGraph(buildSelection({ selectedProgramId, targetCourseId }))} className="btn-neon text-[10px] py-1 px-3">↺ REFRESH</button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Graph canvas */}
        <div className="flex-1 tron-card relative overflow-hidden" style={{ minHeight: '500px' }}>
          <svg ref={svgRef} className="w-full h-full" />

          {/* Legend */}
          <div className="absolute top-3 left-3 space-y-1">
            {Object.entries(GROUP_COLORS).slice(0,8).map(([group, color]) => (
              <div key={group} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                <span className="text-[9px] font-mono" style={{ color }}>{group}</span>
              </div>
            ))}
          </div>

          {/* Tooltip */}
          {tooltip && (
            <div className="tron-tooltip absolute pointer-events-none"
              style={{ left: tooltip.x + 12, top: tooltip.y - 20, maxWidth: 220 }}>
              <div className="font-bold text-cyan-300 text-xs mb-1">{tooltip.data.name}</div>
              <div className="space-y-0.5 text-[10px] font-mono">
                <div>ID: <span className="text-cyan-500">{tooltip.data.id}</span></div>
                <div>Credits: <span className="text-cyan-400">{tooltip.data.credits}</span></div>
                <div>Difficulty: <span style={{ color: DIFF_COLORS[tooltip.data.difficulty] }}>
                  {'★'.repeat(tooltip.data.difficulty)}
                </span></div>
                <div>Group: <span className="text-cyan-500">{tooltip.data.group}</span></div>
                {tooltip.data.prerequisites?.length > 0 && (
                  <div>Prereqs: <span className="text-cyan-600">{tooltip.data.prerequisites.join(', ')}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Difficulty legend */}
          <div className="absolute bottom-3 left-3 flex gap-3">
            {[1,2,3,4,5].map(d => (
              <div key={d} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: DIFF_COLORS[d] }} />
                <span className="text-[8px] font-mono" style={{ color: DIFF_COLORS[d] }}>D{d}</span>
              </div>
            ))}
          </div>

          {/* Zoom hint */}
          <div className="absolute bottom-3 right-3 text-[9px] font-mono text-cyan-800">
            Scroll to zoom · Drag nodes · Click to select
          </div>
        </div>

        {/* Selected node detail */}
        {selectedNode && (
          <div className="w-56 tron-card p-4 flex-shrink-0">
            <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono mb-3">Selected</h4>
            <div className="space-y-2.5">
              <div>
                <div className="text-[10px] text-cyan-700 font-mono">NAME</div>
                <div className="text-sm text-cyan-200 font-mono leading-tight">{selectedNode.name}</div>
              </div>
              <div>
                <div className="text-[10px] text-cyan-700 font-mono">ID</div>
                <div className="text-xs text-cyan-500 font-mono">{selectedNode.id}</div>
              </div>
              <div className="flex gap-3">
                <div>
                  <div className="text-[10px] text-cyan-700 font-mono">CREDITS</div>
                  <div className="text-sm font-mono text-cyan-300">{selectedNode.credits}</div>
                </div>
                <div>
                  <div className="text-[10px] text-cyan-700 font-mono">DIFF</div>
                  <div className="text-sm font-mono" style={{ color: DIFF_COLORS[selectedNode.difficulty] }}>
                    {'★'.repeat(selectedNode.difficulty)}
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-cyan-700 font-mono mb-1">TAGS</div>
                <div className="flex flex-wrap gap-1">
                  {(selectedNode.tags || []).map(t => (
                    <span key={t} className="tag tag-cyan text-[9px]">{t}</span>
                  ))}
                </div>
              </div>
              {selectedNode.prerequisites?.length > 0 && (
                <div>
                  <div className="text-[10px] text-cyan-700 font-mono mb-1">PREREQUISITES</div>
                  <div className="space-y-1">
                    {selectedNode.prerequisites.map(p => (
                      <div key={p} className="text-[10px] font-mono text-cyan-500">→ {p}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
