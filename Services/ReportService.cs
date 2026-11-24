using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Possing.Services;

public class ReportService(AppDbContext db)
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

        var ink = Color.FromHex("#1A2332");
        var muted = Color.FromHex("#5B6B7C");
        var line = Color.FromHex("#D5DCE3");
        var band = Color.FromHex("#243447");
        var soft = Color.FromHex("#F4F7FA");
        var accent = Color.FromHex("#1B7F4A");

        var discountLabel = sale.DiscountType == "Percent"
            ? $"{sale.DiscountValue:0.##}%  (− BDT {sale.Discount:0.00})"
            : $"BDT {sale.Discount:0.00}";

        var hasCustomer = !string.IsNullOrWhiteSpace(sale.CustomerName)
            || !string.IsNullOrWhiteSpace(sale.CustomerMobile);

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A5);
                page.Margin(28);
                page.DefaultTextStyle(x => x
                    .FontFamily("Segoe UI")
                    .FontColor(ink)
                    .FontSize(10)
                    .LineHeight(1.25f));

                page.Content().Column(col =>
                {
                    // 1) Store header
                    col.Item().Background(band).Padding(14).Column(h =>
                    {
                        h.Item().AlignCenter().Text("POSSING")
                            .FontFamily("Georgia")
                            .FontSize(22)
                            .Bold()
                            .FontColor(Colors.White)
                            .LetterSpacing(0.08f);
                        h.Item().PaddingTop(2).AlignCenter().Text("POINT OF SALE")
                            .FontSize(8)
                            .FontColor(Color.FromHex("#B8C7D6"))
                            .LetterSpacing(0.18f);
                        h.Item().PaddingTop(8).AlignCenter().Text("SALES RECEIPT")
                            .FontFamily("Georgia")
                            .FontSize(12)
                            .FontColor(Colors.White);
                    });

                    // 2) Receipt details
                    col.Item().PaddingTop(14).Text("1 · RECEIPT DETAILS")
                        .FontSize(8)
                        .Bold()
                        .FontColor(muted)
                        .LetterSpacing(0.06f);

                    col.Item().PaddingTop(6).Background(soft).Border(1).BorderColor(line).Padding(10).Column(meta =>
                    {
                        MetaRow(meta, "Invoice No.", sale.InvoiceNo);
                        MetaRow(meta, "Date & Time", sale.CreatedAt.ToLocalTime().ToString("dd MMM yyyy, hh:mm tt"));
                        MetaRow(meta, "Cashier", sale.User.Username);
                        MetaRow(meta, "Payment method", sale.PaymentMethod);
                    });

                    // 3) Customer (optional)
                    if (hasCustomer)
                    {
                        col.Item().PaddingTop(12).Text("2 · CUSTOMER")
                            .FontSize(8)
                            .Bold()
                            .FontColor(muted)
                            .LetterSpacing(0.06f);

                        col.Item().PaddingTop(6).Border(1).BorderColor(line).Padding(10).Column(c =>
                        {
                            MetaRow(c, "Name", string.IsNullOrWhiteSpace(sale.CustomerName) ? "—" : sale.CustomerName!);
                            MetaRow(c, "Mobile", string.IsNullOrWhiteSpace(sale.CustomerMobile) ? "—" : sale.CustomerMobile!);
                        });
                    }

                    // 4) Items
                    var stepItems = hasCustomer ? "3" : "2";
                    col.Item().PaddingTop(12).Text($"{stepItems} · ITEMS PURCHASED")
                        .FontSize(8)
                        .Bold()
                        .FontColor(muted)
                        .LetterSpacing(0.06f);

                    col.Item().PaddingTop(6).Table(table =>
                    {
                        table.ColumnsDefinition(c =>
                        {
                            c.ConstantColumn(22);
                            c.RelativeColumn(3.2f);
                            c.RelativeColumn(0.8f);
                            c.RelativeColumn(1.4f);
                            c.RelativeColumn(1.5f);
                        });

                        table.Header(h =>
                        {
                            HeaderCell(h, "#");
                            HeaderCell(h, "Item");
                            HeaderCell(h, "Qty", true);
                            HeaderCell(h, "Price", true);
                            HeaderCell(h, "Amount", true);
                        });

                        var i = 1;
                        foreach (var item in sale.Items)
                        {
                            var bg = i % 2 == 0 ? soft : Colors.White;
                            BodyCell(table, $"{i}", bg);
                            BodyCell(table, item.Product.Name, bg);
                            BodyCell(table, item.Qty.ToString(), bg, true);
                            BodyCell(table, $"BDT {item.UnitPrice:0.00}", bg, true);
                            BodyCell(table, $"BDT {item.LineTotal:0.00}", bg, true);
                            i++;
                        }
                    });

                    // 5) Bill summary
                    var stepBill = hasCustomer ? "4" : "3";
                    col.Item().PaddingTop(14).Text($"{stepBill} · BILL SUMMARY")
                        .FontSize(8)
                        .Bold()
                        .FontColor(muted)
                        .LetterSpacing(0.06f);

                    col.Item().PaddingTop(6).Border(1).BorderColor(line).Padding(10).Column(sum =>
                    {
                        sum.Item().Row(r =>
                        {
                            r.RelativeItem().Text("Subtotal").FontColor(muted);
                            r.ConstantItem(120).AlignRight().Text($"BDT {sale.SubTotal:0.00}")
                                .FontFamily("Consolas");
                        });
                        sum.Item().PaddingTop(4).Row(r =>
                        {
                            r.RelativeItem().Text($"Discount ({discountLabel})").FontColor(muted);
                            r.ConstantItem(120).AlignRight().Text($"− BDT {sale.Discount:0.00}")
                                .FontFamily("Consolas")
                                .FontColor(Color.FromHex("#B45309"));
                        });
                        sum.Item().PaddingTop(8).LineHorizontal(1).LineColor(line);
                        sum.Item().PaddingTop(8).Background(Color.FromHex("#E8F5EE")).Padding(8).Row(r =>
                        {
                            r.RelativeItem().AlignMiddle().Text("AMOUNT PAID")
                                .FontFamily("Georgia")
                                .Bold()
                                .FontSize(11)
                                .FontColor(accent);
                            r.ConstantItem(130).AlignRight().AlignMiddle().Text($"BDT {sale.Total:0.00}")
                                .FontFamily("Georgia")
                                .Bold()
                                .FontSize(16)
                                .FontColor(accent);
                        });
                    });

                    // 6) Footer
                    col.Item().PaddingTop(18).AlignCenter().Text("Thank you for shopping with us")
                        .FontFamily("Georgia")
                        .Italic()
                        .FontSize(11)
                        .FontColor(ink);
                    col.Item().PaddingTop(4).AlignCenter().Text("Please keep this receipt for your records")
                        .FontSize(8)
                        .FontColor(muted);
                    col.Item().PaddingTop(10).AlignCenter().Text($"Generated · {DateTime.Now:dd MMM yyyy HH:mm}")
                        .FontSize(7)
                        .FontColor(Color.FromHex("#9AA6B2"));
                });
            });
        });

        return document.GeneratePdf();

        static void MetaRow(ColumnDescriptor col, string label, string value)
        {
            col.Item().PaddingVertical(2).Row(r =>
            {
                r.ConstantItem(110).Text(label).FontSize(9).FontColor(Color.FromHex("#5B6B7C"));
                r.RelativeItem().Text(value).FontSize(10).SemiBold().FontFamily("Segoe UI");
            });
        }

        static void HeaderCell(TableCellDescriptor h, string text, bool right = false)
        {
            var cell = h.Cell().Background(Color.FromHex("#243447")).PaddingVertical(6).PaddingHorizontal(4);
            var t = right ? cell.AlignRight().Text(text) : cell.Text(text);
            t.FontSize(8).Bold().FontColor(Colors.White).LetterSpacing(0.04f);
        }

        static void BodyCell(TableDescriptor table, string text, Color bg, bool right = false)
        {
            var cell = table.Cell().Background(bg).BorderBottom(0.5f).BorderColor(Color.FromHex("#D5DCE3"))
                .PaddingVertical(5).PaddingHorizontal(4);
            var t = right ? cell.AlignRight().Text(text) : cell.Text(text);
            t.FontSize(9).FontFamily(right ? "Consolas" : "Segoe UI");
        }
    }

    public async Task<byte[]> GenerateMonthlyReportAsync(int year, int month)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = start.AddMonths(1);

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
                    col.Item().Text($"Gross total: BDT {sales.Sum(s => s.Total):0.00}");
                    col.Item().Text($"Cash: BDT {sales.Where(s => s.PaymentMethod == "Cash").Sum(s => s.Total):0.00}");
                    col.Item().Text($"Card: BDT {sales.Where(s => s.PaymentMethod == "Card").Sum(s => s.Total):0.00}");
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
