import { StyleSheet, Text, View } from '@react-pdf/renderer';

import { formatIssuedAt, formatPeriod } from './pdf-format';
import { FONT, INK, SHEET, TYPE } from './pdf-theme';
import type { ReportSheetMeta } from './report-sheets';

const RULE = 0.5;

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    left: SHEET.filingMargin,
    right: SHEET.margin,
    bottom: SHEET.margin,
    height: SHEET.titleBlockHeight,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: INK.blueline,
  },
  owner: {
    width: 92,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  wordmark: {
    fontFamily: FONT.display,
    fontWeight: 600,
    fontSize: 15,
    color: INK.blueline,
  },
  title: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderLeftWidth: RULE,
    borderLeftColor: INK.blueline,
  },
  sheetTitle: {
    fontFamily: FONT.display,
    fontWeight: 600,
    fontSize: TYPE.title,
    color: INK.text,
    marginTop: 1,
  },
  fieldColumn: {
    borderLeftWidth: RULE,
    borderLeftColor: INK.blueline,
  },
  field: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  fieldDivider: {
    borderTopWidth: RULE,
    borderTopColor: INK.blueline,
  },
  label: {
    fontSize: TYPE.label,
    color: INK.graphite,
  },
  value: {
    fontSize: TYPE.caption + 0.5,
    color: INK.text,
    marginTop: 1,
  },
  code: {
    fontFamily: FONT.figure,
    fontWeight: 500,
    fontSize: TYPE.body + 0.5,
    color: INK.text,
    marginTop: 1,
  },
});

interface TitleBlockProps {
  sheet: ReportSheetMeta;
  period: { from: Date; to: Date };
  issuedAt: Date;
}

/**
 * The sheet's title block, after ISO 7200: the fields a drawing uses to
 * identify itself, labelled in sentence case the way the standard names
 * them ("Título", "Folha"), spanning the frame's full bottom edge. Rendered
 * `fixed` so every page of the sheet carries it — and with it the page
 * count, the only place a page number appears.
 */
export function TitleBlock({ sheet, period, issuedAt }: TitleBlockProps) {
  return (
    <View fixed style={styles.block}>
      <View style={styles.owner}>
        <Text style={styles.wordmark}>Hermes</Text>
      </View>

      <View style={styles.title}>
        <Text style={styles.label}>Título</Text>
        <Text style={styles.sheetTitle}>{sheet.title}</Text>
        <Text style={[styles.label, { marginTop: 1 }]}>
          Relatório financeiro
        </Text>
      </View>

      <View style={[styles.fieldColumn, { width: 132 }]}>
        <Field label="Período" value={formatPeriod(period.from, period.to)} />
        <Field label="Emitido em" value={formatIssuedAt(issuedAt)} divided />
      </View>

      <View style={[styles.fieldColumn, { width: 76 }]}>
        <View style={styles.field}>
          <Text style={styles.label}>Folha</Text>
          <Text style={styles.code}>{sheet.code}</Text>
        </View>
        <View style={[styles.field, styles.fieldDivider]}>
          <Text style={styles.label}>Página</Text>
          <Text
            style={styles.value}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  divided = false,
}: {
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <View style={divided ? [styles.field, styles.fieldDivider] : styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
