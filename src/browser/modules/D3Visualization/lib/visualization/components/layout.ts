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
import * as d3Force from 'd3-force'
import * as d3Selection from 'd3-selection'
import collision from './collision'
import circularLayout from '../utils/circularLayout'
import cloneArray from '../utils/arrays'
import Graph from 'project-root/src/browser/modules/D3Visualization/lib/visualization/components/graph'

export type ForceLayout = {
  init: any
}
const layout = {
  force: (): ForceLayout => {
    return {
      init: (render: any, graph: Graph) => {
        console.log('render', render)
        console.log('graph', graph)
        const forceLayout: any = {}

        const linkDistance = 45

        const nodesArray = cloneArray(graph.nodes())
        console.log('original nodesArray[0].x', nodesArray[0].x)
        const d3force: d3Force.Simulation<any, any> = d3Force
          .forceSimulation(nodesArray)
          .force('collide', d3Force.forceCollide(9))
        //   .force(
        // 'link',
        // d3Force
        //   .forceLink()
        //   .distance(
        //     (relationship: any) =>
        //       relationship.source.radius +
        //       relationship.target.radius +
        //       linkDistance
        //   )
        // .strength(-1000)
        // ) // ref https://stackoverflow.com/questions/62756923/d3-js-upgrading-force-layout-from-v3-to-v4

        d3force.on('tick', () => {
          console.log('tick nodesArray[0].x', nodesArray[0].x)
          d3Selection
            .select('svg')
            .select('g.layer.nodes')
            .selectAll('g.node')
            .data(nodesArray, (d: any) => d.id)
          // d3Selection.select('svg')
          //     .selectAll('circle')
          //     .data(nodesArray)
          //     .join('circle')
          //     .attr('r', 5)
          //     .attr('cx', function(d) {
          //       return d.x
          //     })
          //     .attr('cy', function(d) {
          //       return d.y
          //     });
        })

        const newStatsBucket = function() {
          const bucket = {
            layoutTime: 0,
            layoutSteps: 0
          }
          return bucket
        }

        let currentStats = newStatsBucket()

        forceLayout.collectStats = function() {
          const latestStats = currentStats
          currentStats = newStatsBucket()
          return latestStats
        }

        const accelerateLayout = function() {
          let maxStepsPerTick = 100
          const maxAnimationFramesPerSecond = 60
          const maxComputeTime = 1000 / maxAnimationFramesPerSecond
          const now =
            window.performance && window.performance.now
              ? () => window.performance.now()
              : () => Date.now()

          const d3Tick = d3force.tick
          return (d3force.tick = function() {
            console.log('tick')
            const startTick = now()
            let step = maxStepsPerTick
            while (step-- && now() - startTick < maxComputeTime) {
              const startCalcs = now()
              currentStats.layoutSteps++

              collision.avoidOverlap(d3force.nodes())

              if (d3Tick()) {
                maxStepsPerTick = 2
                return true
              }
              currentStats.layoutTime += now() - startCalcs
            }
            render()
            return false
          } as any)
        }

        accelerateLayout()

        const oneRelationshipPerPairOfNodes = (graph: any) =>
          Array.from(graph.groupedRelationships()).map(
            (pair: any) => pair.relationships[0]
          )

        forceLayout.update = function(graph: Graph, size: any) {
          console.log('update')
          const nodes = cloneArray(graph.nodes())
          const relationships = oneRelationshipPerPairOfNodes(graph)

          const radius = (nodes.length * linkDistance) / (Math.PI * 2)
          const center = {
            x: size[0] / 2,
            y: size[1] / 2
          }
          circularLayout(nodes, center, radius)

          return d3force.nodes(nodes).force(
            'link',
            d3Force
              .forceLink(relationships)
              .distance(
                (relationship: any) =>
                  relationship.source.radius +
                  relationship.target.radius +
                  linkDistance
              )
          )
          // .size(size) // TODO: replace with x and y
        }

        // forceLayout.drag = d3force.drag
        forceLayout.nodesArray = nodesArray
        return forceLayout
      }
    }
  }
}

export default layout
