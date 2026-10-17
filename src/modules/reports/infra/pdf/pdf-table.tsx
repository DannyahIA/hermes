import { StyleSheet, Text, View } from '@react-pdf/renderer';

import { FONT, INK, TYPE } from './pdf-theme';

const COLUMN_GUTTER = 10;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: INK.blueline,
  },
  headerCell: {
    fontSize: TYPE.label,
    color: INK.graphite,
  },
  // The app's `.dimension-row`: a dashed construction line between rows,
  // solid only where the table itself starts and ends.
  row: {
    flexDirection: 'row',
    paddingVertical: 3.5,
    borderBottomWidth: 0.5,
    borderBottomColor: INK.construction,
    borderBottomStyle: 'dashed',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 4,
    borderTopWidth: 0.75,
    borderTopColor: INK.blueline,
  },
  cell: {
    fontSize: TYPE.caption + 0.5,
    color: INK.text,
  },
  figureCell: {
    fontFamily: FONT.figure,
    fontSize: TYPE.caption,
  },
});

export interface PdfColumn<Row> {
  header: string;
  /** Fixed width in points; columns without one share what's left. */
  width?: number;
  /** Currency and percentages: mono, right-aligned, so decimals line up. */
  figure?: boolean;
  /** Ink for a single cell — e.g. redline for a negative result. */
  color?: (row: Row) => string | undefined;
  render: (row: Row) => string;
}

interface PdfTableProps<Row> {
  columns: Array<PdfColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  /** A closing totals line: one string per column. */
  footer?: string[];
}

export function PdfTable<Row>({
  columns,
  rows,
  rowKey,
  footer,
}: PdfTableProps<Row>) {
  const cellBox = (column: PdfColumn<Row>, index: number) => ({
    ...(column.width ? { width: column.width } : { flex: 1 }),
    // A gutter before every column but the first, so a right-aligned
    // figure never runs into a left-aligned label beside it.
    paddingLeft: index === 0 ? 0 : COLUMN_GUTTER,
  });

  const cellStyle = (column: PdfColumn<Row>, index: number) => [
    styles.cell,
    cellBox(column, index),
    column.figure ? styles.figureCell : {},
    { textAlign: column.figure ? ('right' as const) : ('left' as const) },
  ];

  return (
    <View>
      <View style={styles.header} wrap={false}>
        {columns.map((column, index) => (
          <Text
            key={column.header}
            style={[
              styles.headerCell,
              cellBox(column, index),
              { textAlign: column.figure ? 'right' : 'left' },
            ]}
          >
            {column.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={rowKey(row)}
          wrap={false}
          style={
            index === rows.length - 1
              ? [styles.row, styles.lastRow]
              : styles.row
          }
        >
          {columns.map((column, index) => (
            <Text
              key={column.header}
              style={[
                ...cellStyle(column, index),
                { color: column.color?.(row) ?? INK.text },
              ]}
            >
              {column.render(row)}
            </Text>
          ))}
        </View>
      ))}
      {footer && (
        <View style={styles.footer} wrap={false}>
          {columns.map((column, index) => (
            <Text
              key={column.header}
              style={[
                ...cellStyle(column, index),
                { fontWeight: column.figure ? 500 : 600 },
              ]}
            >
              {footer[index] ?? ''}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
