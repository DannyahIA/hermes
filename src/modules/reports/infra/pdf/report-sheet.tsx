import { Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import { FONT, INK, SHEET, textStyles, TYPE } from './pdf-theme';
import type { ReportSheetMeta } from './report-sheets';
import { TitleBlock } from './title-block';

const MARK = 10;
const MARK_STROKE = 1.5;

const styles = StyleSheet.create({
  page: {
    backgroundColor: INK.paper,
    color: INK.text,
    fontFamily: FONT.body,
    fontSize: TYPE.body,
    paddingTop: SHEET.margin + SHEET.gutter,
    paddingLeft: SHEET.filingMargin + SHEET.gutter,
    paddingRight: SHEET.margin + SHEET.gutter,
    paddingBottom: SHEET.margin + SHEET.titleBlockHeight + SHEET.gutter,
  },
  frame: {
    position: 'absolute',
    top: SHEET.margin,
    left: SHEET.filingMargin,
    right: SHEET.margin,
    bottom: SHEET.margin,
    borderWidth: 1,
    borderColor: INK.blueline,
  },
  // The app's `.registration-frame` corner marks, at the same two corners.
  markTopLeft: {
    position: 'absolute',
    top: SHEET.margin - 0.25,
    left: SHEET.filingMargin - 0.25,
    width: MARK,
    height: MARK,
    borderTopWidth: MARK_STROKE,
    borderLeftWidth: MARK_STROKE,
    borderColor: INK.amber,
  },
  markBottomRight: {
    position: 'absolute',
    bottom: SHEET.margin - 0.25,
    right: SHEET.margin - 0.25,
    width: MARK,
    height: MARK,
    borderBottomWidth: MARK_STROKE,
    borderRightWidth: MARK_STROKE,
    borderColor: INK.amber,
  },
  notes: {
    marginTop: 4,
    width: 340,
  },
  notesHeading: {
    fontFamily: FONT.display,
    fontWeight: 600,
    fontSize: TYPE.body,
    marginBottom: 4,
  },
  note: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  noteNumber: {
    width: 12,
  },
});

interface ReportSheetProps {
  sheet: ReportSheetMeta;
  period: { from: Date; to: Date };
  issuedAt: Date;
  /**
   * General notes, numbered the way a drawing numbers them so the sheet can
   * point at one — "(nota 2)" in a caption — instead of repeating a caveat.
   */
  notes: string[];
  children: React.ReactNode;
}

/** One A4 sheet: frame, registration marks and title block on every page, content flowing inside. */
export function ReportSheet({
  sheet,
  period,
  issuedAt,
  notes,
  children,
}: ReportSheetProps) {
  return (
    <Page size="A4" style={styles.page}>
      <View fixed style={styles.frame} />
      <View fixed style={styles.markTopLeft} />
      <View fixed style={styles.markBottomRight} />
      <TitleBlock sheet={sheet} period={period} issuedAt={issuedAt} />

      {children}

      {notes.length > 0 && (
        <View style={styles.notes} wrap={false}>
          <Text style={styles.notesHeading}>Notas</Text>
          {notes.map((note, index) => (
            <View key={note} style={styles.note}>
              <Text style={[textStyles.caption, styles.noteNumber]}>
                {index + 1}.
              </Text>
              <Text style={[textStyles.caption, { flex: 1 }]}>{note}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}
