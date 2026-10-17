import { StyleSheet, Text, View } from '@react-pdf/renderer';

import { textStyles } from './pdf-theme';

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  caption: {
    marginTop: 2,
    maxWidth: 380,
  },
  body: {
    marginTop: 10,
  },
});

interface SheetSectionProps {
  title: string;
  caption?: string;
  /** Set when the section's own content is short enough that it should never split across pages. */
  keepTogether?: boolean;
  width?: number;
  children: React.ReactNode;
}

/**
 * One view on the sheet: a heading, an optional one-line caption, then the
 * drawing or table. Views are separated by space alone — no boxes, no rules —
 * so the frame stays the only enclosing line on the sheet.
 */
export function SheetSection({
  title,
  caption,
  keepTogether = false,
  width,
  children,
}: SheetSectionProps) {
  return (
    <View
      style={width ? [styles.section, { width }] : styles.section}
      wrap={!keepTogether}
    >
      {/* Pushes the heading to the next page rather than strand it at the
          foot of this one with nothing under it. */}
      <Text style={textStyles.heading} minPresenceAhead={60}>
        {title}
      </Text>
      {caption && (
        <Text style={[textStyles.caption, styles.caption]}>{caption}</Text>
      )}
      <View style={styles.body}>{children}</View>
    </View>
  );
}
