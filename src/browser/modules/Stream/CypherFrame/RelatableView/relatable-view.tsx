/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 * This file is part of Neo4j.
 * Neo4j is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
import { get, head, map, slice } from 'lodash-es'
import { QueryResult, Record, isInt } from 'neo4j-driver'
import React, { useMemo, useState } from 'react'
import { connect } from 'react-redux'
import {
  useTable,
  usePagination,
  Column,
  useResizeColumns,
  useFlexLayout,
  Row,
  Cell,
  useExpanded
} from 'react-table'

import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClickableUrls,
  ClipboardCopier,
  WarningMessage
} from 'neo4j-arc/common'
import { Table } from '@neo4j-ndl/react'

import { StyledStatsBar } from '../../styled'
import {
  getBodyAndStatusBarMessages,
  resultHasTruncatedFields
} from '../helpers'
import {
  CopyIconAbsolutePositioner,
  RelatableStyleWrapper,
  StyledJsonPre,
  StyledPreSpan
} from './relatable-view.styled'
import Ellipsis from 'browser-components/Ellipsis'
import { GlobalState } from 'project-root/src/shared/globalState'
import { BrowserRequestResult } from 'project-root/src/shared/modules/requests/requestsDuck'
import {
  getMaxFieldItems,
  getMaxRows
} from 'project-root/src/shared/modules/settings/settingsDuck'
import { stringModifier } from 'services/bolt/cypherTypesFormatting'
import { stringifyMod, unescapeDoubleQuotesForDisplay } from 'services/utils'
import arrayHasItems from './relatable/utils/array-has-items'
import styled from 'styled-components'

const RelatableView = connect((state: GlobalState) => ({
  maxRows: getMaxRows(state),
  maxFieldItems: getMaxFieldItems(state)
}))(RelatableViewComponent)

export default RelatableView

type RelatableViewComponentProps = {
  maxRows: number
  maxFieldItems: number
  result: BrowserRequestResult
  updated?: number
}
export function RelatableViewComponent({
  result,
  maxFieldItems
}: RelatableViewComponentProps): JSX.Element | null {
  const records = useMemo(
    () => (result && 'records' in result ? result.records : []),
    [result]
  )

  const data = useMemo(() => {
    console.log('records', records)
    console.log('maxFieldItems', maxFieldItems)
    const headerKeys = getHeaderKeys(records)
    console.log('headerKeys', headerKeys)
    const data = getData(records, headerKeys)
    let dataForTable: object[] = []
    if (data) {
      console.log('data', data)
      const numberOfRows = (data.get(headerKeys[0]) ?? []).length
      const rowData = Array<object>(numberOfRows).fill({})
      for (let row = 0; row < numberOfRows; row++) {
        for (const headerKey of headerKeys) {
          const values = data.get(headerKey) ?? []
          values.map((item: unknown) => {
            /* @ts-ignore */
            rowData[row][headerKey] = item
          })
        }
      }
      dataForTable = rowData
    }

    console.log('dataForTable', dataForTable)
    return dataForTable
  }, [records, maxFieldItems])

  const columns = useMemo(() => getColumns(records), [records])

  const tableProps = useTable(
    {
      columns: columns,
      data: data,
      initialState: { pageSize: 5 },
      autoResetGlobalFilter: false,
      autoResetPage: false
    } as any,
    // useSortBy,
    // useBlockLayout,
    useFlexLayout,
    useResizeColumns,
    useExpanded,
    usePagination
  )

  if (!arrayHasItems(columns)) {
    return <RelatableBodyMessage result={result} maxRows={records.length} />
  }

  const { getTableBodyProps, prepareRow, page } = tableProps

  return (
    <RelatableStyleWrapper>
      <Table
        {...tableProps}
        body={
          /* @ts-ignore yarn link issue */
          <tbody {...getTableBodyProps()}>
            {page.map((row: Row, index: number) => {
              prepareRow(row)
              const { key, ...restRowProps } = row.getRowProps() // to avoid complains on missing key
              return (
                /* @ts-ignore yarn link issue */
                <StyledRow key={key} {...restRowProps}>
                  <StyledRowIndex>{index + 1}</StyledRowIndex>
                  {row.cells.map((cell: Cell) => {
                    const { key, ...restCellProps } = cell.getCellProps() // to avoid complains on missing key
                    return (
                      /* @ts-ignore yarn link issue */
                      <td key={key} {...restCellProps}>
                        {cell.render('Cell')}
                      </td>
                    )
                  })}
                </StyledRow>
              )
            })}
          </tbody>
        }
      />
    </RelatableStyleWrapper>
  )
}

const StyledRow = styled.tr`
  background: lightblue;
  padding: 5px;
  margin: 5px;
  position: relative;
`

const StyledRowIndex = styled.div`
  font-size: 8px;
  background: lightgrey;
  position: absolute;
  z-index: 1;
  width: auto;
  height: 10px;
`

const getHeaderKeys = (records: Record[]) => {
  const firstRecord = head(records)
  const keys = get(firstRecord, 'keys', [])
  const headerKeys: string[] = map(keys, key => convertKeyToString(key))
  return headerKeys
}

