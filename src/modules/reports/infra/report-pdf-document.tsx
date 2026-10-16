import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { FinancialReport } from '@/modules/reports/application/get-financial-report.use-case';
import { formatCurrency } from '@/shared/lib/format-currency';
import { formatDate } from '@/shared/lib/format-date';

/*
 * Colors are literal hex rather than the app's CSS variables: a PDF has no
 * stylesheet and no theme to resolve them against. These are the light-mode
 * values of --primary, --foreground and --muted-foreground, so a printed
 * report still reads as the same document as the screen.
 */
const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica' },
  title: { fontSize: 16, marginBottom: 4, color: '#1d4e89' },
  subtitle: { fontSize: 10, marginBottom: 16, color: '#5a7185' },
  sectionTitle: {
    fontSize: 12,
    marginTop: 16,
    marginBottom: 6,
    color: '#1d4e89',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  label: { color: '#12233d' },
  value: { fontFamily: 'Helvetica-Bold' },
});

interface ReportPdfDocumentProps {
  report: FinancialReport;
  period: { from: Date; to: Date };
}

export function ReportPdfDocument({ report, period }: ReportPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Relatório financeiro — Hermes</Text>
        <Text style={styles.subtitle}>
          {formatDate(period.from)} — {formatDate(period.to)}
        </Text>

        <Text style={styles.sectionTitle}>Totais do período</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Receitas</Text>
          <Text style={styles.value}>{formatCurrency(report.totalIncome)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Despesas</Text>
          <Text style={styles.value}>
            {formatCurrency(report.totalExpense)}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Gastos por categoria</Text>
        {report.spendingByCategory.length === 0 ? (
          <Text style={styles.label}>
            Nenhuma despesa registrada neste período.
          </Text>
        ) : (
          report.spendingByCategory.map((category) => (
            <View key={category.categoryId} style={styles.row}>
              <Text style={styles.label}>{category.categoryName}</Text>
              <Text style={styles.value}>{formatCurrency(category.total)}</Text>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
