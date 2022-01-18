/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { D3DragEvent, drag as d3Drag } from 'd3-drag'
import { easeCubic } from 'd3-ease'
import { Simulation } from 'd3-force'
import { BaseType, select as d3Select } from 'd3-selection'
import { Transition } from 'd3-transition'
import { D3ZoomEvent, zoom as d3Zoom } from 'd3-zoom'
import * as d3Zooming from 'd3-zoom'

import * as vizRenderers from '../renders/init'
import { nodeMenuRenderer } from '../renders/menu'
import Graph from './Graph'
import GraphGeometry from './GraphGeometry'
import Relationship from './Relationship'
import VizNode from './VizNode'
import { Layout, clearSimulationTimeout, setSimulationTimeout } from './layout'
import GraphStyle from 'browser/modules/D3Visualization/graphStyle'

export type MeasureSizeFn = () => { width: number; height: number }
export type VizObj = {
  style: any
  trigger: (_event: any, ..._args: any[]) => void
  zoomInClick: (el: any) => { zoomInLimit: boolean; zoomOutLimit: boolean }
  zoomOutClick: (el: any) => { zoomInLimit: boolean; zoomOutLimit: boolean }
  zoomToFitClick: () => void
  boundingBox: () => void
  resize: () => void
  update: (options: {
    updateNodes: boolean
    updateRelationships: boolean
    precompute?: boolean
  }) => void
}

const ZOOM_SCALE_MIN = 0.1
const ZOOM_SCALE_MAX = 2

