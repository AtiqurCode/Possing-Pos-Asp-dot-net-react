using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Possing.Services;

public class ReportService(AppDbContext db, SettingsService settings)
{
    static ReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;

        // Bundle fonts with the app (QuestPDF 2026.9+ no longer loads system fonts by default)
        var fontsDir = Path.Combine(AppContext.BaseDirectory, "Fonts");
        if (Directory.Exists(fontsDir))
        {
            foreach (var fontFile in Directory.EnumerateFiles(fontsDir, "*.ttf"))
            {
                using var stream = File.OpenRead(fontFile);
                FontManager.RegisterFont(stream);
            }
        }
    }

    public async Task<ReportAnalyticsDto> GetAnalyticsAsync(int year, int month)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);
        var daysInMonth = DateTime.DaysInMonth(year, month);

        var sales = await db.Sales
            .AsNoTracking()
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .ThenInclude(p => p.SubCategory)
            .ThenInclude(sc => sc.Category)
            .Where(s => s.CreatedAt >= start && s.CreatedAt < end)
            .ToListAsync();

        var daily = Enumerable.Range(1, daysInMonth)
            .Select(d =>
            {
                var day = new DateTime(year, month, d, 0, 0, 0, DateTimeKind.Utc);
                return new ChartPointDto(
                    d.ToString("00"),
                    sales.Where(s => s.CreatedAt.Day == d).Sum(s => s.Total));
            })
            .ToList();

        var payments = sales
            .GroupBy(s => s.PaymentMethod)
            .Select(g => new NamedCountDto(g.Key, g.Count(), g.Sum(x => x.Total)))
            .OrderByDescending(x => x.Amount)
            .ToList();

        var categories = sales
            .SelectMany(s => s.Items)
            .GroupBy(i => i.Product.SubCategory.Category.Name)
            .Select(g => new NamedCountDto(g.Key, g.Sum(x => x.Qty), g.Sum(x => x.LineTotal)))
            .OrderByDescending(x => x.Amount)
            .Take(8)
            .ToList();

        var topProducts = sales
            .SelectMany(s => s.Items)
            .GroupBy(i => i.Product.Name)
            .Select(g => new NamedCountDto(g.Key, g.Sum(x => x.Qty), g.Sum(x => x.LineTotal)))
            .OrderByDescending(x => x.Amount)
            .Take(8)
            .ToList();

        var total = sales.Sum(s => s.Total);
        return new ReportAnalyticsDto(
            year,
            month,
            total,
            sales.Count,
            sales.Count == 0 ? 0 : Math.Round(total / sales.Count, 2),
            sales.Sum(s => s.Discount),
            daily,
            payments,
            categories,
            topProducts);
    }

    public async Task<byte[]?> GenerateSaleSlipAsync(Guid saleId)
    {
        var sale = await db.Sales
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == saleId);

        if (sale is null) return null;

        var store = await settings.GetStoreAsync();
        var currency = string.IsNullOrWhiteSpace(store.Currency) ? "BDT" : store.Currency;
        var itemCount = sale.Items.Sum(i => i.Qty);
        var local = sale.CreatedAt.ToLocalTime();
        var inclusive = string.Equals(sale.TaxMode, TaxModes.Inclusive, StringComparison.OrdinalIgnoreCase);

        // 58mm thermal / small laser slip (≈164.4pt) — continuous height
        const float slipWidth = 164.41f;
        const float priceCol = 52f;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.ContinuousSize(slipWidth);
                page.MarginHorizontal(6);
                page.MarginVertical(8);
                page.DefaultTextStyle(x => x
                    .FontFamily("Consolas")
                    .FontSize(8)
                    .FontColor(Colors.Black)
                    .LineHeight(1.1f));

                page.Content().Column(col =>
                {
                    col.Item().AlignCenter().Text(store.Name.ToUpperInvariant()).Bold().FontSize(10);
                    if (!string.IsNullOrWhiteSpace(store.Address))
                        col.Item().AlignCenter().Text(store.Address).FontSize(7);
                    if (!string.IsNullOrWhiteSpace(store.Phone))
                        col.Item().AlignCenter().Text(store.Phone).FontSize(7);

                    Dashed(col);
                    col.Item().Text($"{local:MMM dd, yyyy  hh:mm tt}");
                    col.Item().Text($"Order {sale.InvoiceNo}");
                    col.Item().Text($"Cashier: {sale.User.Username}");
                    if (!string.IsNullOrWhiteSpace(sale.CustomerName) || !string.IsNullOrWhiteSpace(sale.CustomerMobile))
                    {
                        col.Item().Text($"Customer: {sale.CustomerName ?? "-"}");
                        if (!string.IsNullOrWhiteSpace(sale.CustomerMobile))
                            col.Item().Text($"Mobile: {sale.CustomerMobile}");
                    }

                    Dashed(col);

                    foreach (var item in sale.Items)
                    {
                        col.Item().Row(r =>
                        {
                            r.RelativeItem().Text(item.Product.Name).Bold();
                            r.ConstantItem(priceCol).AlignRight().Text($"{currency} {item.LineTotal:0.00}").Bold();
                        });
                        if (item.Qty > 1)
                            col.Item().Text($"  {item.Qty} @ {currency} {item.UnitPrice:0.00}").FontSize(7);
                        else
                            col.Item().Text($"  {currency} {item.UnitPrice:0.00}").FontSize(7);
                    }

                    Dashed(col);

                    MoneyRow(col, "Subtotal", $"{currency} {sale.SubTotal:0.00}", priceCol);
                    if (sale.Discount > 0)
                    {
                        var disc = sale.DiscountType == "Percent"
                            ? $"Discount ({sale.DiscountValue:0.##}%)"
                            : "Discount";
                        MoneyRow(col, disc, $"-{currency} {sale.Discount:0.00}", priceCol);
                    }

                    if (sale.TaxRate > 0 || sale.TaxAmount > 0)
                    {
                        var vatLabel = inclusive
                            ? $"VAT incl. ({sale.TaxRate:0.##}%)"
                            : $"VAT ({sale.TaxRate:0.##}%)";
                        MoneyRow(col, vatLabel, $"{currency} {sale.TaxAmount:0.00}", priceCol);
                    }

                    col.Item().PaddingTop(3).Row(r =>
                    {
                        r.RelativeItem().Text("TOTAL").Bold().FontSize(11);
                        r.ConstantItem(priceCol).AlignRight().Text($"{currency} {sale.Total:0.00}").Bold().FontSize(11);
                    });

                    col.Item().PaddingTop(3).Text($"Payment: {sale.PaymentMethod}");
                    col.Item().Text($"Items sold: {itemCount}");

                    Dashed(col);
                    col.Item().AlignCenter().Text(sale.InvoiceNo).FontSize(7);
                    col.Item().PaddingTop(4).AlignCenter().Text("Thank you, come again!").Bold();
                });
            });
        });

        return document.GeneratePdf();

        static void Dashed(ColumnDescriptor col)
        {
            col.Item().PaddingVertical(3).AlignCenter()
                .Text("------------------------")
                .FontSize(7);
        }

        static void MoneyRow(ColumnDescriptor col, string label, string value, float priceCol)
        {
            col.Item().Row(r =>
            {
                r.RelativeItem().Text(label);
                r.ConstantItem(priceCol).AlignRight().Text(value);
            });
        }
    }

    public async Task<byte[]> GenerateMonthlyReportAsync(int year, int month)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);
        var store = await settings.GetStoreAsync();
        var currency = string.IsNullOrWhiteSpace(store.Currency) ? "BDT" : store.Currency;

        var sales = await db.Sales
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .Where(s => s.CreatedAt >= start && s.CreatedAt < end)
            .OrderBy(s => s.CreatedAt)
            .ToListAsync();

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("POSSING POS — Monthly Sales Report").Bold().FontSize(16);
                    col.Item().Text($"{start:MMMM yyyy}");
                    col.Item().PaddingBottom(10).LineHorizontal(1);
                });

                page.Content().Column(col =>
                {
                    col.Item().Text($"Total sales: {sales.Count}");
                    col.Item().Text($"Gross total: {currency} {sales.Sum(s => s.Total):0.00}");
                    col.Item().Text($"Cash: {currency} {sales.Where(s => s.PaymentMethod == "Cash").Sum(s => s.Total):0.00}");
                    col.Item().Text($"Card: {currency} {sales.Where(s => s.PaymentMethod == "Card").Sum(s => s.Total):0.00}");
                    col.Item().PaddingVertical(10);

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.RelativeColumn(2);
                            c.RelativeColumn(2);
                            c.RelativeColumn(1.5f);
                            c.RelativeColumn(1);
                            c.RelativeColumn(1.5f);
                        });

                        table.Header(h =>
                        {
                            h.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Invoice").Bold();
                            h.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Date").Bold();
                            h.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Cashier").Bold();
                            h.Cell().Background(Colors.Grey.Lighten3).Padding(4).Text("Pay").Bold();
                            h.Cell().Background(Colors.Grey.Lighten3).Padding(4).AlignRight().Text("Total").Bold();
                        });

                        foreach (var sale in sales)
                        {
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(sale.InvoiceNo);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text($"{sale.CreatedAt.ToLocalTime():yyyy-MM-dd HH:mm}");
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(sale.User.Username);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).Text(sale.PaymentMethod);
                            table.Cell().BorderBottom(0.5f).BorderColor(Colors.Grey.Lighten2).Padding(3).AlignRight().Text($"{sale.Total:0.00}");
                        }
                    });

                    if (sales.Count == 0)
                        col.Item().PaddingTop(20).Text("No sales recorded for this month.");
                });

                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Generated ");
                    t.Span($"{DateTime.Now:yyyy-MM-dd HH:mm}");
                });
            });
        });

        return document.GeneratePdf();
    }
}
