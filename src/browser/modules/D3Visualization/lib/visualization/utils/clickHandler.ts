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
import * as d3Selection from 'd3-selection'
import * as d3Dispatch from 'd3-dispatch'

// ref: https://stackoverflow.com/questions/47844765/d3-rebind-in-d3-v4
// Copies a variable number of methods from source to target.
const rebind = function(target: any, source: any) {
  let i = 1, method
  const n = arguments.length
  while (++i < n)
    target[(method = arguments[i])] = d3_rebind(target, source, source[method])
  return target
}

// Method is assumed to be a standard D3 getter-setter:
// If passed with no arguments, gets the value.
// If passed with arguments, sets the value and returns the target.
function d3_rebind(target: any, source: any, method: any) {
  return function() {
    const value = method.apply(source, arguments)
    return value === source ? target : value
  }
}

export default function clickHandler() {
  const cc = function(selection: any) {
    // euclidean distance
    const dist = (a: any, b: any) =>
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 1 arguments, but got 2.
      Math.sqrt(Math.pow(a[0] - b[0], 2), Math.pow(a[1] - b[1], 2))
    let down: any
    const tolerance = 5
    let wait: any = null
    selection.on('mousedown', () => {
      ;((d3Selection.event as Event).target as any).__data__.fixed = true
      down = d3Selection.mouse(document.body)
      return (d3Selection.event as Event).stopPropagation()
    })

    return selection.on('mouseup', () => {
      if (dist(down, d3Selection.mouse(document.body)) > tolerance) {
      } else {
        if (wait) {
          window.clearTimeout(wait)
          wait = null
          return d3Selection.event.dblclick(
            (d3Selection.event as any).target.__data__
          )
        } else {
          d3Selection.event.click((d3Selection.event as any).target.__data__)
          return (wait = window.setTimeout(
            (_e => () => (wait = null))(d3Selection.event),
            250
          ))
        }
      }
    })
  }

  const event = d3Dispatch.dispatch('click', 'dblclick')
  // @ts-ignore
  return rebind(cc, event, 'on')
}