const convertKeyToString = (key: string | number | symbol) => {
  let keyString = 'unknown'
  if (typeof key === 'string') {
    keyString = key
  } else if (typeof key === 'number') {
    keyString = '' + key
  } else if (typeof key === 'symbol') {
    const keyStringOrUndefined = key.toString()
    if (keyStringOrUndefined) {
      keyString = 'symbol_' + keyStringOrUndefined
    }
  }
  return keyString
}

const getColumns = (records: Record[]): Column<object>[] => {
  const headerKeys = getHeaderKeys(records)

  return headerKeys.map(key => ({
    Header: key,
    accessor: key,
    Cell: CypherCell
  }))
}

const getData = (records: Record[], headerKeys: string[]) => {
  const data: Map<string, Array<object>> = new Map()

  for (const record of records) {
    for (const key of headerKeys) {
      const recordData = record.get(key)
      const currentData = data.get(key) ?? []
      const newDataForKey = [...currentData, recordData]
      data.set(key, newDataForKey)
    }
  }

  return data
}

function getColumnsOld(
  records: Record[],
  maxFieldItems: number
): Column<object>[] {
  const keys = get(head(records), 'keys', [])

  return map(
    keys,
    key =>
      ({
        Header: key,
        accessor: (record: Record) => {
          const fieldItem = record.get(key)

          let item = fieldItem
          if (Array.isArray(fieldItem)) {
            item = slice(fieldItem, 0, maxFieldItems)
          }

          return item
        },
        Cell: CypherCell
      } as Column<object>)
  )
}

const MAX_LENGTH_CELL = 50
export const ELLIPSIS = '\u2026'
type CypherCellProps = {
  cell: any
}
function CypherCell({ cell }: CypherCellProps) {
  const [expanded, setExpanded] = useState<boolean>(false)
  const { value } = cell

  const handleClickExpanded = () => setExpanded(!expanded)
  const stringValue = stringifyMod(value, stringModifier, false)
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '5px' }}>
      {expanded || stringValue.length < MAX_LENGTH_CELL ? (
        <>
          {stringValue.length > MAX_LENGTH_CELL && (
            <div
              style={{ width: '20px', height: '20px' }}
              onClick={handleClickExpanded}
            >
              <ChevronDownIcon />
            </div>
          )}
          {renderCell(value)}
        </>
      ) : (
        <>
          <div
            style={{ width: '20px', height: '20px' }}
            onClick={handleClickExpanded}
          >
            <ChevronUpIcon />
          </div>
          {stringValue.slice(0, MAX_LENGTH_CELL) + ELLIPSIS}
        </>
      )}
    </div>
  )
}

const renderCell = (entry: any) => {
  if (Array.isArray(entry)) {
    const children = entry.map((item, index) => (
      <StyledPreSpan key={index}>
        {renderCell(item)}
        {index === entry.length - 1 ? null : ', '}
      </StyledPreSpan>
    ))
    return <StyledPreSpan>[{children}]</StyledPreSpan>
  } else if (typeof entry === 'object') {
    return renderObject(entry)
  } else {
    return (
      <ClickableUrls
        text={unescapeDoubleQuotesForDisplay(
          stringifyMod(entry, stringModifier, true)
        )}
        WrappingTag={StyledPreSpan}
      />
    )
  }
}

const renderObject = (entry: any) => {
  if (isInt(entry)) return entry.toString()
  if (entry === null) return <em>null</em>
  const text = unescapeDoubleQuotesForDisplay(
    stringifyMod(entry, stringModifier, true)
  )

  return (
    <StyledJsonPre>
      <CopyIconAbsolutePositioner>
        <ClipboardCopier textToCopy={text} />
      </CopyIconAbsolutePositioner>
      <ClickableUrls text={text} />
    </StyledJsonPre>
  )
}

type RelatableBodyMessageProps = {
  maxRows: number
  result: BrowserRequestResult
}
function RelatableBodyMessage({ maxRows, result }: RelatableBodyMessageProps) {
  const { bodyMessage } = getBodyAndStatusBarMessages(result, maxRows)

  return (
    <StyledStatsBar>
      <Ellipsis>{bodyMessage}</Ellipsis>
    </StyledStatsBar>
  )
}

export const RelatableStatusbar = connect((state: GlobalState) => ({
  maxRows: getMaxRows(state),
  maxFieldItems: getMaxFieldItems(state)
}))(RelatableStatusbarComponent)

type RelatableStatusBarComponentProps = {
  maxRows: number
  maxFieldItems: number
  result?: QueryResult | BrowserRequestResult | null
  updated?: number
}
export function RelatableStatusbarComponent({
  maxRows,
  result,
  maxFieldItems
}: RelatableStatusBarComponentProps): JSX.Element {
  const hasTruncatedFields = useMemo(
    () => resultHasTruncatedFields(result, maxFieldItems),
    [result, maxFieldItems]
  )
  const { statusBarMessage } = useMemo(
    () => getBodyAndStatusBarMessages(result, maxRows),
    [result, maxRows]
  )

  return (
    <StyledStatsBar>
      <Ellipsis>
        {hasTruncatedFields && (
          <WarningMessage text={'Record fields have been truncated.'} />
        )}
        {statusBarMessage}
      </Ellipsis>
    </StyledStatsBar>
  )
}
