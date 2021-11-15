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

import React from 'react'
import { render, screen } from '@testing-library/react'
import ManualLink from 'browser-components/ManualLink'
import configureMockStore from 'redux-mock-store'
import { Provider } from 'react-redux'

const mockStore = configureMockStore()
const store = mockStore({
  neo4jVersion: ''
})

function renderWithRedux(children: any) {
  return render(<Provider store={store}>{children}</Provider>)
}

const tests: [Record<string, string>, string][] = [
  [
    {
      neo4jVersion: '',
      chapter: 'graph-algorithms',
      page: '/',
      minVersion: ''
    },
    'https://neo4j.com/docs/graph-algorithms/current/'
  ],
  [
    {
      neo4jVersion: '3.5.12',
      chapter: 'cypher-manual',
      page: '/schema/constraints/',
      minVersion: ''
    },
    'https://neo4j.com/docs/cypher-manual/3.5/schema/constraints/'
  ],
  [
    {
      neo4jVersion: '4.0.0-beta03mr03',
      chapter: 'driver-manual',
      page: '',
      minVersion: ''
    },
    'https://neo4j.com/docs/driver-manual/4.0-preview/'
  ],
  [
    {
      neo4jVersion: '3.4.11',
      chapter: 'driver-manual',
      page: '',
      minVersion: '4.0.0'
    },
    'https://neo4j.com/docs/driver-manual/4.0/'
  ],
  [
    {
      neo4jVersion: '4.0.0-rc01',
      chapter: 'driver-manual',
      page: '',
      minVersion: '3.5.0'
    },
    'https://neo4j.com/docs/driver-manual/4.0-preview/'
  ],
  [
    {
      neo4jVersion: '',
      chapter: 'driver-manual',
      page: '/',
      minVersion: '3.5.0'
    },
    'https://neo4j.com/docs/driver-manual/3.5/'
  ]
]

test.each(tests)('Render correct url for props %o', (props, expected) => {
  renderWithRedux(
    <ManualLink
      chapter={props.chapter}
      page={props.page}
      minVersion={props.minVersion}
      text={'link to manual'}
    />
  )

  const url = screen.getByText('link to manual').getAttribute('href')
  expect(url).toEqual(expected)
})

const movedPages: [Record<string, string>, Record<string, string>][] = [
  [
    { neo4jVersion: '3.5.0', page: '/administration/' },
    {
      text: 'Cypher Schema',
      url: 'https://neo4j.com/docs/cypher-manual/3.5/schema/'
    }
  ],
  [
    { neo4jVersion: '4.0.0', page: '/administration/' },
    {
      text: 'link to manual',
      url: 'https://neo4j.com/docs/cypher-manual/4.0/administration/'
    }
  ],
  [
    { page: '/administration/' },
    {
      text: 'link to manual',
      url: 'https://neo4j.com/docs/cypher-manual/current/administration/'
    }
  ]
]

test.each(movedPages)(
  'Render correct url for moved page %o',
  (props, expected) => {
    renderWithRedux(
      <ManualLink
        chapter="cypher-manual"
        page={props.page}
        minVersion={props.minVersion}
        text={'link to manual'}
      />
    )
    const url = screen.getByText(expected.text).getAttribute('href')
    expect(url).toEqual(expected.url)
  }
)

test('should not console error', () => {
  renderWithRedux(
    <ManualLink
      chapter="cypher-manual"
      page={'/'}
      minVersion={''}
      text={'link to manual'}
    />
  )
  const url = screen.getByText('link to manual').getAttribute('href')
  expect(url).toEqual('https://neo4j.com/docs/cypher-manual/current/')
})