const noOp = () => undefined
const vizFn = function (
  el: SVGElement,
  measureSize: MeasureSizeFn,
  graph: Graph,
  layout: Layout,
  style: GraphStyle
): VizObj {
  const viz: VizObj = {
    style,
    // to be overwritten externally
    trigger: noOp,
    // to be defined later in this file, adding now for type safety
    zoomInClick: () => ({
      zoomInLimit: false,
      zoomOutLimit: false
    }),
    zoomOutClick: () => ({
      zoomInLimit: false,
      zoomOutLimit: false
    }),
    zoomToFitClick: () => {
      return
    },
    boundingBox: noOp,
    resize: noOp,
    update: noOp
  }

  const root = d3Select(el)
  const baseGroup = root
    .append('g')
    .attr('id', 'baseGroup')
    .attr('transform', 'translate(0,0)')
  const rect = baseGroup
    .append('rect')
    .style('fill', 'none')
    .style('pointer-events', 'all')
    // Make the rect cover the whole surface, center of the svg viewbox is in (0,0)
    .attr('x', () => -Math.floor(measureSize().width / 2))
    .attr('y', () => -Math.floor(measureSize().height / 2))
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('transform', 'scale(1)')

  const container = baseGroup.append('g').attr('id', 'container')
  const geometry = new GraphGeometry(style)

  // This flags that a panning is ongoing and won't trigger
  // 'canvasClick' event when panning ends.
  let draw = false

  let updateViz = true
  let isZoomClick = false

  const onNodeClick = (_event: Event, node: VizNode) => {
    updateViz = false
    return viz.trigger('nodeClicked', node)
  }

  const onNodeDblClick = (_event: Event, node: VizNode) =>
    viz.trigger('nodeDblClicked', node)

  const onRelationshipClick = function (
    event: Event,
    relationship: Relationship
  ) {
    event.stopPropagation()
    updateViz = false
    return viz.trigger('relationshipClicked', relationship)
  }

  const onNodeMouseOver = (_event: Event, node: VizNode) => {
    if (!node.fx && !node.fy) {
      node.hoverFixed = true
      node.fx = node.x
      node.fy = node.y
    }
    return viz.trigger('nodeMouseOver', node)
  }

  const onNodeMouseOut = (_event: Event, node: VizNode) => {
    if (node.hoverFixed) {
      node.hoverFixed = false
      node.fx = null
      node.fy = null
    }
    return viz.trigger('nodeMouseOut', node)
  }

  const onRelMouseOver = (_event: Event, rel: Relationship) =>
    viz.trigger('relMouseOver', rel)

  const onRelMouseOut = (_event: Event, rel: Relationship) =>
    viz.trigger('relMouseOut', rel)

  const handleZoomOnShiftScroll = (e: WheelEvent) => {
    if (e.shiftKey) {
      e.preventDefault()

      // This is the default implementation of wheelDelta function in d3-zoom v3.0.0
      // For some reasons typescript complains when trying to get it by calling zoomBehaviour.wheelDelta() instead
      // but it should be the same
      const delta =
        -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002)

      return zoomBehavior.scaleBy(root, 1 + delta)
    }
  }

  const zoomed = function (
    e: D3ZoomEvent<SVGGElement, unknown>
  ): Transition<SVGGElement, unknown, null, undefined> {
    draw = true

    if (isZoomClick) {
      // When clicking on the zoom buttons show a longer animation than when
      // using the scroll wheel.
      isZoomClick = false

      return container
        .transition()
        .duration(400)
        .ease(easeCubic)
        .attr('transform', String(e.transform))
    }

    return container
      .transition()
      .duration(20)
      .attr('transform', String(e.transform))
  }

  const zoomBehavior = d3Zoom<SVGElement, unknown>()
    .scaleExtent([ZOOM_SCALE_MIN, ZOOM_SCALE_MAX])
    .on('zoom', zoomed)
  // .filter(((event: KeyboardEvent | MouseEvent) => event.shiftKey)) // shift eller musklick i

  let isZoomingIn = true

  viz.zoomInClick = function () {
    isZoomingIn = true
    return zoomClick(this)
  }

  viz.zoomOutClick = function () {
    isZoomingIn = false
    return zoomClick(this)
  }

  const zoomClick = function (_element: any) {
    draw = true
    isZoomClick = true
    const limitsReached = { zoomInLimit: false, zoomOutLimit: false }

    zoomBehavior.scaleBy(root, isZoomingIn ? 1.3 : 0.7)

    return limitsReached
  }
  // Background click event
  // Check if panning is ongoing
  rect.on('click', () => {
    if (!draw) {
      return viz.trigger('canvasClicked', el)
    }
  })

  viz.zoomToFitClick = () => {
    draw = true
    isZoomClick = true
    zoomToFitWholeGraph()
  }

  const zoomToFitWholeGraph = () => {
    const bounds = container.node()?.getBBox()
    const availableWidth = root.node()?.clientWidth
    const availableHeight = root.node()?.clientHeight

    if (bounds && availableWidth && availableHeight) {
      const width = bounds.width
      const height = bounds.height

      if (width === 0 || height === 0) return

      const paddingPercent = 0.95
      const scale =
        paddingPercent /
        Math.max(width / availableWidth, height / availableHeight)

      zoomBehavior.transform(
        root,
        d3Zooming.zoomIdentity
          .translate(0, 0)
          .scale(Math.min(scale, ZOOM_SCALE_MAX))
      )
    }
  }

  root
    .call(zoomBehavior)
    .on('dblclick.zoom', null as any)
    // Single click is not panning
    .on('click.zoom', null as any) //() => (draw = false))
  // .on('DOMMouseScroll.zoom', handleZoomOnShiftScroll)
  // .on('wheel.zoom', handleZoomOnShiftScroll)
  // .on('mousewheel.zoom', handleZoomOnShiftScroll)

  const render = function () {
    geometry.onTick(graph)

    const nodeGroups = container
      .selectAll<BaseType, VizNode>('g.node')
      .attr('transform', d => `translate(${d.x},${d.y})`)

    for (const renderer of vizRenderers.node) {
      nodeGroups.call(renderer.onTick, viz)
    }

    const relationshipGroups = container
      .selectAll<BaseType, Relationship>('g.relationship')
      .attr(
        'transform',
        d =>
          `translate(${d.source.x} ${d.source.y}) rotate(${
            d.naturalAngle + 180
          })`
      )

    for (const renderer of vizRenderers.relationship) {
      relationshipGroups.call(renderer.onTick, viz)
    }
  }

  const force = layout.init(render)

  viz.update = function (options: {
    updateNodes: boolean
    updateRelationships: boolean
    precompute?: boolean
  }) {
    if (!graph) {
      return
    }

    geometry.onGraphChange(graph, options)

    const layers = container
      .selectAll('g.layer')
      .data(['relationships', 'nodes'])
      .join('g')
      .attr('class', d => `layer ${d}`)

    const nodes = graph.nodes()
    const relationships = graph.relationships()

    const relationshipGroups = container
      .select('g.layer.relationships')
      .selectAll<BaseType, Relationship>('g.relationship')
      .data(relationships, d => d.id)
      .join('g')
      .attr('class', 'relationship')
      .on('mousedown', onRelationshipClick)
      .on('mouseover', onRelMouseOver)
      .on('mouseout', onRelMouseOut)
      .classed('selected', relationship => relationship.selected)

    for (const renderer of vizRenderers.relationship) {
      relationshipGroups.call(renderer.onGraphChange, viz)
    }

    function dragHandler(simulation: Simulation<VizNode, Relationship>) {
      function dragstarted(event: D3DragEvent<SVGGElement, VizNode, any>) {
        clearSimulationTimeout()
        if (!event.active) simulation.alphaTarget(0.03).alpha(1).restart()
      }

      function dragged(event: D3DragEvent<SVGGElement, VizNode, any>) {
        event.subject.fx = event.x
        event.subject.fy = event.y
      }

      function dragended(_event: D3DragEvent<SVGGElement, VizNode, any>) {
        setSimulationTimeout(simulation)
      }

      return d3Drag<SVGGElement, VizNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
    }

    const nodeGroups = container
      .select('g.layer.nodes')
      .selectAll<BaseType, VizNode>('g.node')
      .data(nodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      // @ts-ignore
      .call(dragHandler(force.simulation))
      .on('mouseover', onNodeMouseOver)
      .on('mouseout', onNodeMouseOut)
      .on('click', onNodeClick)
      .on('dblclick', onNodeDblClick)
      .classed('selected', node => node.selected)

    for (const renderer of vizRenderers.node) {
      nodeGroups.call(renderer.onGraphChange, viz)
    }

    for (const renderer of nodeMenuRenderer) {
      nodeGroups.call(renderer.onGraphChange, viz)
    }

    if (updateViz) {
      force.update(graph, options.precompute)

      viz.resize()
      viz.trigger('updated')
    }

    return (updateViz = true)
  }

  viz.resize = function () {
    const size = measureSize()
    rect
      .attr('x', () => -Math.floor(size.width / 2))
      .attr('y', () => -Math.floor(size.height / 2))
    root.attr(
      'viewBox',
      [
        -Math.floor(size.width / 2),
        -Math.floor(size.height / 2),
        size.width,
        size.height
      ].join(' ')
    )
  }

  viz.boundingBox = () => container.node()?.getBBox()
  return viz
}

export default vizFn
